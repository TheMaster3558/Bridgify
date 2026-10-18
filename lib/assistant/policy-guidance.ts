export const AUTOMATIC_ACCEPTANCE_GUIDANCE =
  "Accept clear, small changes to existing deliverables when the confirmed agreement includes the work: text and content updates, visual styling, spacing and layout adjustments, and replacing supplied images or assets. Ask for missing details. Send uncertain requests, new features, new deliverables, price changes and deadline changes to me for review.";
export const MANUAL_ACCEPTANCE_GUIDANCE =
  "Send every change request to me for approval. Use the confirmed agreement to explain scope and ask for missing details.";

export function initialAcceptanceGuidance(
  policy:
    | {
        mode: string;
        permission_mode?: string;
        acceptance_guidance?: string;
        operations?: string[];
      }
    | null
    | undefined,
) {
  if (policy?.acceptance_guidance !== undefined)
    return policy.acceptance_guidance;
  if (policy?.mode !== "enabled") return MANUAL_ACCEPTANCE_GUIDANCE;
  // Translate previously saved permissions conservatively when the owner edits
  // them. Merely opening this form never changes the saved policy.
  const operations = (policy.operations ?? []).map((op) =>
    op === "replace_text"
      ? "replacing existing text"
      : "changing an existing element's color",
  );
  return policy.permission_mode !== "guidance" && operations.length
    ? `Automatically accept only ${operations.join(" and ")} when covered by the confirmed agreement. Send every other change to me for review.`
    : AUTOMATIC_ACCEPTANCE_GUIDANCE;
}
