import { adminDb } from "../lib/db/admin";
import { cleanupDeletedProject } from "../lib/db/project-deletion";
import { setTimeout as sleep } from "node:timers/promises";
let stopping = false;
process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});
async function main() {
  const client = adminDb();
  while (!stopping) {
    try {
      await cleanupDeletedProject(client);
    } catch {
      console.error("Project file cleanup unavailable; retrying.");
    }
    await sleep(5000);
  }
}
void main().catch(() => {
  console.error(
    "Project cleanup worker could not start. Check Supabase server configuration.",
  );
  process.exitCode = 1;
});
