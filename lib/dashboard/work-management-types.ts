export type DashboardProject = {
  id: string;
  name: string;
  client_name: string;
};

export type DashboardTask = {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  task_code: string;
  title: string;
  status: "ready" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "high" | "normal" | "low";
  assignee: string;
  agreed_due_date: string | null;
  origin: "auto" | "agreement" | "manual" | "proposal";
  origin_text: string;
  request_code: string | null;
  blocked_reason: string | null;
  operation: string | null;
  target_id: string | null;
  value: string | null;
  acceptance_criteria: string | null;
  source_text: string | null;
  source_meta: string | null;
  authorized_by: string | null;
  revision_unit: string | null;
  internal_note: string | null;
  history: string[];
  created_at: string;
  updated_at: string;
};

export type OwnerDecisionRecord = {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  decision_code: string;
  request_code: string;
  reason: string;
  title: string;
  severity: "warning" | "critical" | "info";
  status: "open" | "reviewing" | "resolved" | "dismissed";
  source_text: string;
  source_meta: string;
  evidence: string;
  evidence_source: string;
  explanation: string;
  missing_details: string[];
  suggested_options: { title: string; description: string }[];
  reply_preview: string;
  internal_note: string | null;
  history: string[];
  created_at: string;
  updated_at: string;
};

export type ProposalRevisionRecord = {
  proposal_id: string;
  revision: number;
  project_id: string;
  project_name: string;
  client_name: string;
  status: string;
  shared_terms: unknown;
  expires_at: string | null;
};
