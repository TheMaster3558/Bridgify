import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export function membershipHash(participants: string[]) {
  return createHash("sha256")
    .update(JSON.stringify([...new Set(participants)].sort()))
    .digest("hex");
}
// This is our gateway contract, NOT an assertion about native Photon webhook payloads.
export const gatewayEventSchema = z
  .object({
    instanceId: z.string().min(1),
    eventKey: z.string().min(1).max(300),
    kind: z.enum(["message", "membership", "edit", "delete", "delivery"]),
    chatGuid: z.string().min(1),
    senderId: z.string().min(1).optional(),
    messageGuid: z.string().optional(),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    text: z.string().max(10000).optional(),
  })
  .strict();
export function verifyGateway(headers: Headers) {
  const secret = process.env.PHOTON_GATEWAY_SECRET;
  if (
    process.env.PHOTON_WEBHOOK_MODE !== "normalized-gateway-v1" ||
    !secret ||
    secret.length < 32
  )
    return false;
  const actual = Buffer.from(headers.get("authorization") || ""),
    expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
