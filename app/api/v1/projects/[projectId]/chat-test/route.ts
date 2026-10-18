import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, ApiError } from "@/lib/api";
import { adminDb } from "@/lib/db/admin";
import { peopleSchema, chatIntroductionSchema } from "@/lib/schemas/onboarding";
import { membershipHash } from "@/lib/photon/connection";
import {
  PhotonSetupError,
  dmChatGuid,
  readSpectrumCredentials,
  sendPhotonText,
} from "@/lib/photon/spectrum";
import {
  PHOTON_TARGET_NOT_ALLOWED,
  PHOTON_AUTHENTICATION_FAILED,
} from "@/lib/photon/authorization-error";
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId),
      { expectedVersion, introduction } = chatIntroductionSchema.parse(
        await readJson(request),
      );
    const project = checked(
      await client.from("projects").select("*").eq("id", id).maybeSingle(),
    );
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project unavailable.");
    const people = peopleSchema.safeParse(project.people);
    if (!people.success)
      throw new ApiError(
        422,
        "SETUP_REQUIRED",
        "Choose the client from your Photon users first.",
      );
    const { client_sender_id, chat_guid, instance_id } = people.data;
    try {
      if (readSpectrumCredentials().projectId !== instance_id)
        throw new PhotonSetupError(
          "This client was saved under a different Photon project. Choose them again.",
        );
    } catch (error) {
      if (error instanceof PhotonSetupError)
        throw new ApiError(422, "PHOTON_SETUP", error.message);
      throw error;
    }
    if (chat_guid !== dmChatGuid(client_sender_id))
      throw new ApiError(
        422,
        "SETUP_REQUIRED",
        "Choose the client from your Photon users again.",
      );
    // Verify that the send result can be stored before reserving the chat or
    // contacting Photon. Older manually provisioned databases omitted this
    // additive column, so a successful send used to leave 'sending' forever.
    const storage = await client
      .from("chat_bindings")
      .select("project_id,introduction_text")
      .eq("project_id", id)
      .maybeSingle();
    if (storage.error?.code === "42703" || storage.error?.code === "PGRST204")
      throw new ApiError(
        503,
        "MIGRATION_REQUIRED",
        "The database is missing introduction storage. Run npm run automation:install to apply the missing setup migration before sending. No introduction was sent.",
      );
    checked(storage);
    const participants = [client_sender_id];
    const begin = await client.rpc("begin_chat_test", {
      p_project: id,
      p_expected: expectedVersion,
      p_participants: participants,
      p_hash: membershipHash(participants),
      p_introduction:introduction,
    });
    if (
      begin.error?.code === "23505" &&
      begin.error.hint === "chat_binding_reserved"
    )
      throw new ApiError(409, "CHAT_IN_USE", begin.error.message);
    // Older databases return a raw constraint error. Only this particular
    // constraint means the conversation is reserved; unrelated uniqueness
    // failures must keep their ordinary database/conflict handling.
    if (
      begin.error?.code === "23505" &&
      begin.error.message.includes('"chat_bindings_instance_id_chat_guid_key"')
    )
      throw new ApiError(
        409,
        "CHAT_IN_USE",
        "This conversation is reserved by another project, including drafts. Check your existing projects and any pending introduction before reconnecting. Apply the latest database migration to identify the conflicting project.",
      );
    checked(begin);
    const admin = adminDb();
    const result = await sendPhotonText(client_sender_id, introduction);
    if (result.state === "failed") {
      await admin
        .from("chat_bindings")
        .update({
          test_state: "failed",
          ...(result.reason
            ? {
                hold_reason:
                  result.reason === "target_not_allowed"
                    ? PHOTON_TARGET_NOT_ALLOWED
                    : PHOTON_AUTHENTICATION_FAILED,
              }
            : {}),
        })
        .eq("project_id", id)
        .eq("test_state", "sending");
      throw new ApiError(
        result.reason ? 422 : 502,
        result.reason === "target_not_allowed"
          ? "PHOTON_TARGET_NOT_ALLOWED"
          : "PHOTON_REJECTED",
        result.reason === "target_not_allowed"
          ? PHOTON_TARGET_NOT_ALLOWED
          : result.reason === "authentication"
            ? PHOTON_AUTHENTICATION_FAILED
            : "Photon could not send the introduction. Check the Photon project credentials and that this person is still on your Users page, then try again.",
      );
    }
    if (result.state === "unknown") {
      await admin
        .from("chat_bindings")
        .update({
          test_state: "unknown",
          hold_reason:
            "Introduction delivery is unknown. If the client did not receive it, choose them again to reset and resend.",
        })
        .eq("project_id", id)
        .eq("test_state", "sending");
      throw new ApiError(
        503,
        "DELIVERY_UNKNOWN",
        "Photon did not confirm the introduction. Check with the client before sending again.",
      );
    }
    const { error } = await admin
      .from("chat_bindings")
      .update({
        test_state: "sent",
        introduction_text: introduction,
        test_message_guid: result.messageId,
        disclosed_message_guid: result.messageId,
        verified_at: new Date().toISOString(),
      })
      .eq("project_id", id)
      .eq("test_state", "sending");
    if (error)
      throw new ApiError(
        503,
        "DATABASE",
        "The introduction was sent but could not be recorded. Refresh before retrying.",
      );
    return {
      message: `Introduction sent to ${people.data.client_name}. Photon accepted it; confirm the client received it before activating.`,
    };
  });
}
