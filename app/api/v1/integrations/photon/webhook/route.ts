import { createWebhookHandler } from "@/lib/assistant/webhook-handler";
import { getDatabase } from "@/lib/db/postgres";
import { createInboxWriter } from "@/lib/db/inbox";
import { configuredPhotonWebhookDecoder } from "@/lib/photon/webhook";

export const runtime = "nodejs";
export const POST = createWebhookHandler(() => ({
  decoder: configuredPhotonWebhookDecoder(),
  inbox: createInboxWriter(getDatabase()),
}));
