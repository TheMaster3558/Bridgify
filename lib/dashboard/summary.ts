import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";
type Client = Awaited<ReturnType<typeof db>>;
export async function workSummary(client: Client, projectId?: string) {
  const count = async (table: string, column: string, states: string[]) => {
    let q = client
      .from(table)
      .select("*", { head: true, count: "exact" })
      .in(column, states);
    if (projectId) q = q.eq("project_id", projectId);
    if (table === "owner_decisions") q = q.is("deleted_at", null);
    const r = await q;
    checked(r);
    return r.count ?? 0;
  };
  const [
    ready,
    inProgress,
    blocked,
    decisions,
    proposals,
    queued,
    unknown,
    failed,
  ] = await Promise.all([
    count("project_tasks", "status", ["ready"]),
    count("project_tasks", "status", ["in_progress"]),
    count("project_tasks", "status", ["blocked"]),
    count("owner_decisions", "status", ["open", "reviewing"]),
    count("proposal_revisions", "status", ["awaiting_client"]),
    count("automation_outbox", "state", ["queued"]),
    count("automation_outbox", "state", ["unknown", "failed"]),
    count("automation_jobs", "state", ["failed"]),
  ]);
  return {
    ready,
    inProgress,
    blocked,
    decisions,
    proposals,
    queued,
    unknown,
    failed,
  };
}
export type WorkSummary = Awaited<ReturnType<typeof workSummary>>;
export async function revisionSummary(client: Client, projectId: string) {
  const [accounting, uses, refunds] = await Promise.all([
    client.rpc("automation_accounting", { p_project: projectId }),
    client
      .from("automation_revision_uses")
      .select("request_id", { head: true, count: "exact" })
      .eq("project_id", projectId),
    client
      .from("automation_revision_refunds")
      .select("request_id", { head: true, count: "exact" })
      .eq("project_id", projectId),
  ]);
  checked(uses);
  checked(refunds);
  return {
    ...checked(accounting),
    grossRequests: uses.count ?? 0,
    requestRefunds: refunds.count ?? 0,
  } as {
    requestsUsed: number;
    roundsUsed: number;
    grossRequests: number;
    requestRefunds: number;
  };
}
