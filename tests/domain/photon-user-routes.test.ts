import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  auth: vi.fn(),
  member: vi.fn(),
  project: vi.fn(),
  create: vi.fn(),
  load: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({
  db: async () => ({
    auth: { getUser: f.auth },
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: table === "projects" ? f.project : f.member,
      };
      return q;
    },
  }),
}));
vi.mock("@/lib/photon/create-user", () => ({ createPhotonUser: f.create }));
vi.mock("@/lib/photon/people", () => ({ loadPhotonUsers: f.load }));
vi.mock("@/lib/photon/spectrum", () => ({
  PhotonSetupError: class extends Error {},
}));
vi.mock("@/lib/db/delete-photon-user", () => ({
  deleteDraftPhotonUser: f.remove,
}));
import { DELETE } from "../../app/api/v1/integrations/photon/users/[userId]/route";
import { GET, POST } from "../../app/api/v1/integrations/photon/users/route";
const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const body = {
  projectId,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.test",
  phoneNumber: "+14155550100",
};
function request(payload: unknown = body, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/v1/integrations/photon/users", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  f.auth.mockResolvedValue({ data: { user: { id: "owner" } } });
  f.member.mockResolvedValue({ data: { organization_id: "org" }, error: null });
  f.project.mockResolvedValue({
    data: { id: projectId, status: "draft", activation_cutoff: null },
    error: null,
  });
  f.create.mockResolvedValue({
    user: { id: "provider-user" },
    existing: false,
  });
  f.load.mockResolvedValue({ ok: true, users: [] });
});
afterEach(() => vi.unstubAllEnvs());
describe("owner-scoped Photon user creation API", () => {
  it("requires same origin, a signed-in owner and an accessible draft before any provider mutation", async () => {
    expect((await POST(request(body, "https://attacker.test"))).status).toBe(
      403,
    );
    expect(f.auth).not.toHaveBeenCalled();
    f.auth.mockResolvedValue({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    f.auth.mockResolvedValue({ data: { user: { id: "owner" } } });
    f.member.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(403);
    f.member.mockResolvedValue({
      data: { organization_id: "org" },
      error: null,
    });
    f.project.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(404);
    expect(f.create).not.toHaveBeenCalled();
  });
  it("rejects locked/closed projects and arbitrary provider configuration", async () => {
    for (const project of [
      { status: "active", activation_cutoff: "2026-10-17" },
      { status: "archived", activation_cutoff: null },
      { status: "draft", activation_cutoff: "2026-10-17" },
    ]) {
      f.project.mockResolvedValue({
        data: { id: projectId, ...project },
        error: null,
      });
      expect((await POST(request())).status).toBe(409);
    }
    expect(
      (
        await POST(
          request({ ...body, type: "dedicated", projectSecret: "forged" }),
        )
      ).status,
    ).toBe(400);
    expect(f.create).not.toHaveBeenCalled();
  });
  it("creates via validated fields only and leaves the project-binding operation separate", async () => {
    const response = await POST(
      request({ ...body, phoneNumber: "+1 (415) 555-0100" }),
    );
    expect(response.status).toBe(200);
    expect(f.create).toHaveBeenCalledWith({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phoneNumber: body.phoneNumber,
    });
    expect(await response.json()).toMatchObject({
      data: { existing: false, user: { id: "provider-user" } },
    });
  });
  it("preserves the existing authenticated Photon user list", async () => {
    expect(
      (
        await GET(
          new Request("http://localhost:3000/api/v1/integrations/photon/users"),
        )
      ).status,
    ).toBe(200);
    expect(f.load).toHaveBeenCalledOnce();
  });
});

describe("Photon user deletion API guards", () => {
  const uid = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    context = { params: Promise.resolve({ userId: uid }) };
  function removal(
    payload: unknown = { projectId, phoneNumber: body.phoneNumber },
    origin = "http://localhost:3000",
  ) {
    return new Request(
      `http://localhost:3000/api/v1/integrations/photon/users/${uid}`,
      {
        method: "DELETE",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }
  it("rejects foreign origins, anonymous clients, non-owners, inaccessible and activated projects before deletion", async () => {
    expect(
      (await DELETE(removal(undefined, "https://attacker.test"), context))
        .status,
    ).toBe(403);
    f.auth.mockResolvedValue({ data: { user: null } });
    expect((await DELETE(removal(), context)).status).toBe(401);
    f.auth.mockResolvedValue({ data: { user: { id: "owner" } } });
    f.member.mockResolvedValue({ data: null, error: null });
    expect((await DELETE(removal(), context)).status).toBe(403);
    f.member.mockResolvedValue({
      data: { organization_id: "org" },
      error: null,
    });
    f.project.mockResolvedValue({ data: null, error: null });
    expect((await DELETE(removal(), context)).status).toBe(404);
    f.project.mockResolvedValue({
      data: {
        id: projectId,
        status: "active",
        activation_cutoff: "2026-10-17",
      },
      error: null,
    });
    expect((await DELETE(removal(), context)).status).toBe(409);
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("validates confirmation fields and invokes only the guarded deletion boundary", async () => {
    expect(
      (await DELETE(removal({ projectId, phoneNumber: "4155550100" }), context))
        .status,
    ).toBe(400);
    expect(
      (
        await DELETE(
          removal({
            projectId,
            phoneNumber: body.phoneNumber,
            instanceId: "forged",
          }),
          context,
        )
      ).status,
    ).toBe(400);
    f.remove.mockResolvedValue({ deleted: true, userId: uid });
    const response = await DELETE(removal(), context);
    expect(response.status).toBe(200);
    expect(f.remove).toHaveBeenCalledWith(
      expect.anything(),
      "owner",
      projectId,
      uid,
      body.phoneNumber,
    );
    expect(await response.json()).toMatchObject({
      data: { deleted: true, userId: uid },
    });
  });
});
