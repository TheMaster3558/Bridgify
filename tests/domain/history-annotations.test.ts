import { describe, expect, it, vi } from "vitest";
import type { db } from "@/lib/db/server";
vi.mock("@/lib/api", () => ({
  checked: (result: { data: unknown; error: unknown }) => {
    if (result.error) throw result.error;
    return result.data;
  },
}));
import { historyAnnotations } from "@/lib/automation/history-annotations";

function fixture(
  code: string | null = "PGRST202",
  tableError: string | null = null,
) {
  const calls: {
    table: string;
    filters: Record<string, unknown>;
    head?: boolean;
  }[] = [];
  const rpc = vi.fn(async () => ({
    data: code ? null : { members: ["rpc-result"] },
    error: code ? { code, message: "RPC error" } : null,
  }));
  const client = {
    rpc,
    from(table: string) {
      const call: (typeof calls)[number] = { table, filters: {} };
      calls.push(call);
      const query = {
        select(_columns: string, options?: { head?: boolean }) {
          call.head = options?.head;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters[column] = value;
          return query;
        },
        in(column: string, value: unknown) {
          call.filters[column] = value;
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(
            resolve({
              data: call.head
                ? null
                : table === "automation_rounds"
                  ? { id: "open-round" }
                  : [{ table }],
              count: call.head ? 1401 : null,
              error: tableError ? { code: tableError } : null,
            }),
          );
        },
      };
      return query;
    },
  } as unknown as Awaited<ReturnType<typeof db>>;
  return { client, calls, rpc };
}

describe("Scope & Revisions history compatibility", () => {
  it("uses the installed RPC without issuing fallback reads", async () => {
    const { client, calls } = fixture(null);
    expect(await historyAnnotations(client, "project-a", [], [])).toEqual({
      members: ["rpc-result"],
    });
    expect(calls).toHaveLength(0);
  });
  it.each(["PGRST202", "42883"])(
    "loads complete scoped history when the RPC is missing (%s)",
    async (code) => {
      const { client, calls } = fixture(code);
      const result = await historyAnnotations(
        client,
        "project-a",
        ["request-a"],
        ["old-round"],
      );
      expect(result.roundCounts).toEqual({
        "open-round": 1401,
        "old-round": 1401,
      });
      expect(result.members).toEqual([{ table: "automation_round_members" }]);
      expect(calls.every((c) => c.filters.project_id === "project-a")).toBe(
        true,
      );
      expect(
        calls.find((c) => c.table === "automation_revision_refunds")?.filters
          .request_id,
      ).toEqual(["request-a"]);
      expect(calls.filter((c) => c.head)).toHaveLength(2);
    },
  );
  it("does not query unfiltered memberships or refunds for an empty page", async () => {
    const { client, calls } = fixture();
    const result = await historyAnnotations(client, "project-a", [], []);
    expect(result.members).toEqual([]);
    expect(result.requestRefunds).toEqual([]);
    expect(result.roundRefunds).toEqual([]);
    expect(calls.every((c) => c.table === "automation_rounds" || c.head)).toBe(
      true,
    );
  });
  it("does not bypass a permission failure from the RPC", async () => {
    const { client, calls } = fixture("42501");
    await expect(
      historyAnnotations(client, "project-b", [], []),
    ).rejects.toMatchObject({ code: "42501" });
    expect(calls).toHaveLength(0);
  });
  it("keeps fallback database failures visible", async () => {
    const { client } = fixture("PGRST202", "42501");
    await expect(
      historyAnnotations(client, "project-b", [], []),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
