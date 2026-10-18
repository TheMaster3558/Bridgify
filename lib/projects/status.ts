// Project lifecycle in the dashboard is separate from the automation approval mode.
// review_only is a completed, activated setup whose requests still require owner approval.
export type ProjectListStatus =
  "draft" | "active" | "paused" | "completed" | "archived" | "unknown";
export function projectListStatus(status: string): ProjectListStatus {
  if (status === "review_only") return "active";
  if (["draft", "active", "paused", "completed", "archived"].includes(status))
    return status as ProjectListStatus;
  return "unknown";
}
