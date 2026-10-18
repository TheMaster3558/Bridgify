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
      status: z.string().max(60).catch("all"),
      project: z.union([z.uuid(), z.literal("all")]).catch("all"),
    })
    .parse({
      page: one("page"),
      q: one("q"),
      sort: one("sort"),
      dir: one("dir"),
      status: one("status"),
      project: one("project"),
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
export async function queryList(
  client: Client,
  kind: ListKind,
  input: ListInput,
) {
  const c = config[kind];
  let query = client
    .from(c.table)
    .select(
      kind === "projects" ? "*" : "*,projects!inner(id,name,client_name)",
      { count: "exact" },
    );
  if (input.project !== "all" && kind !== "projects")
    query = query.eq("project_id", input.project);
  if (input.q)
    query = query.ilike(c.search, `%${input.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (kind === "decisions") query = query.is("deleted_at", null);
  if (input.status !== "all") {
    if (kind === "projects" && input.status === "active")
      query = query.in("status", ["active", "review_only"]);
    else if (kind === "decisions" && input.status === "open")
      query = query.in("status", ["open", "reviewing"]);
    else if (kind !== "activity")
      query = query.eq(kind === "requests" ? "state" : "status", input.status);
  }
  const fields: Record<string, string> =
    kind === "projects"
      ? {
          name: "name",
          date: "agreed_due_date",
          value: "original_amount_cents",
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
                price: "shared_terms->>amount_cents",
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
