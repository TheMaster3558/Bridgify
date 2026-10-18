import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";

type Client = Awaited<ReturnType<typeof db>>;

export type SidebarCounts = {
  tasks: number;
  decisions: number;
  proposals: number;
};

// Proposal statuses the Proposals page treats as approved or closed.
const SETTLED_PROPOSALS = [
  "approved",
  "superseded",
  "withdrawn",
  "expired",
  "rejected",
  "declined",
];

export async function getSidebarCounts(client: Client): Promise<SidebarCounts> {
  const [tasks, decisions, proposals] = await Promise.all([
    client
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["ready", "in_progress", "blocked"]),
    client
      .from("owner_decisions")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "reviewing"])
      .is("deleted_at", null),
    client
      .from("proposal_revisions")
      .select("proposal_id", { count: "exact", head: true })
      .not("status", "in", `(${SETTLED_PROPOSALS.join(",")})`),
  ]);
  checked(tasks);
  checked(decisions);
  checked(proposals);
  return {
    tasks: tasks.count ?? 0,
    decisions: decisions.count ?? 0,
    proposals: proposals.count ?? 0,
  };
}
