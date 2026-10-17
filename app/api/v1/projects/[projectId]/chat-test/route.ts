import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, ApiError } from "@/lib/api";
import { adminDb } from "@/lib/db/admin";
import { peopleSchema } from "@/lib/schemas/onboarding";
import { photon, membershipHash } from "@/lib/photon/connection";
import { INTRODUCTION } from "@/lib/domain/security";
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId),
      { expectedVersion } = z
        .object({ expectedVersion: z.number().int().positive() })
        .parse(await readJson(request));
    const project = checked(
      await client.from("projects").select("*").eq("id", id).maybeSingle(),
    );
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project unavailable.");
    const people = peopleSchema.parse(project.people);
    if (people.bot_sender_id !== process.env.PHOTON_BOT_SENDER_ID)
      throw new ApiError(
        422,
        "BOT_IDENTITY",
        "Bot identity must match the provisioned sending account.",
      );
    const im = photon(people.instance_id);
    try {
      const chat = await im.chats.get(people.chat_guid);
      const members = chat.participants.map((p) => p.address);
      const expected = [people.owner_sender_id, people.client_sender_id];
      // Photon may omit the sending account from remote participants. Add only the provisioned bot identity.
      const all = [...new Set([...members, people.bot_sender_id])];
      if (
        !chat.isGroup ||
        chat.guid !== people.chat_guid ||
        !expected.every((id) => members.includes(id)) ||
        all.length !== 3
      )
        throw new ApiError(
          422,
          "MEMBERSHIP",
          "The exact group must contain the confirmed owner, client and provisioned bot, with no unknown participants.",
        );
      checked(
        await client.rpc("begin_chat_test", {
          p_project: id,
          p_expected: expectedVersion,
          p_participants: all,
          p_hash: membershipHash(all),
        }),
      );
      const admin = adminDb();
      try {
        const sent = await im.messages.sendText(
          people.chat_guid,
          INTRODUCTION,
          { clientMessageId: `bridgify-setup-${id}-${crypto.randomUUID()}` },
        );
        const { error } = await admin
          .from("chat_bindings")
          .update({
            test_state: "sent",
            test_message_guid: sent.guid,
            disclosed_message_guid: sent.guid,
          })
          .eq("project_id", id)
          .eq("test_state", "sending");
        if (error) throw new Error("commit");
        return {
          message:
            "Assistant introduction sent. Verification completes when the authenticated gateway returns the bot echo. Confirm participant consent before activation.",
        };
      } catch {
        await admin
          .from("chat_bindings")
          .update({
            test_state: "unknown",
            hold_reason:
              "Test delivery is unknown. Inspect provider records before retrying.",
          })
          .eq("project_id", id)
          .eq("test_state", "sending");
        throw new ApiError(
          503,
          "DELIVERY_UNKNOWN",
          "Test delivery is unknown. Do not resend until provider records have been inspected.",
        );
      }
    } finally {
      await im.close();
    }
  });
}
