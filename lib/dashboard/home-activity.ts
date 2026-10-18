import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";
import { bucketSeries, buildHeatmap } from "@/lib/dashboard/activity-series";

type Client = Awaited<ReturnType<typeof db>>;

const DAY_MS = 86_400_000;
const PAGE = 1000;
const MAX_PAGES = 20;

// Supabase caps each response at 1,000 rows, so read timestamps page by page.
async function timestamps(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: unknown;
  }>,
  column: string,
) {
  const values: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = checked(
      (await build(page * PAGE, page * PAGE + PAGE - 1)) as never,
    ) as Record<string, unknown>[] | null;
    for (const row of rows ?? []) values.push(String(row[column]));
    if (!rows || rows.length < PAGE) break;
  }
  return values;
}

export async function homeActivity(
  client: Client,
  now: Date,
  timeZone?: string,
) {
  // Five calendar years back covers the yearly view.
  const since = new Date(
    Date.UTC(now.getUTCFullYear() - 5, 0, 1),
  ).toISOString();
  const yearAgo = new Date(now.getTime() - 372 * DAY_MS).toISOString();
  const [completed, handled, messages, accepted] = await Promise.all([
    // There is no completion timestamp; a done task's last update is when it
    // was finished unless it was edited afterwards.
    timestamps(
      (from, to) =>
        client
          .from("project_tasks")
          .select("updated_at")
          .eq("status", "done")
          .gte("updated_at", since)
          .order("updated_at")
          .range(from, to),
      "updated_at",
    ),
    // Messages the assistant finished without routing them to the owner.
    timestamps(
      (from, to) =>
        client
          .from("automation_jobs")
          .select("created_at")
          .eq("state", "done")
          .is("review_reason", null)
          .gte("created_at", since)
          .order("created_at")
          .range(from, to),
      "created_at",
    ),
    timestamps(
      (from, to) =>
        client
          .from("automation_messages")
          .select("occurred_at")
          .gte("occurred_at", yearAgo)
          .order("occurred_at")
          .range(from, to),
      "occurred_at",
    ),
    client
      .from("automation_requests")
      .select("id", { head: true, count: "exact" })
      .not("task_id", "is", null)
      .gte("created_at", yearAgo),
  ]);
  checked(accepted as never);
  return {
    completed: bucketSeries(completed, now, timeZone),
    handled: bucketSeries(handled, now, timeZone),
    heatmap: buildHeatmap(messages, now, timeZone),
    requestsAccepted: accepted.count ?? 0,
  };
}

export type HomeActivity = Awaited<ReturnType<typeof homeActivity>>;
