import { z } from "zod";

// Application contracts, NOT Photon wire payloads or database table definitions.
const id = z.string().trim().min(1).max(256);
const version = z.number().int().positive();
export const routineOperationSchema = z.enum(["replace_text", "change_color"]);
export const normalizedEventSchema = z.object({
  instanceId: id,
  eventKey: id,
  kind: z.enum(["message", "edit", "delete", "membership", "delivery"]),
  chatGuid: id,
  senderId: id.optional(),
  messageGuid: id.optional(),
  occurredAt: z.iso.datetime().optional(),
  text: z.string().max(30_000).optional(),
  fromBot: z.boolean(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  contentType: z.string().min(1).max(100).optional(),
  providerContentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().superRefine((event, ctx) => {
  if (["message", "edit", "delete"].includes(event.kind) && !event.messageGuid) {
    ctx.addIssue({ code: "custom", message: "Message identity required" });
  }
  if (["message", "edit"].includes(event.kind) && !event.senderId) {
    ctx.addIssue({ code: "custom", message: "Sender identity required" });
  }
});
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;

export const snapshotSchema = z.object({
  organizationId: id, projectId: id, conversationId: id,
  requestId: id, requestRevision: version,
  expectedScopeVersion: version, expectedPolicyVersion: version,
  inputWatermark: id,
}).strict();
export type RequestSnapshot = z.infer<typeof snapshotSchema>;

export const acceptanceCandidateSchema = snapshotSchema.extend({
  operation: routineOperationSchema,
  scopeItemId: id, targetId: id,
  normalizedPayload: z.object({
    replacementText: z.string().min(1).max(4000).optional(),
    locator: z.string().min(1).max(1000).optional(),
    color: z.string().min(1).max(100).optional(),
  }).strict(),
  sourceMessageRevisionIds: z.array(id).min(1).max(20),
}).superRefine((candidate, ctx) => {
  const p = candidate.normalizedPayload;
  if (candidate.operation === "replace_text" && (!p.replacementText || !p.locator || p.color)) {
    ctx.addIssue({ code: "custom", message: "Text operation requires locator and replacement only" });
  }
  if (candidate.operation === "change_color" && (!p.color || p.locator || p.replacementText)) {
    ctx.addIssue({ code: "custom", message: "Color operation requires color only" });
  }
});
export type AcceptanceCandidate = z.infer<typeof acceptanceCandidateSchema>;
export const acceptanceCommandSchema = acceptanceCandidateSchema.safeExtend({ idempotencyKey: id });
export type AcceptanceCommand = z.infer<typeof acceptanceCommandSchema>;

export const decisionReasonSchema = z.enum([
  "scope_addition", "exhausted_allowance", "ambiguous_request", "deadline_change",
  "conflicting_request", "unknown_participant", "unsupported_input",
  "failed_processing", "delivery_unknown", "policy_denied",
]);
export type DecisionReason = z.infer<typeof decisionReasonSchema>;
export type DeliveryResult =
  | { state: "sent"; providerMessageGuid: string }
  | { state: "unknown"; code: "submission_uncertain" }
  | { state: "failed"; code: "provider_rejected"; retryable: boolean };

export interface MessagingSender {
  // Destination comes from the persisted outbox and binding, never model output.
  sendText(input: {
    chatGuid: string; text: string; dedupeKey: string; replyToMessageGuid?: string;
  }): Promise<DeliveryResult>;
}

/** Missing database implementation. Every command must enforce tenancy itself. */
export interface AssistantDomain {
  /** Reload authority, scope, policy, requester, cutoff, watermark and capacity.
   * Lock bucket; reserve + authorization + task + audit + templated outbox in ONE
   * transaction. Unique request revision/idempotency keys; no network in locks.
   */
  acceptRoutine(input: AcceptanceCommand): Promise<
    | { kind: "accepted"; taskId: string; outboxId: string; replayed: boolean }
    | { kind: "rejected"; reason: DecisionReason | "stale_snapshot" }
  >;
  /** Private dashboard decision + owner notification + optional neutral public
   * acknowledgment, atomically and deduplicated. Never send private notes to chat.
   */
  escalate(input: RequestSnapshot & {
    reason: DecisionReason; sourceMessageRevisionIds: string[]; idempotencyKey: string;
  }): Promise<{ decisionId: string; replayed: boolean }>;
  /** Recheck versions and requester; max two turns; no revision reservation.
   * Render a controlled question from missing fields; record awaiting_details
   * and outbox together. Ambiguous follow-up matching must escalate.
   */
  clarify(input: RequestSnapshot & {
    missingFields: Array<"target" | "replacement_text" | "locator" | "color">;
    sourceMessageRevisionIds: string[]; idempotencyKey: string;
  }): Promise<{ kind: "queued"; outboxId: string } | { kind: "owner_review_required" }>;
}
