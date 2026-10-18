import { runAutomationWorker } from "../lib/assistant/run-worker";

void runAutomationWorker({ intake: "sdk" }).catch(() => {
  console.error(
    "SDK automation could not start. Check private database, Gemini and Spectrum configuration.",
  );
  process.exitCode = 1;
});
