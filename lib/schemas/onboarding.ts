import { z } from "zod";
import { INTRODUCTION } from "@/lib/domain/security";

export const chatIntroductionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  introduction: z
    .string()
    .trim()
    .min(1, "Write an introduction before sending it to your client.")
    .max(4000, "Keep the introduction to 4,000 characters or fewer.")
    .default(INTRODUCTION),
});

export const basicsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  client_name: z.string().trim().min(1).max(120),
  original_amount_cents: z.number().int().min(0).max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone, such as America/Los_Angeles"),
  agreed_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "Invalid calendar date",
    )
    .nullable(),
});
export const termSchema = z.object({
  kind: z.enum([
    "inclusion",
    "exclusion",
    "revision",
    "date",
    "responsibility",
  ]),
  text: z.string().trim().min(1).max(2000),
  span_id: z.string().uuid(),
  quote: z.string().min(1).max(4000),
});
export const scopeSchema = z.object({
  document_id: z.string().uuid(),
  terms: z.array(termSchema).min(1).max(100),
  reviewed_all_terms: z.literal(true),
  review: z.unknown().optional(),
});
// The owner only chooses a Photon user; contact details are read from Photon on the server.
export const peopleSelectionSchema = z.object({
  photon_user_id: z.string().trim().min(1).max(200),
});
export const peopleSchema = z.object({
  channel: z.literal("photon_shared"),
  photon_user_id: z.string().trim().min(1).max(200),
  client_name: z.string().trim().min(1).max(200),
  client_email: z.string().trim().max(254).nullable(),
  client_sender_id: z.string().trim().min(1).max(200),
  agent_number: z.string().trim().max(200).nullable(),
  instance_id: z.string().trim().min(1).max(200),
  chat_guid: z.string().trim().min(1).max(300),
});
export const policySchema = z
  .object({
    mode: z.enum(["enabled", "review_only"]),
    allowance_mode: z.enum(["per_request", "manual_rounds"]),
    allowance: z.number().int().min(0).max(10000),
    operations: z.array(z.enum(["replace_text", "change_color"])).max(2),
    targets: z.array(z.string().trim().min(1).max(200)).max(30),
    exclusions: z.string().trim().min(1).max(4000),
    max_open_tasks: z.number().int().min(1).max(10),
    notifications: z.literal("dashboard"),
    replies: z.object({
      progress_updates: z.boolean().default(false),
      status_questions: z.boolean(),
      clarifications: z.boolean(),
      review_acknowledgments: z.boolean(),
    }).default({ status_questions: true, clarifications: true, review_acknowledgments: true, progress_updates: false }),
  })
  .refine((v) => v.mode !== "enabled" || v.targets.length > 0, {
    message:
      "Choose at least one page or element before enabling automatic acceptance.",
    path: ["targets"],
  })
  .refine(
    (v) => v.allowance_mode !== "manual_rounds" || v.mode === "review_only",
    "Revision rounds require review-only mode",
  )
  .refine(
    (v) => v.mode !== "enabled" || (v.allowance > 0 && v.operations.length > 0),
    "Enabled automation needs allowance and operations",
  );
export const lifecycleSchema = z.object({
  status: z.enum(["active", "paused", "review_only", "completed", "archived"]),
  reason: z.string().trim().min(3).max(1000),
  disclosed: z.boolean().default(false),
});
export const mutationSchema = z.object({
  expectedVersion: z.number().int().positive(),
  section: z.enum(["basics", "people", "policy", "scope", "lifecycle"]),
  payload: z.unknown(),
});
export const sectionSchemas = {
  basics: basicsSchema,
  people: peopleSchema,
  policy: policySchema,
  scope: scopeSchema,
  lifecycle: lifecycleSchema,
};
export type Term = z.infer<typeof termSchema>;
export type Span = {
  id: string;
  page: number;
  start_offset: number;
  end_offset: number;
  text: string;
};
