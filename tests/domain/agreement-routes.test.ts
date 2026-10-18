import { afterEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  analyze: vi.fn(),
  admin: vi.fn(),
  rpc: vi.fn(),
  project: vi.fn(),
}));
vi.mock("@/lib/domain/process-agreement", () => ({
  analyzeAgreementNow: f.analyze,
}));
vi.mock("@/lib/db/admin", () => ({ adminDb: f.admin }));
vi.mock("@/lib/api", () => ({
  api: async (_request: Request, run: (client: unknown) => unknown) =>
    run({
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: f.project,
      }),
      rpc: f.rpc,
    }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw new Error("Database failure");
    return r.data;
  },
  idempotency: () => "test-idempotency-key",
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
import { POST as upload } from "../../app/api/v1/projects/[projectId]/documents/route";
import { POST as agreement } from "../../app/api/v1/projects/[projectId]/agreement/route";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  documentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const context = { params: Promise.resolve({ projectId: id }) };
afterEach(() => vi.resetAllMocks());
function configured() {
  f.project.mockResolvedValue({
    data: {
      id,
      status: "draft",
      version: 2,
      current_agreement_document_id: documentId,
    },
    error: null,
  });
  f.admin.mockReturnValue({ admin: true });
}
describe("interactive agreement HTTP boundaries", () => {
  it("persists the upload and awaits Gemini processing in the same request", async () => {
    configured();
    f.rpc.mockResolvedValue({
      data: { project: { id, version: 2 }, documentId },
      error: null,
    });
    let finish!: (value: unknown) => void;
    f.analyze.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const form = new FormData();
    form.set("text", "One landing page included");
    form.set("expectedVersion", "1");
    const response = upload(
      new Request("http://localhost/api", { method: "POST", body: form }),
      context,
    );
    await vi.waitFor(() =>
      expect(f.analyze).toHaveBeenCalledWith({ admin: true }, id, documentId),
    );
    expect(f.rpc).toHaveBeenCalledWith(
      "onboarding_command",
      expect.objectContaining({
        p_payload: expect.objectContaining({ processing_mode: "interactive" }),
      }),
    );
    let completed = false;
    void response.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish({ status: "ready" });
    expect(await response).toMatchObject({ analysis: { status: "ready" } });
  });
  it("denies another user's project before elevated access or Gemini", async () => {
    f.project.mockResolvedValue({ data: null, error: null });
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze",
        expectedVersion: 2,
        document_id: documentId,
      }),
    });
    await expect(agreement(request, context)).rejects.toMatchObject({
      status: 404,
    });
    expect(f.admin).not.toHaveBeenCalled();
    expect(f.analyze).not.toHaveBeenCalled();
  });
  it("resumes the saved current agreement without uploading it again", async () => {
    configured();
    f.analyze.mockResolvedValue({ status: "ready" });
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analyze",
        expectedVersion: 2,
        document_id: documentId,
      }),
    });
    expect(await agreement(request, context)).toMatchObject({
      analysis: { status: "ready" },
    });
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
