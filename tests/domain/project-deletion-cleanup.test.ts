import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupDeletedProject } from "@/lib/db/project-deletion";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const select = vi.fn(),
  remove = vi.fn(),
  update = vi.fn();
function client() {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    then: (resolve: (r: unknown) => unknown) =>
      Promise.resolve(select()).then(resolve),
  };
  return {
    from: () => ({
      ...query,
      update: (body: unknown) => {
        update(body);
        return { eq: async () => ({ error: null }) };
      },
    }),
    storage: { from: () => ({ remove }) },
  } as unknown as Parameters<typeof cleanupDeletedProject>[0];
}
beforeEach(() => {
  vi.resetAllMocks();
  remove.mockResolvedValue({ error: null });
});
describe("deleted project private file cleanup", () => {
  it("removes private files through Storage and then clears the durable receipt paths", async () => {
    select.mockReturnValue({
      data: [{ project_id: id, storage_paths: [`${id}/agreement.pdf`] }],
      error: null,
    });
    expect(await cleanupDeletedProject(client(), id)).toEqual({
      pending: false,
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith([`${id}/agreement.pdf`]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", storage_paths: [] }),
    );
  });
  it("keeps the durable queue pending when storage fails, then succeeds on retry", async () => {
    select.mockReturnValue({
      data: [{ project_id: id, storage_paths: [`${id}/agreement.pdf`] }],
      error: null,
    });
    remove.mockResolvedValueOnce({ error: { message: "unavailable" } });
    expect(await cleanupDeletedProject(client(), id)).toEqual({
      pending: true,
    });
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" }),
    );
    expect(await cleanupDeletedProject(client(), id)).toEqual({
      pending: false,
    });
  });
  it("never removes another project's storage path", async () => {
    select.mockReturnValue({
      data: [
        { project_id: id, storage_paths: ["another-project/private.pdf"] },
      ],
      error: null,
    });
    expect(await cleanupDeletedProject(client(), id)).toEqual({
      pending: true,
    });
    expect(remove).not.toHaveBeenCalled();
  });
  it("supports drafts with no uploads and already-cleaned receipts", async () => {
    select
      .mockReturnValueOnce({
        data: [{ project_id: id, storage_paths: [] }],
        error: null,
      })
      .mockReturnValueOnce({ data: [], error: null });
    expect(await cleanupDeletedProject(client(), id)).toEqual({
      pending: false,
    });
    expect(await cleanupDeletedProject(client(), id)).toEqual({
      pending: false,
    });
    expect(remove).not.toHaveBeenCalled();
  });
});
