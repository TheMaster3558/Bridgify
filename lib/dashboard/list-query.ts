import { z } from "zod";
import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";

type Client = Awaited<ReturnType<typeof db>>;
export const PAGE_SIZE = 25;
export type SearchParams = Record<string, string | string[] | undefined>;
export type ListKind =
  "projects" | "tasks" | "decisions" | "proposals" | "requests" | "activity";
export function listInput(raw: SearchParams = {}) {
  const one = (key: string) =>
    typeof raw[key] === "string" ? (raw[key] as string) : undefined;
  return z
    .object({
      page: z.coerce.number().int().min(1).max(100000).catch(1),
      q: z.string().trim().max(100).catch(""),
      sort: z.string().max(30).catch("updated"),
      dir: z.enum(["asc", "desc"]).catch("desc"),
      reason: z.string().max(60).catch("all"),
      assignee: z.string().max(200).catch("all"),
      status: z.string().max(60).catch("all"),
      task: z.union([z.uuid(), z.literal("all")]).catch("all"),
      project: z.union([z.uuid(), z.literal("all")]).catch("all"),
    })
    .parse({
      page: one("page"),
      q: one("q"),
      sort: one("sort"),
      dir: one("dir"),
      status: one("status"),
      reason: one("reason"),
      assignee: one("assignee") || "all",
      project: one("project"),
      task: one("task"),
    });
}
export type ListInput = ReturnType<typeof listInput>;
const config = {
  projects: {
    table: "projects",
    search: "name",
    order: "updated_at",
    id: "id",
  },
  tasks: {
    table: "project_tasks",
    search: "title",
    order: "updated_at",
    id: "id",
  },
  decisions: {
    table: "owner_decisions",
    search: "title",
    order: "updated_at",
    id: "id",
  },
  proposals: {
    table: "proposal_revisions",
    search: "shared_terms->>title",
    order: "proposal_id",
    id: "revision",
  },
  requests: {
    table: "automation_requests",
    search: "summary",
    order: "created_at",
    id: "id",
  },
  activity: {
    table: "audit_events",
    search: "action",
    order: "created_at",
    id: "id",
  },
} as const;
// Proposal pills group several stored statuses.
const proposalGroups: Record<string, string[]> = {
  draft: ["draft", "changes_requested"],
  closed: ["superseded", "withdrawn", "expired", "declined", "rejected"],
};

// Filters shared by the page query and the status counts.
type Filterable = {
  eq(column: string, value: unknown): Filterable;
  in(column: string, values: unknown[]): Filterable;
  is(column: string, value: null): Filterable;
  ilike(column: string, pattern: string): Filterable;
};

function applyFilters<Q>(builder: Q, kind: ListKind, input: ListInput): Q {
  let query = builder as unknown as Filterable;
  const c = config[kind];
  if (input.project !== "all" && kind !== "projects")
    query = query.eq("project_id", input.project);
  if (kind === "requests" && input.task !== "all")
    query = query.eq("task_id", input.task);
  if (input.q)
    query = query.ilike(c.search, `%${input.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (kind === "decisions") {
    query = query.is("deleted_at", null);
    if (input.reason !== "all") query = query.eq("reason", input.reason);
  }
  if (kind === "tasks" && input.assignee !== "all")
    query = query.eq("assignee", input.assignee);
  if (input.status !== "all") {
    if (kind === "projects" && input.status === "active")
      query = query.in("status", ["active", "review_only"]);
    else if (kind === "decisions" && input.status === "open")
      query = query.in("status", ["open", "reviewing"]);
    else if (kind === "proposals" && proposalGroups[input.status])
      query = query.in("status", proposalGroups[input.status]);
    else if (kind !== "activity")
      query = query.eq(kind === "requests" ? "state" : "status", input.status);
  }
  return query as unknown as Q;
}

// How many rows each status (or reason) option would show with the other
// filters kept, for the counts on the filter pills.
export async function optionCounts(
  client: Client,
  kind: ListKind,
  input: ListInput,
  field: "status" | "reason" | "project" | "assignee",
  options: string[],
) {
  const results = await Promise.all(
    options.map(async (option) => {
      const result = await applyFilters(
        client
          .from(config[kind].table)
          .select(kind === "projects" ? "id" : "id,projects!inner(id)", {
            count: "exact",
            head: true,
          }),
        kind,
        { ...input, [field]: option },
      );
      checked(result);
      return [option, result.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<string, number>;
}

export async function queryList(
  client: Client,
  kind: ListKind,
  input: ListInput,
) {
  const c = config[kind];
  let query = applyFilters(
    client
      .from(c.table)
      .select(
        kind === "projects" ? "*" : "*,projects!inner(id,name,client_name)",
        { count: "exact" },
      ),
    kind,
    input,
  );
  const fields: Record<string, string> =
    kind === "projects"
      ? {
          name: "name",
          date: "agreed_due_date",
          value: "approved_total_cents",
          updated: "updated_at",
        }
      : kind === "tasks"
        ? {
            title: "title",
            priority: "priority",
            date: "agreed_due_date",
            updated: "updated_at",
          }
        : kind === "decisions"
          ? {
              client: "projects(client_name)",
              severity: "severity",
              updated: "updated_at",
            }
          : kind === "proposals"
            ? {
                title: "shared_terms->>title",
                price: "shared_terms->amount_cents",
                expires: "expires_at",
                default: "proposal_id",
              }
            : {};
  query = query
    .order(fields[input.sort] ?? c.order, { ascending: input.dir === "asc" })
    .order(c.id, { ascending: false });
  const result = await query.range(
    (input.page - 1) * PAGE_SIZE,
    input.page * PAGE_SIZE - 1,
  );
  const rows = checked(result) ?? [];
  const items = rows.map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    const p = row.projects as { name: string; client_name: string } | undefined;
    return p
      ? { ...row, project_name: p.name, client_name: p.client_name }
      : row;
  });
  return {
    items,
    total: result.count ?? 0,
    page: input.page,
    pageSize: PAGE_SIZE,
  };
}
export async function projectOptions(client: Client) {
  const result: {
    id: string;
    name: string;
    client_name: string;
    status: string;
  }[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows =
      checked(
        await client
          .from("projects")
          .select("id,name,client_name,status")
          .order("id")
          .range(offset, offset + 499),
      ) ?? [];
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}
