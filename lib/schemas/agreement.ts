import { z } from "zod";
import { termSchema } from "./onboarding";
const evidence = {
  span_id: z.uuid().nullable(),
  quote: z.string().max(4000).nullable(),
};
const date = z.iso.date().nullable();
export const commercialSchema = z.object({
  price: z.object({
    amount_cents: z.number().int().min(0).max(100_000_000).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    ...evidence,
  }),
  due_date: z.object({ value: date, ...evidence }),
  revision: z.object({
    allowance: z.number().int().min(0).max(10000).nullable(),
    unit: z.enum(["requests", "rounds", "ambiguous", "not_specified"]),
    ...evidence,
  }),
});
export const agreementExtractionSchema = z.object({
  terms: z.array(termSchema).min(1).max(100),
  commercial: commercialSchema,
  warnings: z.array(z.string().min(1).max(1000)).max(20),
});
export const reviewDraftSchema = z.object({
  terms: z
    .array(
      termSchema.extend({
        text: z.string().max(2000),
        quote: z.string().max(4000),
      }),
    )
    .max(100),
  commercial: commercialSchema.extend({
    price: commercialSchema.shape.price.extend({
      currency: z.string().max(3).nullable(),
    }),
  }),
  issues: z
    .array(
      z.object({
        text: z.string().min(1).max(1000),
        resolution: z.string().max(2000),
      }),
    )
    .max(30),
  price_choice: z.enum(["", "basics", "agreement"]),
  date_choice: z.enum(["", "basics", "agreement"]),
});
export const reviewedAgreementSchema = reviewDraftSchema.superRefine(
  (v, ctx) => {
    const commercial = commercialSchema.safeParse(v.commercial);
    if (!commercial.success)
      for (const issue of commercial.error.issues)
        ctx.addIssue({
          code: "custom",
          path: ["commercial", ...issue.path],
          message: "Enter a valid value for this contract detail.",
        });
    const terms = z.array(termSchema).safeParse(v.terms);
    if (!terms.success)
      for (const issue of terms.error.issues)
        ctx.addIssue({
          code: "custom",
          path: ["terms", ...issue.path],
          message:
            "Each item needs a description and an exact excerpt from the agreement.",
        });
    if (!v.terms.some((t) => t.kind === "inclusion"))
      ctx.addIssue({
        code: "custom",
        path: ["terms"],
        message: "Confirm at least one item of included work.",
      });
    v.issues.forEach((issue, i) => {
      if (!issue.resolution.trim())
        ctx.addIssue({
          code: "custom",
          path: ["issues", i, "resolution"],
          message:
            "Explain how you resolved this question, or acknowledge that the agreement does not specify it.",
        });
    });
    const r = v.commercial.revision;
    if (
      r.unit === "ambiguous" ||
      (r.unit === "not_specified") !== (r.allowance === null)
    )
      ctx.addIssue({
        code: "custom",
        path: ["commercial", "revision", "unit"],
        message:
          "Choose individual requests, rounds of feedback, or no changes specified in the agreement.",
      });
    for (const [name, field] of Object.entries(v.commercial)) {
      const present =
        name === "price"
          ? v.commercial.price.amount_cents !== null ||
            v.commercial.price.currency !== null
          : name === "due_date"
            ? v.commercial.due_date.value !== null
            : r.unit !== "not_specified";
      if (present && (!field.span_id || !field.quote?.trim()))
        ctx.addIssue({
          code: "custom",
          path: ["commercial", name, "quote"],
          message:
            "Choose a source page and copy the exact words supporting this contract detail.",
        });
    }
    if (
      (v.commercial.price.amount_cents === null) !==
      (v.commercial.price.currency === null)
    )
      ctx.addIssue({
        code: "custom",
        path: [
          "commercial",
          "price",
          v.commercial.price.currency ? "amount_cents" : "currency",
        ],
        message:
          "Enter both the price and currency, or leave both blank if the agreement does not specify them.",
      });
  },
);
export type AgreementExtraction = z.infer<typeof agreementExtractionSchema> & {
  model?: string;
  fallback_from?: string | null;
  fallback_reason?: string | null;
};
export type AgreementReview = z.infer<typeof reviewDraftSchema>;
export function initialReview(
  extraction: AgreementExtraction,
): AgreementReview {
  return {
    terms: extraction.terms,
    commercial: extraction.commercial,
    issues: extraction.warnings.map((text) => ({ text, resolution: "" })),
    price_choice: "",
    date_choice: "",
  };
}
