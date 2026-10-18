import { centsFromInput } from "@/lib/domain/security";
import {
  basicsSchema,
  policySchema,
  type Span,
} from "@/lib/schemas/onboarding";
import {
  reviewedAgreementSchema,
  type AgreementReview,
} from "@/lib/schemas/agreement";

export type FieldErrors = Record<string, string>;
const currencyCodes = new Set(Intl.supportedValuesOf("currency"));
export const DEFAULT_SETUP_POLICY = {
  mode: "review_only",
  allowance_mode: "per_request",
  allowance: 0,
  operations: [] as ("replace_text" | "change_color")[],
  targets: [] as string[],
  exclusions:
    "New pages, accounts, payments, integrations, price changes and deadline changes always need my approval.",
  max_open_tasks: 10,
  notifications: "dashboard",
} as const;
export const termGroups = [
  {
    kind: "inclusion",
    label: "Included work",
    description: "What you agreed to deliver.",
  },
  {
    kind: "exclusion",
    label: "Not included",
    description: "Work outside this agreement.",
  },
  {
    kind: "revision",
    label: "Changes and revisions",
    description: "How changes to delivered work are handled.",
  },
  {
    kind: "date",
    label: "Dates and deadlines",
    description: "Completion dates, milestones and timing.",
  },
  {
    kind: "responsibility",
    label: "Who does what",
    description: "What you and your client each need to provide or do.",
  },
] as const;

export function basicsPayload(form: FormData) {
  return {
    name: String(form.get("name") || "").trim(),
    client_name: String(form.get("client_name") || "").trim(),
    original_amount_cents: centsFromInput(
      String(form.get("price") || "").trim(),
    ),
    currency: String(form.get("currency") || "")
      .trim()
      .toUpperCase(),
    timezone: String(form.get("timezone") || "").trim(),
    agreed_due_date: String(form.get("due") || "") || null,
  };
}

export function validateBasics(form: FormData): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, label] of [
    ["name", "project name"],
    ["client_name", "client name"],
  ]) {
    const value = String(form.get(key) || "").trim();
    if (!value) errors[key] = `Enter a ${label}.`;
    else if (value.length > 120)
      errors[key] = `Keep the ${label} to 120 characters or fewer.`;
  }
  try {
    centsFromInput(String(form.get("price") || "").trim());
  } catch {
    errors.price =
      "Enter a price from 0 to 1,000,000 with no more than two decimal places (for example, 250.00).";
  }
  const currency = String(form.get("currency") || "")
    .trim()
    .toUpperCase();
  if (!currencyCodes.has(currency))
    errors.currency = "Choose a currency code, such as USD, EUR or GBP.";
  const timezone = String(form.get("timezone") || "").trim();
  if (!timezone || !basicsSchema.shape.timezone.safeParse(timezone).success)
    errors.timezone =
      "Choose a time zone, such as America/Los_Angeles or Europe/London.";
  if (
    !basicsSchema.shape.agreed_due_date.safeParse(
      String(form.get("due") || "") || null,
    ).success
  )
    errors.due =
      "Enter a real completion date, or leave this blank if no date was agreed.";
  return errors;
}

