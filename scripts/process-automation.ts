import { getDatabase } from "../lib/db/postgres";
import { createAutomationProcessor } from "../lib/assistant/automation";
import { createConfiguredMessageInterpreter } from "../lib/ai/interpret-messages";

async function main() {
  const processor = createAutomationProcessor(
    getDatabase(),
    createConfiguredMessageInterpreter(),
  );
  let processed = 0;
  while (await processor.once()) processed++;
  console.log(
    `Processed ${processed} jobs into project tasks, review items and queued replies. No replies were submitted by this command.`,
  );
}
void main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      "Automation processing failed. Check database and Gemini configuration. Committed jobs are retained.",
    );
    process.exit(1);
  });
