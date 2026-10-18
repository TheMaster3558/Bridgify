import { runAutomationWorker } from "../lib/assistant/run-worker";

// Compatibility entry point: project messages must use the same persisted
// requests, owner approvals, tasks and outbox as the dashboard worker.
console.log(
  "Starting Bridgify project facilitator. Replies use saved project status and approval settings. Unconnected chats are not handled.",
);
void runAutomationWorker({ enabled: true }).catch(() => {
  console.error(
    "Project facilitator could not start. Check database, Gemini and Photon configuration. No generic chatbot fallback was started.",
  );
  process.exitCode = 1;
});
