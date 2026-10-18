import type { Bundle } from "@/lib/domain/types";

export function activationIssues(bundle: Pick<Bundle, "project" | "binding">) {
  const { project, binding } = bundle;
  const issues: Array<{ step: number; message: string }> = [];
  if (!project.scope_version)
    issues.push({ step: 2, message: "Review and confirm the agreement." });
  if (!project.people)
    issues.push({ step: 3, message: "Choose and save the client connection." });
  else if (!binding || binding.test_state !== "sent")
    issues.push({
      step: 3,
      message:
        binding?.test_state === "unknown" || binding?.test_state === "sending"
          ? "Check the pending introduction's delivery in People & chat before proceeding."
          : "Send the assistant introduction for the current client connection in People & chat.",
    });
  else if (
    !binding.verified_at ||
    !binding.disclosed_message_guid ||
    binding.hold_reason
  )
    issues.push({
      step: 3,
      message:
        binding.hold_reason ||
        "Verify that the introduction was recorded for the current client connection.",
    });
  if (!project.policy_version || !project.policy)
    issues.push({ step: 4, message: "Save your automation settings." });
  return issues;
}
