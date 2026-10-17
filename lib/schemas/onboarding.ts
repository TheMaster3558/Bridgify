import { z } from "zod";

export const basicsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  client_name: z.string().trim().min(1).max(120),
  original_amount_cents: z.number().int().min(0).max(100_000_000),
  currency: z.literal("USD"),
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
});
export const peopleSchema = z
  .object({
    owner_sender_id: z.string().trim().min(1).max(200),
    client_sender_id: z.string().trim().min(1).max(200),
    bot_sender_id: z.string().trim().min(1).max(200),
    instance_id: z.string().trim().min(1).max(200),
    chat_guid: z.string().trim().min(1).max(300),
    identities_confirmed: z.literal(true),
  })
  .refine(
    (v) =>
      new Set([v.owner_sender_id, v.client_sender_id, v.bot_sender_id]).size ===
      3,
    "Owner, client and bot must have distinct sender identities",
  );
export const policySchema = z
  .object({
    mode: z.enum(["enabled", "review_only"]),
    allowance_mode: z.enum(["per_request", "manual_rounds"]),
    allowance: z.number().int().min(0).max(10000),
    operations: z.array(z.enum(["replace_text", "change_color"])).max(2),
    targets: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
    exclusions: z.string().trim().min(1).max(4000),
    max_open_tasks: z.number().int().min(1).max(10),
    notifications: z.literal("dashboard"),
  })
  .refine(
    (v) => v.allowance_mode !== "manual_rounds" || v.mode === "review_only",
    "Revision rounds require review-only mode",
  )
  .refine(
    (v) => v.mode !== "enabled" || (v.allowance > 0 && v.operations.length > 0),
    "Enabled automation needs allowance and operations",
  );
export const invitationSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  proposal_id: z.string().uuid().nullable().default(null),
  revision: z.number().int().positive().nullable().default(null),
});
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
