import { checked } from "@/lib/api";
import type { db } from "@/lib/db/server";
import type {
  DashboardProject,
  DashboardTask,
  OwnerDecisionRecord,
  ProposalRevisionRecord,
} from "@/lib/dashboard/work-management-types";

type Client = Awaited<ReturnType<typeof db>>;

async function projectsById(client: Client, ids: string[]) {
  if (!ids.length) return new Map<string, DashboardProject>();
  const rows = checked(
    await client
      .from("projects")
      .select("id,name,client_name")
      .in("id", ids),
  ) as DashboardProject[];
  return new Map(rows.map((project) => [project.id, project]));
}

export async function listDashboardTasks(client: Client) {
  const rows = checked(
    await client
      .from("project_tasks")
      .select("id,project_id,task_code,title,status,priority,assignee,agreed_due_date,origin,origin_text,request_code,blocked_reason,operation,target_id,value,acceptance_criteria,source_text,source_meta,authorized_by,revision_unit,internal_note,history,created_at,updated_at")
      .neq("status", "cancelled")
      .order("updated_at", { ascending: false }),
  ) as Omit<DashboardTask, "project_name" | "client_name">[];
  const projects = await projectsById(client, [...new Set(rows.map((row) => row.project_id))]);
  return rows.flatMap((row) => {
    const project = projects.get(row.project_id);
    return project ? [{ ...row, project_name: project.name, client_name: project.client_name }] : [];
  }) satisfies DashboardTask[];
}

export async function listOwnerDecisions(client: Client) {
  const rows = checked(
    await client
      .from("owner_decisions")
      .select("id,project_id,automation_request_id,decision_code,request_code,reason,title,severity,status,source_text,source_meta,evidence,evidence_source,explanation,missing_details,suggested_options,reply_preview,internal_note,history,created_at,updated_at")
      .in("status", ["open", "reviewing"])
      .order("updated_at", { ascending: false }),
  ) as Omit<OwnerDecisionRecord, "project_name" | "client_name">[];
  const projects = await projectsById(client, [...new Set(rows.map((row) => row.project_id))]);
  return rows.flatMap((row) => {
    const project = projects.get(row.project_id);
    return project ? [{ ...row, project_name: project.name, client_name: project.client_name }] : [];
  }) satisfies OwnerDecisionRecord[];
}

export async function listProposalRevisions(client: Client) {
  const rows = checked(
    await client
      .from("proposal_revisions")
      .select("proposal_id,revision,project_id,status,shared_terms,expires_at")
      .order("revision", { ascending: false }),
  ) as Omit<ProposalRevisionRecord, "project_name" | "client_name">[];
  const projects = await projectsById(client, [...new Set(rows.map((row) => row.project_id))]);
  return rows.flatMap((row) => {
    const project = projects.get(row.project_id);
    return project ? [{ ...row, project_name: project.name, client_name: project.client_name }] : [];
  }) satisfies ProposalRevisionRecord[];
}
