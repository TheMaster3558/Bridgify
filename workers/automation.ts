import { runAutomationWorker } from "../lib/assistant/run-worker";

void runAutomationWorker().catch(() => {
  console.error(
    "Automation worker could not start. Check DATABASE_URL, Gemini, Spectrum and intake configuration.",
  );
  process.exitCode = 1;
});
