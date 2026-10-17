export type ImessageConnection = "connected" | "disconnected";

export type Project = {
  id: string;
  name: string;
  clientName: string;
  imessage: ImessageConnection;
};

export type TaskStatus = "ready" | "in_progress" | "blocked" | "done" | "cancelled";

export type TaskPriority = "low" | "normal" | "high";

export type SourceMessage = {
  id: string;
  author: string;
  at: string;
  body: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  internalTargetDate: string | null;
  clientAgreedDate: string | null;
  sourceMessage: string;
  messageHistory: SourceMessage[];
};

export type DecisionReason =
  | "exhausted_allowance"
  | "scope_addition"
  | "deadline_change"
  | "ambiguous_request";

export type Decision = {
  id: string;
  projectId: string;
  reason: DecisionReason;
  reasonLabel: string;
  clientMessage: string;
  recommendedAction: string;
  evidence: string;
};

export type ProposalSummaryStatus = "awaiting_client" | "draft" | "approved";

export type ProposalSummary = {
  id: string;
  projectId: string;
  status: ProposalSummaryStatus;
};
