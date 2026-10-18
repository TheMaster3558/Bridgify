import { setTimeout as sleep } from "node:timers/promises";
import { getDatabase } from "../lib/db/postgres";
import {
  createAutomationDelivery,
  createAutomationProcessor,
} from "../lib/assistant/automation";
import { createConfiguredMessageInterpreter } from "../lib/ai/interpret-messages";
import {
  readSpectrumCredentials,
  sendPhotonText,
} from "../lib/photon/spectrum";
import { syncProjectAutomationHistory } from "../lib/assistant/sync-history";

async function main() {
  if (process.env.AUTOMATION_WORKER_ENABLED !== "true")
    throw new Error("automation_worker_disabled");
  const database = getDatabase();
  const interpreter = createConfiguredMessageInterpreter();
  const { projectId } = readSpectrumCredentials();
  const intake = process.env.AUTOMATION_INTAKE ?? "history";
  if (!["history", "webhook"].includes(intake))
    throw new Error("invalid_automation_intake");
  if (
    intake === "webhook" &&
    process.env.PHOTON_WEBHOOK_INSTANCE_ID !== projectId
  )
    throw new Error("webhook_instance_must_match_spectrum_project");
  const processor = createAutomationProcessor(database, interpreter);
  const delivery = createAutomationDelivery(
    database,
    sendPhotonText,
    projectId,
  );
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  let nextSync = 0;
  while (!stopping) {
    try {
      if (intake === "history" && Date.now() >= nextSync) {
        // Authenticated provider history also recovers messages missed during
        // worker downtime; no public webhook or competing demo listener needed.
        nextSync = Date.now() + 30_000;
        try {
          await syncProjectAutomationHistory();
        } catch {
          console.error(
            "Photon history sync unavailable; retrying in 30 seconds. Existing queued work will continue.",
          );
        }
      }
      const processed = await processor.once();
      const sent = await delivery.once();
      if (!processed && !sent) await sleep(2000);
    } catch {
      console.error(
        "Automation dependency unavailable; check database and provider configuration.",
      );
      await sleep(5000);
    }
  }
}
void main().catch(() => {
  console.error(
    "Automation worker could not start. Check DATABASE_URL, Gemini, Spectrum and webhook configuration.",
  );
  process.exitCode = 1;
});
