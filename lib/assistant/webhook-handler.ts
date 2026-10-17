import "server-only";
import { randomUUID } from "node:crypto";
import type { InboxWriter, PhotonWebhookDecoder } from "./intake";
import { ingestPhotonWebhook } from "./intake";
import { IntakeError } from "./intake-error";

export async function readWebhookBody(request: Request): Promise<Uint8Array> {
  const limit = 256_000;
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) {
    throw new IntakeError("webhook_body_too_large", 413);
  }
  if (!request.body) throw new IntakeError("webhook_body_required", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new IntakeError("webhook_body_too_large", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

export function createWebhookHandler(dependencies: () => { decoder: PhotonWebhookDecoder; inbox: InboxWriter }) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = randomUUID();
    const headers = { "Cache-Control": "no-store" };
    try {
      const { decoder, inbox } = dependencies();
      const rawBody = await readWebhookBody(request);
      const receipt = await ingestPhotonWebhook(rawBody, request.headers, { decoder, inbox });
      // Nothing about a project, sender or private evidence is returned to Photon.
      return Response.json({ data: { received: true, duplicate: receipt.duplicate }, requestId }, { headers });
    } catch (error) {
      const known = error instanceof IntakeError;
      return Response.json({ error: { code: known ? error.code : "intake_storage_unavailable",
        message: known ? error.code : "Message intake could not be committed. Retry delivery." }, requestId },
      { status: known ? error.status : 503, headers });
    }
  };
}
