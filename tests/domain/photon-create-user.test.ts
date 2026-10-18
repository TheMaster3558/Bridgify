import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ list: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/photon/spectrum", () => ({
  listPhotonUsers: f.list,
  readSpectrumCredentials: () => ({
    projectId: "spectrum-project",
    projectSecret: "test-server-only-secret",
  }),
}));
import { createPhotonUser } from "@/lib/photon/create-user";
import { photonUserInputSchema } from "@/lib/schemas/photon-user";
const input = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.test",
  phoneNumber: "+14155550100",
};
const user = {
  id: "provider-user",
  projectId: "spectrum-project",
  type: "shared",
  firstName: "Ada",
  lastName: "Lovelace",
  email: input.email,
  phoneNumber: input.phoneNumber,
  assignedPhoneNumber: "+14155550200",
  meta: { private: "not-for-browser" },
  createdAt: "2026-10-17",
};
const normalized = {
  id: user.id,
  name: "Ada Lovelace",
  email: user.email,
  phoneNumber: user.phoneNumber,
  assignedPhoneNumber: user.assignedPhoneNumber,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", f.fetch);
  f.list.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());
describe("Stable Spectrum user creation", () => {
  it("validates contacts and normalizes formatted international numbers without guessing a country", () => {
    expect(
      photonUserInputSchema.parse({
        ...input,
        phoneNumber: "+1 (415) 555-0100",
      }).phoneNumber,
    ).toBe(input.phoneNumber);
    for (const bad of [
      { phoneNumber: "4155550100" },
      { phoneNumber: "+001" },
      { email: "invalid" },
      { firstName: "   " },
      { type: "dedicated" },
    ])
      expect(
        photonUserInputSchema.safeParse({ ...input, ...bad }).success,
      ).toBe(false);
  });
  it("uses the verified shared-user contract, project Basic auth and only returns safe contact fields", async () => {
    f.fetch.mockResolvedValue(Response.json({ succeed: true, data: user }));
    const result = await createPhotonUser(input);
    expect(f.fetch).toHaveBeenCalledOnce();
    const [url, options] = f.fetch.mock.calls[0];
    expect(url).toBe(
      "https://spectrum.photon.codes/projects/spectrum-project/users/",
    );
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ type: "shared", ...input });
    expect(options.headers.authorization).toBe(
      `Basic ${Buffer.from("spectrum-project:test-server-only-secret").toString("base64")}`,
    );
    expect(result).toEqual({ user: normalized, existing: false });
    expect(JSON.stringify(result)).not.toContain("test-server-only-secret");
    expect(JSON.stringify(result)).not.toContain("not-for-browser");
  });
  it("reuses an existing phone without updating its name/email or sending a create request", async () => {
    f.list.mockResolvedValue([
      {
        ...normalized,
        name: "Existing profile",
        email: "original@example.test",
      },
    ]);
    expect(await createPhotonUser(input)).toMatchObject({
      existing: true,
      user: { name: "Existing profile", email: "original@example.test" },
    });
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("reconciles a lost create response by finding the provider user on a fresh list", async () => {
    f.list.mockResolvedValueOnce([]).mockResolvedValueOnce([normalized]);
    f.fetch.mockRejectedValue(new Error("timeout"));
    expect(await createPhotonUser(input)).toEqual({
      existing: true,
      user: normalized,
    });
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("does not create when the preflight list is unavailable", async () => {
    f.list.mockRejectedValue(new Error("provider unavailable"));
    await expect(createPhotonUser(input)).rejects.toThrow();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 422, 429, 503])(
    "reports status %s without exposing provider error text or credentials",
    async (status) => {
      f.fetch.mockResolvedValue(
        Response.json({ error: "test-server-only-secret PRIVATE" }, { status }),
      );
      await expect(createPhotonUser(input)).rejects.not.toThrow(
        /test-server-only-secret|PRIVATE/,
      );
    },
  );
  it("rejects a mismatched project/phone, dedicated user or malformed success response", async () => {
    for (const patch of [
      { projectId: "another-project" },
      { phoneNumber: "+14155550999" },
      { type: "dedicated" },
      { id: "" },
    ]) {
      f.fetch.mockResolvedValue(
        Response.json({ succeed: true, data: { ...user, ...patch } }),
      );
      await expect(createPhotonUser(input)).rejects.toMatchObject({
        status: 503,
        code: "PHOTON_USER_UNCONFIRMED",
      });
    }
  });
});
