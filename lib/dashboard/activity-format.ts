// Turns audit_events.action values ("section" or "section:verb") into
// sentences an owner can read in the project journal.

export type ActivityCategory =
  | "setup"
  | "lifecycle"
  | "requests"
  | "tasks"
  | "proposals"
  | "replies"
  | "connection";

export const activityCategories: { id: ActivityCategory; label: string; dot: string }[] = [
  { id: "requests", label: "Requests", dot: "bg-warn" },
  { id: "tasks", label: "Tasks", dot: "bg-info" },
  { id: "proposals", label: "Proposals", dot: "bg-violet-500" },
  { id: "replies", label: "Replies", dot: "bg-primary" },
  { id: "connection", label: "Connection", dot: "bg-cyan-500" },
  { id: "lifecycle", label: "Status", dot: "bg-ok" },
  { id: "setup", label: "Setup", dot: "bg-neutral-400" },
];

const sentences: Record<string, string> = {
  "lifecycle:active": "Project activated",
  "lifecycle:paused": "Project paused",
  "lifecycle:review_only": "Switched to review-only mode",
  "lifecycle:completed": "Project marked complete",
  "lifecycle:archived": "Project archived",
  basics: "Project basics updated",
  scope: "Agreement scope confirmed",
  people: "Client connection updated",
  policy: "Automation rules updated",
  document: "Agreement document added",
  invite: "Invitation sent",
  agreement_review: "Agreement review saved",
  agreement_retry: "Agreement extraction retried",
  "automation:accepted": "Bridgify accepted a request and created a task",
  "automation:owner_review": "Bridgify sent a request to you for review",
  "automation:task_status": "Task status changed",
  "automation:analysis_archive": "Old analysis archived",
  "automation:receipt_reconciled": "Reply delivery confirmed",
  "automation:outbox_edit": "Queued reply edited",
  "automation:outbox_cancel": "Queued reply cancelled",
  "automation:outbox_retry": "Reply retry queued",
  "automation:retry_analysis": "Failed analysis retried",
  "automation:round_open": "Feedback round opened",
  "automation:round_add": "Request added to a feedback round",
  "automation:round_close": "Feedback round closed",
  "automation:round_refund": "Feedback round refunded",
  "automation:request_refund": "Included request refunded",
  "automation:amend_policy": "Automation rules amended",
  "automation:apply_change": "Client correction applied to a task",
  "request:clarify": "Bridgify asked the client for details",
  "proposal:create": "Proposal drafted",
  "proposal:replace": "Proposal revised",
  "proposal:withdraw": "Proposal withdrawn",
  "proposal:send": "Proposal sent to the client",
  "proposal:expired": "Proposal expired",
  "proposal:response:approved": "Client approved a proposal",
  "proposal:response:declined": "Client declined a proposal",
  "proposal:response:changes_requested": "Client asked for proposal changes",
  "task:create": "Task created",
  "task:edit": "Task details edited",
  "task:status": "Task status changed",
  "connection:retry_authorized": "Connection retry authorised",
  "connection:receipt_verified": "Client connection verified",
};

export function activityCategory(action: string): ActivityCategory {
  const [section] = action.split(":");
  if (section === "lifecycle") return "lifecycle";
  if (section === "proposal") return "proposals";
  if (section === "task" || action === "automation:task_status") return "tasks";
  if (section === "request" || action === "automation:accepted" || action === "automation:owner_review") return "requests";
  if (section === "connection" || section === "people") return "connection";
  if (action.startsWith("automation:outbox") || action === "automation:receipt_reconciled") return "replies";
  if (section === "automation") return "requests";
  return "setup";
}

function readable(text: string) {
  const words = text.replaceAll(":", " ").replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function activitySentence(action: string) {
  if (sentences[action]) return sentences[action];
  if (action.startsWith("lifecycle:")) return `Project status changed to ${readable(action.slice(10)).toLowerCase()}`;
  return readable(action);
}

/** Who did it, from the owner's point of view. */
export function activityActor(actorId: unknown, viewerId: string) {
  if (!actorId) return "Bridgify";
  return actorId === viewerId ? "You" : "A teammate";
}

const linkKeys = new Set(["taskId", "requestId", "decisionId", "proposalId"]);

/** Details worth showing as plain key/value pairs (ids become links instead). */
export function activityFacts(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const facts: [string, string][] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (linkKeys.has(key) || key === "reason" || value === null || value === undefined || value === "") continue;
    const label = readable(key.replace(/([a-z])([A-Z])/g, "$1 $2")).toLowerCase();
    const text =
      typeof value === "object"
        ? JSON.stringify(value)
        : typeof value === "boolean"
          ? value
            ? "yes"
            : "no"
          : String(value).replaceAll("_", " ");
    facts.push([label.charAt(0).toUpperCase() + label.slice(1), text]);
  }
  return facts;
}
