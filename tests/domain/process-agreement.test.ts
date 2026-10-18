import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeAgreementNow } from "../../lib/domain/process-agreement";
import { AgreementAnalysisError } from "../../lib/ai/agreement-errors";
const { extract } = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock("../../lib/ai/extract-agreement", () => ({
  extractAgreement: extract,
}));
afterEach(() => vi.resetAllMocks());
function database(
  options: { claim?: boolean; finish?: boolean; saveError?: boolean } = {},
) {
  const rpc = vi.fn(async (name: string) =>
    name === "claim_agreement_job"
      ? {
          data:
            options.claim === false
              ? null
              : { id: "job", lease_token: "lease" },
          error: null,
        }
      : {
          data: options.finish !== false,
          error: options.saveError ? { code: "failure" } : null,
        },
  );
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({
      data: { kind: "text", original_text: "Landing page included" },
      error: null,
    })),
  };
  const from = vi.fn(() => query);
  return {
    rpc,
    from,
    query,
    client: { rpc, from } as unknown as Parameters<
      typeof analyzeAgreementNow
    >[0],
  };
}
describe("same-request agreement analysis", () => {
  it("calls Gemini and saves before returning success, with a scoped source read", async () => {
    const db = database();
    extract.mockResolvedValue({ terms: [], warnings: [] });
    const result = await analyzeAgreementNow(db.client, "project", "document");
    expect(result.status).toBe("ready");
    expect(extract).toHaveBeenCalledTimes(1);
    expect(db.query.eq).toHaveBeenCalledWith("project_id", "project");
    expect(db.rpc).toHaveBeenLastCalledWith(
      "finish_agreement_attempt",
      expect.objectContaining({
        p_job: "job",
        p_lease: "lease",
        p_error: null,
      }),
    );
  });
  it("deduplicates a held lease without a second Gemini request", async () => {
    const db = database({ claim: false });
    expect(
      (await analyzeAgreementNow(db.client, "project", "document")).status,
    ).toBe("unchanged");
    expect(extract).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("persists a safe provider failure and returns it instead of pretending to analyze", async () => {
    const db = database();
    extract.mockRejectedValue(
      new AgreementAnalysisError(
        "GEMINI_QUOTA",
        "Gemini request limit reached",
      ),
    );
    expect(await analyzeAgreementNow(db.client, "project", "document")).toEqual(
      { status: "failed", error: "Gemini request limit reached" },
    );
    expect(db.rpc).toHaveBeenLastCalledWith(
      "finish_agreement_attempt",
      expect.objectContaining({
        p_error: "Gemini request limit reached",
        p_extraction: null,
      }),
    );
  });
  it("never reports success after persistence failure or a replaced lease", async () => {
    extract.mockResolvedValue({ terms: [], warnings: [] });
    const failing = database({ saveError: true });
    await expect(
      analyzeAgreementNow(failing.client, "project", "document"),
    ).rejects.toMatchObject({ code: "AGREEMENT_SAVE" });
    const replaced = database({ finish: false });
    expect(
      (await analyzeAgreementNow(replaced.client, "project", "document"))
        .status,
    ).toBe("superseded");
  });
});
