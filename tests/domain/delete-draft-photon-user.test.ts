import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  admin: vi.fn(),
  save: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/photon/spectrum", () => ({
  listPhotonUsers: f.list,
  readSpectrumCredentials: () => ({ projectId: "provider-project" }),
}));
vi.mock("@/lib/photon/delete-user", () => ({ deletePhotonUser: f.remove }));
vi.mock("@/lib/db/admin", () => ({ adminDb: f.admin }));
import { deleteDraftPhotonUser } from "@/lib/db/delete-photon-user";
const id = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  phone = "+14155550100";
const client = { rpc: f.rpc } as unknown as Parameters<
  typeof deleteDraftPhotonUser
>[0];
const run = () =>
  deleteDraftPhotonUser(client, "owner", "draft-project", id, phone);
beforeEach(() => {
  vi.resetAllMocks();
  f.list.mockResolvedValue([{ id, phoneNumber: phone }]);
  f.rpc.mockResolvedValue({ data: "pending", error: null });
  f.remove.mockResolvedValue(undefined);
  f.save.mockResolvedValue({ data: { user_id: id }, error: null });
  f.admin.mockImplementation(() => {
    const q = {
      update: () => q,
      eq: () => q,
      select: () => q,
      maybeSingle: f.save,
    };
    return { from: () => q };
  });
});
describe("guarded provider deletion", () => {
  it("reserves deletion before Photon and records the confirmed result afterwards", async () => {
    expect(await run()).toEqual({ deleted: true, userId: id });
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      f.remove.mock.invocationCallOrder[0],
    );
    expect(f.remove.mock.invocationCallOrder[0]).toBeLessThan(
      f.save.mock.invocationCallOrder[0],
    );
  });
  it("does not contact the delete endpoint if a binding guard, reservation or storage configuration fails", async () => {
    f.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message: "This Photon user is linked to a project.",
      },
    });
    await expect(run()).rejects.toThrow(/linked/);
    expect(f.remove).not.toHaveBeenCalled();
    f.admin.mockImplementation(() => {
      throw new Error("not configured");
    });
    f.rpc.mockClear();
    await expect(run()).rejects.toThrow();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("keeps the durable intent pending after an uncertain provider error", async () => {
    f.remove.mockRejectedValue(new Error("unknown"));
    await expect(run()).rejects.toThrow();
    expect(f.save).not.toHaveBeenCalled();
  });
  it("handles absent users without a DELETE and removes a restored user despite an older receipt", async () => {
    f.list.mockResolvedValue([]);
    await expect(run()).resolves.toEqual({ deleted: true, userId: id });
    expect(f.remove).not.toHaveBeenCalled();
    f.list.mockResolvedValue([{ id, phoneNumber: phone }]);
    f.rpc.mockResolvedValue({ data: "deleted", error: null });
    await run();
    expect(f.remove).toHaveBeenCalledExactlyOnceWith(id);
  });
  it("rejects changed phone details before reserving or deleting", async () => {
    f.list.mockResolvedValue([{ id, phoneNumber: "+14155550999" }]);
    await expect(run()).rejects.toMatchObject({ status: 409 });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.remove).not.toHaveBeenCalled();
  });
});