export function policyPayload(form: FormData) {
  return {
    mode: String(form.get("mode")),
    allowance_mode: String(form.get("allowance_mode")),
    allowance: Number(form.get("allowance")),
    permission_mode: "guidance" as const,
    acceptance_guidance: String(form.get("acceptance_guidance") || "").trim(),
    operations: [],
    targets: [
      ...new Set(
        String(form.get("targets") || "")
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
    exclusions: String(form.get("exclusions") || "").trim(),
    max_open_tasks: Number(form.get("max_open_tasks")),
    notifications: "dashboard" as const,
    replies: {
      progress_updates: form.get("reply_progress_updates") === "on",
      status_questions: form.get("reply_status_questions") !== "off",
      clarifications: form.get("reply_clarifications") !== "off",
      review_acknowledgments:
        form.get("reply_review_acknowledgments") !== "off",
    },
  };
}

export function validatePolicy(form: FormData): FieldErrors {
  const value = policyPayload(form),
    errors: FieldErrors = {};
  if (!["enabled", "review_only"].includes(value.mode))
    errors.mode = "Choose how you want requests handled.";
  if (!["per_request", "manual_rounds"].includes(value.allowance_mode))
    errors.allowance_mode = "Choose individual requests or rounds of feedback.";
  for (const [key, min, max, label] of [
    ["allowance", 0, 10000, "included changes"],
    ["max_open_tasks", 1, 10, "open tasks"],
  ] as const) {
    const raw = String(form.get(key) ?? "").trim();
    if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max)
      errors[key] = `Enter a whole number of ${label} from ${min} to ${max}.`;
  }
  if (value.targets.length > 30 || value.targets.some((t) => t.length > 200))
    errors.targets =
      "Enter at most 30 optional page or element limits, one per line, with no more than 200 characters each.";
  if (!value.exclusions || value.exclusions.length > 4000)
    errors.exclusions =
      "Describe what the assistant must leave for your approval, using 1–4,000 characters.";
  if (value.mode === "enabled") {
    if (value.allowance_mode === "manual_rounds")
      errors.allowance_mode =
        "Rounds group several changes together. Choose manual approval to use rounds.";
    if (value.allowance < 1)
      errors.allowance =
        "Automatic acceptance needs at least one included change. Otherwise choose manual approval.";
    if (!value.acceptance_guidance || value.acceptance_guidance.length > 4000)
      errors.acceptance_guidance =
        "Describe the changes that may be accepted automatically, using 1–4,000 characters.";
  }
  // Keep the browser in step with the API's policy boundary.
  const parsed = policySchema.safeParse(value);
  if (!parsed.success && !Object.keys(errors).length)
    errors.mode = "Check your request handling settings before continuing.";
  return errors;
}

export function agreementErrors(
  review: AgreementReview,
  spans: Span[],
  project: {
    original_amount_cents: number;
    currency: string;
    agreed_due_date: string | null;
  },
): FieldErrors {
  const errors: FieldErrors = {};
  const parsed = reviewedAgreementSchema.safeParse(review);
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "review"] = issue.message;
    }
  for (const [i, term] of review.terms.entries()) {
    if (!term.text.trim())
      errors[`terms.${i}.text`] =
        "Describe this part of the agreement, or remove this item.";
    if (
      !spans.some(
        (s) => s.id === term.span_id && s.text.includes(term.quote),
      ) ||
      !term.quote.trim()
    )
      errors[`terms.${i}.quote`] =
        "This excerpt must match the original agreement. Remove this item and add it again from the source text below.";
  }
  if (!review.terms.some((t) => t.kind === "inclusion"))
    errors.terms =
      "Include at least one item describing the work you agreed to deliver.";
  review.issues.forEach((issue, i) => {
    if (!issue.resolution.trim())
      errors[`issues.${i}.resolution`] =
        "Explain how this is resolved, or confirm that the agreement does not specify it.";
  });
  const { price, due_date, revision } = review.commercial;
  if (
    revision.allowance !== null &&
    (!Number.isInteger(revision.allowance) ||
      revision.allowance < 0 ||
      revision.allowance > 10000)
  )
    errors["commercial.revision.allowance"] =
      "Enter a whole number of included changes or rounds from 0 to 10,000.";
  if (
    price.amount_cents !== null &&
    (!Number.isInteger(price.amount_cents) ||
      price.amount_cents < 0 ||
      price.amount_cents > 100_000_000)
  )
    errors["commercial.price.amount_cents"] =
      "Enter a price from 0 to 1,000,000 with no more than two decimal places.";
  if (!basicsSchema.shape.agreed_due_date.safeParse(due_date.value).success)
    errors["commercial.due_date.value"] =
      "Enter a real completion date, or leave this blank if none is stated.";
  for (const [key, field] of Object.entries(review.commercial)) {
    const present =
      key === "price"
        ? price.amount_cents !== null || price.currency !== null
        : key === "due_date"
          ? due_date.value !== null
          : revision.unit !== "not_specified";
    if (present || field.span_id || field.quote) {
      if (!field.span_id)
        errors[`commercial.${key}.span_id`] =
          "Choose the page containing this contract detail.";
      if (
        !field.quote?.trim() ||
        !spans.some(
          (s) => s.id === field.span_id && s.text.includes(field.quote!),
        )
      )
        errors[`commercial.${key}.quote`] =
          "Copy the exact words from the selected source page. The excerpt must match the agreement.";
    }
  }
  if (revision.unit === "ambiguous")
    errors["commercial.revision.unit"] =
      "Clarify whether the contract includes individual change requests or rounds of feedback, then choose below.";
  if ((revision.unit === "not_specified") !== (revision.allowance === null))
    errors["commercial.revision.allowance"] =
      revision.unit === "not_specified"
        ? "Leave the number blank when the agreement does not specify included changes."
        : "Enter the number of requests or rounds included in the agreement.";
  if (price.amount_cents !== null && !price.currency)
    errors["commercial.price.currency"] =
      "Choose the currency used for this contract price.";
  if (price.currency && price.amount_cents === null)
    errors["commercial.price.amount_cents"] =
      "Enter the contract price, or clear both price and currency if neither is specified.";
  if (
    price.currency &&
    !currencyCodes.has(price.currency)
  )
    errors["commercial.price.currency"] =
      "Enter a currency code, such as USD, EUR or GBP.";
  if (
    price.amount_cents !== null &&
    (price.amount_cents !== project.original_amount_cents ||
      price.currency !== project.currency) &&
    !review.price_choice
  )
    errors.price_choice =
      "The contract price differs from Basics. Choose which price to use.";
  if (
    due_date.value &&
    due_date.value !== project.agreed_due_date &&
    !review.date_choice
  )
    errors.date_choice =
      "The contract date differs from Basics. Choose which date to use.";
  return errors;
}
