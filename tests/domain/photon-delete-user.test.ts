import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ fetch: vi.fn(), list: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/photon/spectrum", () => ({
  listPhotonUsers: f.list,
  readSpectrumCredentials: () => ({
    projectId: "provider-project",
    projectSecret: "server-private-secret",
  }),
}));
import { deletePhotonUser } from "@/lib/photon/delete-user";
const id = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", f.fetch);
  f.list.mockResolvedValue([{ id }]);
});
afterEach(() => vi.unstubAllGlobals());
describe("Stable Spectrum delete-user adapter", () => {
  it("uses the verified DELETE URL and Basic credentials, and validates the returned user ID", async () => {
    f.fetch.mockResolvedValue(
      Response.json({ succeed: true, data: { userId: id } }),
    );
    await expect(deletePhotonUser(id)).resolves.toBeUndefined();
    const [url, options] = f.fetch.mock.calls[0];
    expect(url).toBe(
      `https://spectrum.photon.codes/projects/provider-project/users/${id}/`,
    );
    expect(options.method).toBe("DELETE");
    expect(options.body).toBeUndefined();
    expect(options.headers.authorization).toBe(
      `Basic ${Buffer.from("provider-project:server-private-secret").toString("base64")}`,
    );
    expect(f.list).not.toHaveBeenCalled();
  });
  it("reconciles a lost response only when the user is confirmed absent from the provider list", async () => {
    f.fetch.mockRejectedValue(new Error("timeout"));
    f.list.mockResolvedValue([]);
    await expect(deletePhotonUser(id)).resolves.toBeUndefined();
    f.list.mockRejectedValue(new Error("offline"));
    await expect(deletePhotonUser(id)).rejects.toMatchObject({
      code: "PHOTON_DELETE_UNCONFIRMED",
    });
  });
  it("does not assume a 404 or a mismatched success ID means deleted", async () => {
    f.fetch
      .mockResolvedValueOnce(
        Response.json({ error: "private" }, { status: 404 }),
      )
      .mockResolvedValueOnce(
        Response.json({ succeed: true, data: { userId: "different" } }),
      );
    await expect(deletePhotonUser(id)).rejects.toMatchObject({ status: 503 });
    await expect(deletePhotonUser(id)).rejects.toMatchObject({ status: 503 });
  });
  it("sanitizes rejection errors and validates identifiers before issuing a DELETE", async () => {
    f.fetch.mockResolvedValue(
      Response.json({ error: "server-private-secret" }, { status: 403 }),
    );
    await expect(deletePhotonUser(id)).rejects.not.toThrow(
      /server-private-secret/,
    );
    f.fetch.mockClear();
    await expect(deletePhotonUser("../other-project")).rejects.toThrow();
    expect(f.fetch).not.toHaveBeenCalled();
  });
});
