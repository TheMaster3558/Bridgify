import { setTimeout as sleep } from "node:timers/promises";
import { getDatabase } from "../db/postgres";
import { createProjectAutomationInbox } from "./automation";
import { readSpectrumCredentials } from "../photon/spectrum";
import { runSpectrumSdkListener } from "../photon/sdk-listener";
import { syncProjectAutomationHistory } from "./sync-history";
import { runAutomationBatch } from "./run-batch";

export async function runAutomationWorker(
  options: {
    enabled?: boolean;
    intake?: "sdk" | "history" | "webhook";
    signal?: AbortSignal;
  } = {},
) {
  const enabled =
    options.enabled ?? process.env.AUTOMATION_WORKER_ENABLED === "true";
  if (!enabled) throw new Error("automation_worker_disabled");
  const database = getDatabase();
  const { projectId } = readSpectrumCredentials();
  const intake = options.intake ?? process.env.AUTOMATION_INTAKE ?? "webhook";
  if (!["sdk", "history", "webhook"].includes(intake))
    throw new Error("invalid_automation_intake");
  if (
    intake === "webhook" &&
    process.env.PHOTON_WEBHOOK_INSTANCE_ID !== projectId
  )
    throw new Error("webhook_instance_must_match_spectrum_project");
  const stopping = new AbortController();
  const stop = () => stopping.abort();
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) stopping.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let wakePending = false;
  let idle: AbortController | undefined;
  const wake = () => {
    wakePending = true;
    idle?.abort();
  };
  stopping.signal.addEventListener("abort", wake, { once: true });
  const wait = async (ms: number) => {
    if (wakePending || stopping.signal.aborted) {
      wakePending = false;
      return;
    }
    idle = new AbortController();
    try {
      await sleep(ms, undefined, { signal: idle.signal });
    } catch (error) {
      if (!idle.signal.aborted) throw error;
    } finally {
      idle = undefined;
      wakePending = false;
    }
  };
  const listener =
    intake === "sdk"
      ? runSpectrumSdkListener({
          instanceId: projectId,
          inbox: createProjectAutomationInbox(database),
          signal: stopping.signal,
          catchUp: (signal) =>
            syncProjectAutomationHistory({ instanceId: projectId, signal }),
          onCommitted: wake,
          notice: (message) => console.log(message),
        })
      : undefined;
  console.log(
    `Automation intake: ${intake}. Replies use saved project settings and the shared outbox.`,
  );
  let nextSync = 0;
  try {
    while (!stopping.signal.aborted) {
      try {
        if (intake === "history" && Date.now() >= nextSync) {
          // Authenticated provider history also recovers messages missed during
          // worker downtime; no public webhook or competing demo listener needed.
          nextSync = Date.now() + 30_000;
          try {
            await syncProjectAutomationHistory({
              instanceId: projectId,
              signal: stopping.signal,
            });
          } catch {
            console.error(
              "Photon history sync unavailable; retrying in 30 seconds. Existing queued work will continue.",
            );
          }
        }
        // SDK arrival wakes this pump immediately. The timeout recovers durable
        // retries and owner-queued replies; it never polls incoming SDK history.
        const { processed, sent } = await runAutomationBatch(undefined, {
          enabled,
        });
        if (!processed && !sent) await wait(2000);
      } catch {
        console.error(
          "Automation dependency unavailable; check database and provider configuration.",
        );
        await wait(5000);
      }
    }
  } finally {
    stopping.abort();
    await listener;
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    options.signal?.removeEventListener("abort", stop);
    stopping.signal.removeEventListener("abort", wake);
  }
}
