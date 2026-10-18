import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfSpans, textSpans } from "../../lib/domain/agreement";
import {
  extractAgreement,
  resetAgreementModelCooldowns,
} from "../../lib/ai/extract-agreement";
import {
  initialReview,
  reviewedAgreementSchema,
} from "../../lib/schemas/agreement";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create };
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  resetAgreementModelCooldowns();
});
const spans = textSpans(["Landing page included. Two revisions. USD 200.00."]);
const evidence = { span_id: spans[0].id, quote: "Two revisions" };
function result() {
  return {
    terms: [
      {
        kind: "inclusion",
        text: "Landing page",
        span_id: spans[0].id,
        quote: "Landing page included",
      },
    ],
    commercial: {
      price: {
        amount_cents: 20000,
        currency: "USD",
        span_id: spans[0].id,
        quote: "USD 200.00",
      },
      due_date: { value: null, span_id: null, quote: null },
      revision: { allowance: 2, unit: "ambiguous", ...evidence },
    },
    warnings: [],
  };
}
function configured() {
  vi.stubEnv("GEMINI_API_KEY", "test-only-key");
  vi.stubEnv("GEMINI_MODEL", "test-only-model");
  vi.stubEnv("GEMINI_FALLBACK_MODEL", "none");
}
describe("agreement extraction boundary", () => {
  it("uses structured Gemini output and preserves ambiguous revision language for review", async () => {
    configured();
    create.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify(result()),
    });
    const extracted = await extractAgreement(spans);
    const schema = create.mock.calls[0][0].response_format.schema;
    expect(schema).toBeTruthy();
    const sent = JSON.stringify(schema);
    for (const keyword of [
      "$schema",
      "format",
      "pattern",
      "minLength",
      "maxLength",
      "minimum",
      "maximum",
      "minItems",
      "maxItems",
      "additionalProperties",
    ])
      expect(sent).not.toContain(`"${keyword}"`);
    expect(schema.properties.terms.items.required).toContain("span_id");
    expect(extracted.commercial.revision.unit).toBe("ambiguous");
    expect(extracted.warnings.some((w) => w.includes("Included changes"))).toBe(
      true,
    );
    const review = initialReview(extracted);
    expect(reviewedAgreementSchema.safeParse(review).success).toBe(false);
    review.commercial.revision.unit = "rounds";
    review.issues = review.issues.map((i) => ({
      ...i,
      resolution: "Reviewed; missing terms remain unspecified",
    }));
    expect(reviewedAgreementSchema.safeParse(review).success).toBe(true);
  });
  it("rejects fabricated commercial evidence and incomplete model responses", async () => {
    configured();
    const bad = result();
    bad.commercial.price.quote = "Invented";
    create.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify(bad),
    });
    await expect(extractAgreement(spans)).rejects.toThrow(/evidence/);
    create.mockResolvedValue({
      status: "incomplete",
      output_text: JSON.stringify(result()),
    });
    await expect(extractAgreement(spans)).rejects.toThrow(/incomplete/);
  });
  it("refuses a missing extraction configuration", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(extractAgreement(spans)).rejects.toThrow(/not configured/);
    expect(create).not.toHaveBeenCalled();
  });
  it("falls back immediately on quota errors and records the actual model", async () => {
    configured();
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "test-fallback");
    create
      .mockRejectedValueOnce({
        status: 429,
        message: "private source must never be logged",
      })
      .mockResolvedValueOnce({
        status: "completed",
        output_text: JSON.stringify(result()),
      });
    const extracted = await extractAgreement(spans);
    expect(create).toHaveBeenCalledTimes(2);
    expect(extracted.model).toBe("test-fallback");
    expect(extracted.fallback_from).toBe("test-only-model");
    expect(create.mock.calls[0][0].store).toBe(false);
    expect(create.mock.calls[0][0].generation_config.thinking_level).toBe(
      "low",
    );
    expect(create.mock.calls[0][1].retries.strategy).toBe("none");
  });
  it("surfaces quota and high-demand failures safely, without retry waits", async () => {
    configured();
    create.mockRejectedValueOnce({ status: 429, message: "secret agreement" });
    await expect(extractAgreement(spans)).rejects.toMatchObject({
      code: "GEMINI_QUOTA",
    });
    resetAgreementModelCooldowns();
    create.mockRejectedValueOnce({ status: 503, message: "secret agreement" });
    await expect(extractAgreement(spans)).rejects.toMatchObject({
      code: "GEMINI_UNAVAILABLE",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("still rejects malformed dates and missing UUID citations after provider schema simplification", async () => {
    configured();
    const invalidDate = {
      ...result(),
      commercial: {
        ...result().commercial,
        due_date: {
          value: "2026-99-99",
          span_id: spans[0].id,
          quote: "USD 200.00",
        },
      },
    };
    create.mockResolvedValueOnce({
      status: "completed",
      output_text: JSON.stringify(invalidDate),
    });
    await expect(extractAgreement(spans)).rejects.toMatchObject({
      code: "GEMINI_INVALID_RESULT",
    });
    const invalidId = result();
    invalidId.terms[0].span_id = "not-a-uuid";
    create.mockResolvedValueOnce({
      status: "completed",
      output_text: JSON.stringify(invalidId),
    });
    await expect(extractAgreement(spans)).rejects.toMatchObject({
      code: "GEMINI_INVALID_RESULT",
    });
  });
  it("normalizes the common short model ID", async () => {
    configured();
    vi.stubEnv("GEMINI_MODEL", "3.1-flash-lite");
    create.mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify(result()),
    });
    expect((await extractAgreement(spans)).model).toBe("gemini-3.1-flash-lite");
  });
  it("does not retry authentication failures on another model", async () => {
    configured();
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "test-fallback");
    create.mockRejectedValue({ status: 403, message: "private data" });
    await expect(extractAgreement(spans)).rejects.toMatchObject({
      code: "GEMINI_AUTH",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("extracts a real text PDF through the installed PDF parser", async () => {
    const content =
      "BT /F1 12 Tf 50 750 Td (Landing page included. Two revision rounds.) Tj ET";
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [i, obj] of objects.entries()) {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
      .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const extracted = await pdfSpans(new TextEncoder().encode(pdf));
    expect(extracted[0].text).toContain("Two revision rounds");
    expect(extracted[0].page).toBe(1);
  });
});
