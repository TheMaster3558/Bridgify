import type { OwnerMessageResult } from "../photon/history-contract";
import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError, checked } from "../api";
import type { db } from "./server";
import { adminDb } from "./admin";
import { peopleSchema } from "../schemas/onboarding";
import { connectionKey } from "../photon/message-history";
import {
  dmChatGuid,
  findPhotonUser,
  readSpectrumCredentials,
  sendPhotonText,
} from "../photon/spectrum";

export const ownerMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    connectionKey: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export async function sendProjectMessage(
  client: Awaited<ReturnType<typeof db>>,
  userId: string,
  projectId: string,
  requestKey: string,
  input: z.infer<typeof ownerMessageSchema>,
): Promise<OwnerMessageResult> {
  const id = z.uuid().parse(projectId);
  const body = ownerMessageSchema.parse(input);
  // This is the session client: owner RLS must succeed before any privileged write or provider call.
  const project = checked(
    await client
      .from("projects")
      .select("people,organization_id")
      .eq("id", id)
      .maybeSingle(),
  );
  if (!project)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Project unavailable to your account.",
    );
  const membership = checked(
    await client
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle(),
  );
  if (!membership)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only a workspace owner can send messages to the client.",
    );
  const people = peopleSchema.safeParse(project.people);
  if (!people.success)
    throw new ApiError(
      422,
      "SETUP_REQUIRED",
      "Connect a Photon client in People & chat first.",
    );
  const p = people.data;
  const connection = {
    projectId: id,
    instanceId: p.instance_id,
    userId: p.photon_user_id,
    address: p.client_sender_id,
    agentAddress: p.agent_number,
    chatGuid: p.chat_guid,
  };
  if (connectionKey(connection) !== body.connectionKey)
    throw new ApiError(
      409,
      "CONNECTION_CHANGED",
      "The connected client changed. Refresh the conversation before sending.",
    );
  try {
    if (
      readSpectrumCredentials().projectId !== p.instance_id ||
      p.chat_guid !== dmChatGuid(p.client_sender_id)
    )
      throw new Error();
    const user = await findPhotonUser(p.photon_user_id);
    if (
      user.phoneNumber !== p.client_sender_id ||
      user.assignedPhoneNumber !== p.agent_number
    )
      throw new Error();
  } catch {
    throw new ApiError(
      422,
      "PHOTON_CONNECTION",
      "The Photon connection could not be verified. Check People & chat before sending.",
    );
  }
  const admin = adminDb();
  const key = `owner-message:${requestKey}`;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ projectId: id, ...body }))
    .digest("hex");
  // Claim durably BEFORE sending. The existing receipt PK makes concurrent/repeated POSTs one send.
  const claim = await admin.from("command_receipts").insert({
    user_id: userId,
    key,
    fingerprint,
    result: { state: "sending", projectId: id },
  });
  if (claim.error?.code === "23505") {
    const prior = checked(
      await admin
        .from("command_receipts")
        .select("fingerprint,result")
        .eq("user_id", userId)
        .eq("key", key)
        .single(),
    );
    if (!prior || prior.fingerprint !== fingerprint)
      throw new ApiError(
        409,
        "CONFLICT",
        "This send attempt belongs to a different message. Refresh before sending.",
      );
    const result = prior.result as { state: string; messageId?: string };
    return {
      state:
        result.state === "sent"
          ? "sent"
          : result.state === "failed"
            ? "failed"
            : "unknown",
      ...(result.messageId ? { messageId: result.messageId } : {}),
    };
  }
  checked(claim); // A failed durable claim must never send a real message.
  let result: OwnerMessageResult;
  try {
    result = await sendPhotonText(p.client_sender_id, body.text);
  } catch {
    result = { state: "unknown" };
  }
  const saved = await admin
    .from("command_receipts")
    .update({ result: { ...result, projectId: id } })
    .eq("user_id", userId)
    .eq("key", key);
  // A timeout/crash or failed receipt update is never automatically re-sent.
  return saved.error ? { state: "unknown" } : result;
}
