import { describe, expect, it } from "vitest";
import {
  basicsPayload,
  validateBasics,
  validatePolicy,
  agreementErrors,
  DEFAULT_SETUP_POLICY,
} from "@/lib/projects/setup-validation";
import { chatIntroductionSchema, policySchema } from "@/lib/schemas/onboarding";
import {
  initialReview,
  type AgreementExtraction,
} from "@/lib/schemas/agreement";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const basics = {
  name: "Client site",
  client_name: "Client",
  price: "100.29",
  currency: "usd",
  timezone: "America/Los_Angeles",
  due: "",
};
const policy = {
  mode: "review_only",
  allowance_mode: "per_request",
  allowance: "0",
  targets: "home.heading",
  exclusions: "No new pages",
  max_open_tasks: "10",
};
describe("project setup validation", () => {
  it("accepts manual-approval defaults without fabricated target identifiers", () => {
    expect(policySchema.safeParse(DEFAULT_SETUP_POLICY).success).toBe(true);
    expect(validatePolicy(form({ ...policy, targets: "" }))).toEqual({});
    expect(
      policySchema.safeParse({
        ...DEFAULT_SETUP_POLICY,
        mode: "enabled",
        allowance: 2,
      }).success,
    ).toBe(false);
  });
  it("normalizes valid basics without rounding money", () => {
    expect(validateBasics(form(basics))).toEqual({});
    expect(basicsPayload(form({ ...basics, name: " Site " }))).toMatchObject({
      name: "Site",
      currency: "USD",
      original_amount_cents: 10029,
      agreed_due_date: null,
    });
  });
  it.each([
    ["name", "   "],
    ["client_name", ""],
    ["price", "1.234"],
    ["price", "-1"],
    ["price", "1000000.01"],
    ["price", "1e3"],
    ["currency", "ZZZ"],
    ["timezone", "Mars/City"],
    ["due", "2026-02-30"],
  ])("points an invalid %s at its field", (key, value) => {
    expect(validateBasics(form({ ...basics, [key]: value }))[key]).toBeTruthy();
  });
  it("requires actual numeric values and never treats an empty allowance as zero", () => {
    expect(validatePolicy(form(policy))).toEqual({});
    expect(
      validatePolicy(form({ ...policy, allowance: "" })).allowance,
    ).toBeTruthy();
    expect(
      validatePolicy(form({ ...policy, max_open_tasks: "11" })).max_open_tasks,
    ).toBeTruthy();
    expect(
      validatePolicy(form({ ...policy, allowance: "1.5" })).allowance,
    ).toBeTruthy();
  });
  it("explains incompatible automatic permissions at the relevant fields", () => {
    const errors = validatePolicy(
      form({
        ...policy,
        mode: "enabled",
        allowance_mode: "manual_rounds",
        targets: "",
      }),
    );
    expect(Object.keys(errors).sort()).toEqual([
      "allowance",
      "allowance_mode",
      "operations",
      "targets",
    ]);
  });
  it("validates edited introduction text on the server", () => {
    expect(
      chatIntroductionSchema.parse({
        expectedVersion: 1,
        introduction: " Hi, I organize this project. ",
      }).introduction,
    ).toBe("Hi, I organize this project.");
    expect(
      chatIntroductionSchema.safeParse({
        expectedVersion: 1,
        introduction: "   ",
      }).success,
    ).toBe(false);
    expect(
      chatIntroductionSchema.safeParse({
        expectedVersion: 1,
        introduction: "x".repeat(4001),
      }).success,
    ).toBe(false);
  });
  it("locates unresolved contract questions, mismatches and fabricated excerpts", () => {
    const span = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      page: 1,
      start_offset: 0,
      end_offset: 50,
      text: "One page included. USD 200.00. Two revisions.",
    };
    const extraction: AgreementExtraction = {
      terms: [
        {
          kind: "inclusion",
          text: "One page",
          span_id: span.id,
          quote: "One page included",
        },
      ],
      commercial: {
        price: {
          amount_cents: 20000,
          currency: "USD",
          span_id: span.id,
          quote: "USD 200.00",
        },
        due_date: { value: null, span_id: null, quote: null },
        revision: {
          allowance: 2,
          unit: "ambiguous",
          span_id: span.id,
          quote: "Two revisions",
        },
      },
      warnings: ["Clarify changes"],
    };
    const review = initialReview(extraction),
      project = {
        original_amount_cents: 10000,
        currency: "USD",
        agreed_due_date: null,
      };
    const errors = agreementErrors(review, [span], project);
    expect(errors["commercial.revision.unit"]).toContain(
      "individual change requests",
    );
    expect(errors["issues.0.resolution"]).toBeTruthy();
    expect(errors.price_choice).toBeTruthy();
    review.commercial.revision.unit = "rounds";
    review.issues[0].resolution = "Two rounds agreed";
    review.price_choice = "agreement";
    expect(agreementErrors(review, [span], project)).toEqual({});
    review.commercial.price.quote = "An invented price";
    expect(
      agreementErrors(review, [span], project)["commercial.price.quote"],
    ).toContain("exact words");
  });
});
