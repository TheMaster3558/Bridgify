import { createWebhookHandler } from "@/lib/assistant/webhook-handler";
import { getDatabase } from "@/lib/db/postgres";
import { createProjectAutomationInbox } from "@/lib/assistant/automation";
import { configuredPhotonWebhookDecoder } from "@/lib/photon/webhook";

export const runtime = "nodejs";
export const POST = createWebhookHandler(() => ({
  decoder: configuredPhotonWebhookDecoder(),
  inbox: createProjectAutomationInbox(getDatabase()),
}));
