import { syncProjectAutomationHistory } from "../lib/assistant/sync-history";

void syncProjectAutomationHistory()
  .then((imported) => {
    console.log(
      `Stored ${imported} real history events. Run automation:worker to process the queue.`,
    );
    process.exit(0);
  })
  .catch(() => {
    console.error(
      "History import failed. Check database and Photon configuration; committed events can safely be imported again.",
    );
    process.exit(1);
  });
