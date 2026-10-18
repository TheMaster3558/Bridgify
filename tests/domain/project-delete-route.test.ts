import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  rpc: vi.fn(),
  cleanup: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  db: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    rpc: f.rpc,
  }),
}));
vi.mock("@/lib/db/admin", () => ({ adminDb: f.admin }));
vi.mock("@/lib/db/project-deletion", () => ({
  cleanupDeletedProject: f.cleanup,
}));
vi.mock("@/lib/photon/people", () => ({ resolveProjectPeople: vi.fn() }));
import { DELETE } from "../../app/api/v1/projects/[projectId]/route";
const context = {
  params: Promise.resolve({
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
};
const request = () =>
  new Request(
    "http://localhost:3000/api/v1/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    {
      method: "DELETE",
      headers: {
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Website" }),
    },
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
});
afterEach(() => vi.unstubAllEnvs());
describe("project deletion HTTP errors", () => {
  it("reports the forward migration for blocked dependencies without exposing raw database details or cleaning files", async () => {
    f.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23503",
        message: "private constraint automation_project_id_fkey",
        details: "private project identifiers",
      },
    });
    const response = await DELETE(request(), context);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "DELETION_DEPENDENCIES" });
    expect(body.error.message).toContain(
      "202610170013_project_deletion_automation.sql",
    );
    expect(body.error.message).toContain("has not been deleted");
    expect(JSON.stringify(body)).not.toMatch(
      /private constraint|private project identifiers/,
    );
    expect(f.cleanup).not.toHaveBeenCalled();
    expect(f.admin).not.toHaveBeenCalled();
  });
  it("returns the existing send-in-progress guard as actionable feedback instead of a generic database error", async () => {
    f.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message:
          "A message send is still in progress. Check its delivery status before deleting this project",
      },
    });
    const response = await DELETE(request(), context);
    expect(response.status).toBe(422);
    expect((await response.json()).error.message).toContain(
      "send is still in progress",
    );
    expect(f.cleanup).not.toHaveBeenCalled();
  });
});
