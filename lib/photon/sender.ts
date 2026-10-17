import "server-only";
import {
  createHttpClient, AuthenticationError, NotFoundError, RateLimitError, ValidationError,
} from "@photon-ai/advanced-imessage/http";
import { z } from "zod";
import { readPhotonConfig } from "../assistant/config";
import type { MessagingSender } from "../assistant/contracts";

type PhotonClient = {
  messages: Pick<ReturnType<typeof createHttpClient>["messages"], "sendText">;
};
const sendSchema = z.object({
  chatGuid: z.string().min(1).max(256), text: z.string().min(1).max(8000),
  dedupeKey: z.string().min(1).max(256),
  replyToMessageGuid: z.string().min(1).max(256).optional(),
}).strict();

/** Caller leases a persisted outbox row before calling, then persists the result.
 * This adapter itself performs no persistence, authorization, retries or sends
 * at module load. A successful SDK return is "sent", not device-delivered/read.
 */
export function createPhotonSender(client: PhotonClient): MessagingSender {
  return {
    async sendText(input) {
      const data = sendSchema.parse(input);
      try {
        const sent = await client.messages.sendText(data.chatGuid, data.text, {
          clientMessageId: data.dedupeKey,
          ...(data.replyToMessageGuid ? { replyTo: data.replyToMessageGuid } : {}),
        });
        if (!sent.guid) return { state: "unknown", code: "submission_uncertain" };
        return { state: "sent", providerMessageGuid: sent.guid };
      } catch (error) {
        if (error instanceof AuthenticationError || error instanceof NotFoundError ||
            error instanceof RateLimitError || error instanceof ValidationError) {
          // Duplicate-message responses mean the original may have succeeded.
          if (error.code === "duplicateMessage") {
            return { state: "unknown", code: "submission_uncertain" };
          }
          return { state: "failed", code: "provider_rejected", retryable: error instanceof RateLimitError && error.retryable };
        }
        // Network/timeout/unrecognized failures may follow provider acceptance.
        return { state: "unknown", code: "submission_uncertain" };
      }
    },
  };
}

export function createConfiguredPhotonSender(): MessagingSender {
  const config = readPhotonConfig();
  return createPhotonSender(createHttpClient({
    address: config.PHOTON_HTTP_ADDRESS, token: config.PHOTON_TOKEN,
    server: config.PHOTON_INSTANCE_ID, timeout: 10_000,
    retry: false, autoIdempotency: true,
  }));
}
