import "server-only";
import { normalizedEventSchema, type NormalizedEvent } from "./contracts";
import { IntakeError } from "./intake-error";

/** Implement ONLY against the provisioned Photon webhook contract and captured,
 * sanitized real payloads. This intentionally supplies no guessed HMAC/header.
 * Must verify raw bytes, reject replay outside the vendor window, then normalize.
 */
export interface PhotonWebhookDecoder {
  verifyAndNormalize(rawBody: Uint8Array, headers: Headers): Promise<NormalizedEvent>;
}

export interface InboxWriter {
  /** One transaction: dedupe provider instance+event key, resolve exact active
   * binding, store message/revision, queue durable processing. Unknown binding,
   * owner/bot echo, preactivation and membership events cannot authorize work.
   * Return only after durable commit; failure must propagate to webhook caller.
   */
  persistVerifiedEvent(event: NormalizedEvent): Promise<{
    inboxEventId: string; duplicate: boolean;
  }>;
}

export async function ingestPhotonWebhook(
  rawBody: Uint8Array,
  headers: Headers,
  dependencies: { decoder?: PhotonWebhookDecoder; inbox: InboxWriter },
) {
  if (!dependencies.decoder) throw new IntakeError("photon_webhook_not_configured", 503);
  if (rawBody.byteLength > 256_000) throw new IntakeError("webhook_body_too_large", 413);
  const event = normalizedEventSchema.parse(
    await dependencies.decoder.verifyAndNormalize(rawBody, headers),
  );
  return dependencies.inbox.persistVerifiedEvent(event);
}
