import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  },
}));
import { listInput, queryList } from "@/lib/dashboard/list-query";
import type { db } from "@/lib/db/server";

describe("owner list access", () => {
  it("bounds pagination and accepts only a project UUID or all", () => {
    expect(
      listInput({ page: "-2", project: "other-owner", q: "  heading  " }),
    ).toMatchObject({ page: 1, project: "all", q: "heading" });
  });
  it("applies full-data filters before selecting a later page, retaining total and project context", async () => {
    const calls: [string, unknown[]][] = [];
    const query = new Proxy(
      {},
      {
        get(_, name: string) {
          return (...args: unknown[]) => {
            calls.push([name, args]);
            if (name === "range")
              return Promise.resolve({
                data: [
                  {
                    id: "task-26",
                    projects: { name: "Website", client_name: "Client" },
                  },
                ],
                count: 61,
                error: null,
              });
            return query;
          };
        },
      },
    );
    const client = { from: () => query } as unknown as Awaited<
      ReturnType<typeof db>
    >;
    const result = await queryList(
      client,
      "tasks",
      listInput({ page: "2", status: "blocked", q: "50%_off" }),
    );
    expect(result).toMatchObject({
      total: 61,
      page: 2,
      items: [
        { id: "task-26", project_name: "Website", client_name: "Client" },
      ],
    });
    expect(calls).toContainEqual(["eq", ["status", "blocked"]]);
    expect(calls).toContainEqual(["ilike", ["title", "%50\\%\\_off%"]]);
    expect(calls.at(-1)).toEqual(["range", [25, 49]]);
    expect(calls.filter(([name]) => name === "order")).toEqual([
      ["order", ["updated_at", { ascending: false }]],
      ["order", ["id", { ascending: false }]],
    ]);
  });
});
