import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PhotonWebhookDecoder } from "../assistant/intake";
import { IntakeError } from "../assistant/intake-error";

// Spectrum Cloud wire contract, verified against Photon's official adapter:
// photon-hq/vercel-chat-adapter-imessage/src/internal/webhook.ts and inbound.ts.
// This is NOT the older photon-hq/webhook bridge protocol (X-Photon-*).
const providerId = z.string().min(1).max(256);
const spaceSchema = z.object({ id: providerId, phone: z.string().optional() }).passthrough();
const wireSchema = z.object({
  event: z.literal("messages"), space: spaceSchema,
  message: z.object({
    id: providerId, sender: z.object({ id: providerId }).passthrough(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    timestamp: z.iso.datetime({ offset: true }).optional(),
    space: spaceSchema.optional(),
    content: z.object({ type: z.string().min(1).max(100) }).passthrough(),
  }).passthrough(),
}).passthrough();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createSpectrumWebhookDecoder(config: {
  signingSecret: string; instanceId: string; phone?: string; now?: () => number;
}): PhotonWebhookDecoder {
  if (!config.signingSecret.trim() || !config.instanceId.trim()) {
    throw new IntakeError("photon_webhook_not_configured", 503);
  }
  return {
    async verifyAndNormalize(rawBody, headers) {
      const signature = headers.get("x-spectrum-signature");
      const timestamp = headers.get("x-spectrum-timestamp");
      if (!signature || !/^v0=[a-f0-9]{64}$/.test(signature) || !timestamp || !/^\d{1,12}$/.test(timestamp)) {
        throw new IntakeError("invalid_webhook_verification", 401);
      }
      const now = config.now?.() ?? Date.now();
      if (Math.abs(now / 1000 - Number(timestamp)) > 300) throw new IntakeError("stale_webhook_delivery", 401);
      const expected = `v0=${createHmac("sha256", config.signingSecret)
        .update(`v0:${timestamp}:`).update(rawBody).digest("hex")}`;
      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new IntakeError("invalid_webhook_verification", 401);
      }
      let raw: unknown;
      try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)); }
      catch { throw new IntakeError("invalid_webhook_json", 400); }
      if (!raw || typeof raw !== "object" || !("event" in raw) || raw.event !== "messages") {
        throw new IntakeError("unsupported_photon_event", 422);
      }
      const parsed = wireSchema.safeParse(raw);
      if (!parsed.success) throw new IntakeError("unsupported_photon_payload", 422);
      const { message, space } = parsed.data;
      if (message.space && message.space.id !== space.id) throw new IntakeError("conflicting_photon_chat", 422);
      if (config.phone && space.phone !== config.phone) throw new IntakeError("unlinked_photon_line", 422);
      const contentType = message.content.type;
      const membership = ["addMember", "removeMember", "leaveSpace"].includes(contentType);
      // Cloud currently documents new-message delivery, not edit/delete frames.
      // Never reinterpret an unknown mutation as a fresh client request.
      if (["edit", "delete", "unsend"].includes(contentType)) throw new IntakeError("unsupported_photon_mutation", 422);
      const text = contentType === "text" ? message.content.text : undefined;
      if (contentType === "text" && (typeof text !== "string" || text.length > 30_000)) {
        throw new IntakeError("invalid_photon_text", 422);
      }
      return {
        instanceId: config.instanceId,
        eventKey: `spectrum:${createHash("sha256").update(JSON.stringify([space.id, message.id])).digest("hex")}`,
        kind: membership ? "membership" : "message",
        chatGuid: space.id, senderId: message.sender.id, messageGuid: message.id,
        ...(message.timestamp ? { occurredAt: new Date(message.timestamp).toISOString() } : {}),
        ...(typeof text === "string" ? { text } : {}),
        ...(message.direction ? { direction: message.direction } : {}),
        contentType, providerContentHash: createHash("sha256").update(canonical(message.content)).digest("hex"),
        // Outbound alone doesn't identify the bot. Persisted participant bindings do.
        fromBot: false,
      };
    },
  };
}

export function configuredPhotonWebhookDecoder(env = process.env): PhotonWebhookDecoder {
  // Explicit protocol choice is required. No fallback, unsigned mode, or guessed
  // "X-Photon-Signature" handling just because a token happens to be configured.
  if (env.PHOTON_WEBHOOK_PROTOCOL !== "spectrum-cloud-v0" ||
      !env.PHOTON_WEBHOOK_SIGNING_SECRET || !env.PHOTON_WEBHOOK_INSTANCE_ID) {
    throw new IntakeError("photon_webhook_not_configured", 503);
  }
  return createSpectrumWebhookDecoder({
    signingSecret: env.PHOTON_WEBHOOK_SIGNING_SECRET,
    instanceId: env.PHOTON_WEBHOOK_INSTANCE_ID,
    phone: env.PHOTON_WEBHOOK_PHONE,
  });
}
