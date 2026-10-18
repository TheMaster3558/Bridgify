import { createWebhookHandler } from "@/lib/assistant/webhook-handler";
import { getDatabase } from "@/lib/db/postgres";
import { createProjectAutomationInbox } from "@/lib/assistant/automation";
import { configuredPhotonWebhookDecoder } from "@/lib/photon/webhook";

import { after } from "next/server";
import { runAutomationBatch } from "@/lib/assistant/run-batch";
export const maxDuration = 60;
export const runtime = "nodejs";
export const POST = createWebhookHandler(() => ({
  decoder: configuredPhotonWebhookDecoder(),
  onCommitted: (eventId) =>
    after(async () => {
      const result = await getDatabase().query<{ project_id: string | null }>(
        "select project_id from automation_events where id=$1",
        [eventId],
      );
      if (result.rows[0]?.project_id)
        await runAutomationBatch(result.rows[0].project_id);
    }),
  inbox: createProjectAutomationInbox(getDatabase()),
}));
