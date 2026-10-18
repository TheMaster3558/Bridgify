import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";
import { homeActivity } from "@/lib/dashboard/home-activity";

type Client = Awaited<ReturnType<typeof db>>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Four per page in the Home cards, three pages.
const LIST_SIZE = 12;

type ProjectRef = { name: string; client_name: string };

function project(value: unknown): ProjectRef {
  const p = (Array.isArray(value) ? value[0] : value) as ProjectRef | null;
  return { name: p?.name ?? "", client_name: p?.client_name ?? "" };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function centsOf(terms: Record<string, unknown>) {
  for (const key of [
    "amount_cents",
    "price_cents",
    "additional_price_cents",
    "total_cents",
  ]) {
    const value = terms[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

async function count(
  query: PromiseLike<{ count: number | null; error: unknown }>,
) {
  const result = await query;
  checked(result as never);
  return result.count ?? 0;
}

// Everything the Home overview shows, read from the same tables as Actionable
// Tasks, Needs Attention, Proposals and project automation.
export async function homeOverview(
  client: Client,
  now = new Date(),
  timeZone?: string,
) {
  const head = { head: true, count: "exact" } as const;
  const weekAgo = new Date(now.getTime() - WEEK_MS).toISOString();
  const [
    ready,
    inProgress,
    blocked,
    decisionCount,
    awaitingCount,
    handledThisWeek,
    failedJobs,
    deliveryUnknown,
    deliveryFailed,
    decisions,
    oldestDecision,
    awaiting,
    handled,
    work,
    deliveryIssues,
    activity,
  ] = await Promise.all([
    count(client.from("project_tasks").select("*", head).eq("status", "ready")),
    count(
      client
        .from("project_tasks")
        .select("*", head)
        .eq("status", "in_progress"),
    ),
    count(
      client.from("project_tasks").select("*", head).eq("status", "blocked"),
    ),
    count(
      client
        .from("owner_decisions")
        .select("*", head)
        .in("status", ["open", "reviewing"])
        .is("deleted_at", null),
    ),
    count(
      client
        .from("proposal_revisions")
        .select("*", head)
        .eq("status", "awaiting_client"),
    ),
    // Messages the assistant finished without routing them to the owner.
    count(
      client
        .from("automation_jobs")
        .select("*", head)
        .eq("state", "done")
        .is("review_reason", null)
        .gte("created_at", weekAgo),
    ),
    count(
      client.from("automation_jobs").select("*", head).eq("state", "failed"),
    ),
    count(
      client.from("automation_outbox").select("*", head).eq("state", "unknown"),
    ),
    count(
      client.from("automation_outbox").select("*", head).eq("state", "failed"),
    ),
    client
      .from("owner_decisions")
      .select(
        "id,project_id,title,reason,severity,request_code,created_at,projects!inner(name,client_name)",
      )
      .in("status", ["open", "reviewing"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(LIST_SIZE),
    client
      .from("owner_decisions")
      .select("created_at")
      .in("status", ["open", "reviewing"])
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    client
      .from("proposal_revisions")
      .select("proposal_id,revision,project_id,shared_terms,sent_at")
      .eq("status", "awaiting_client")
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("automation_requests")
      .select(
        "id,project_id,summary,state,clarification_turns,updated_at,project_tasks(task_code),projects!inner(name,client_name)",
      )
      .neq("state", "owner_review")
      .order("updated_at", { ascending: false })
      .limit(LIST_SIZE),
    client
      .from("project_tasks")
      .select(
        "id,project_id,task_code,title,status,priority,assignee,agreed_due_date,origin,origin_text,updated_at,projects!inner(name,client_name)",
      )
      .in("status", ["in_progress", "ready"])
      .order("updated_at", { ascending: false })
      .limit(50),
    client
      .from("automation_outbox")
      .select("id,project_id,state,text,updated_at")
      .in("state", ["unknown", "failed"])
      // Unknown delivery is the more urgent of the two: the client may or may
      // not have the message, so it sorts first.
      .order("state", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    homeActivity(client, now, timeZone),
  ]);

  const decisionRows = (checked(decisions) ?? []).map((d) => ({
    id: d.id as string,
    projectId: d.project_id as string,
    title: d.title as string,
    reason: d.reason as string,
    severity: d.severity as "critical" | "warning" | "info",
    requestCode: d.request_code as string,
    createdAt: d.created_at as string,
    project: project(d.projects),
  }));

  const proposal = checked(awaiting);
  const terms = record(proposal?.shared_terms);

  const priorityRank = { high: 0, normal: 1, low: 2 } as Record<string, number>;
  const workRows = (checked(work) ?? [])
    .map((t) => ({
      id: t.id as string,
      projectId: t.project_id as string,
      code: t.task_code as string,
      title: t.title as string,
      status: t.status as "ready" | "in_progress",
      priority: t.priority as "high" | "normal" | "low",
      assignee: t.assignee as string,
      agreedDueDate: t.agreed_due_date as string | null,
      origin: t.origin as "auto" | "agreement" | "manual" | "proposal",
      originText: t.origin_text as string,
      updatedAt: t.updated_at as string,
      project: project(t.projects),
    }))
    // Work already underway first, then by priority, then most recently touched.
    .sort(
      (a, b) =>
        Number(b.status === "in_progress") -
          Number(a.status === "in_progress") ||
        (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, 25);

  const latestIssue = checked(deliveryIssues);

  return {
    now: now.toISOString(),
    tasks: { ready, inProgress, blocked },
    decisions: {
      count: decisionCount,
      oldestAt:
        (checked(oldestDecision)?.created_at as string | undefined) ?? null,
      items: decisionRows,
    },
    proposals: {
      count: awaitingCount,
      latest: proposal
        ? {
            proposalId: proposal.proposal_id as string,
            projectId: proposal.project_id as string,
            revision: proposal.revision as number,
            title: typeof terms.title === "string" ? terms.title : null,
            cents: centsOf(terms),
            currency:
              typeof terms.currency === "string" ? terms.currency : "USD",
            sentAt: (proposal.sent_at as string | null) ?? null,
          }
        : null,
    },
    handledThisWeek,
    handled: (checked(handled) ?? []).map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      summary: r.summary as string,
      state: r.state as "awaiting_details" | "accepted" | "closed",
      clarificationTurns: (r.clarification_turns as number) ?? 0,
      taskCode:
        (record(
          Array.isArray(r.project_tasks) ? r.project_tasks[0] : r.project_tasks,
        ).task_code as string | undefined) ?? null,
      updatedAt: r.updated_at as string,
      project: project(r.projects),
    })),
    work: workRows,
    activity,
    issues: {
      deliveryUnknown,
      deliveryFailed,
      failedJobs,
      // The most recent delivery problem, for the banner.
      latest: latestIssue
        ? {
            projectId: latestIssue.project_id as string,
            state: latestIssue.state as "unknown" | "failed",
            text: latestIssue.text as string,
          }
        : null,
    },
  };
}

export type HomeOverview = Awaited<ReturnType<typeof homeOverview>>;
