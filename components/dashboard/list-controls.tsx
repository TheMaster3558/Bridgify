import Link from "next/link";
import type { ListInput } from "@/lib/dashboard/list-query";
export function ListControls({
  input,
  total,
  statuses,
  projects = [],
  reasons = [],
  taskFilters = false,
}: {
  input: ListInput;
  total: number;
  statuses: string[];
  projects?: { id: string; name: string }[];
  reasons?: string[];
  taskFilters?: boolean;
}) {
  const link = (page: number) =>
    `?${new URLSearchParams({ ...input, page: String(page) })}`;
  return (
    <section
      className="mx-auto grid max-w-7xl gap-3 px-6 pt-6"
      aria-label="Search and pagination"
    >
      <form className="flex flex-wrap items-end gap-3" method="get">
        {input.task !== "all" && (
          <input type="hidden" name="task" value={input.task} />
        )}
        <input type="hidden" name="sort" value={input.sort} />
        <input type="hidden" name="dir" value={input.dir} />
        <label className="grid gap-1 text-sm">
          Search
          <input
            name="q"
            defaultValue={input.q}
            maxLength={100}
            className="rounded border bg-card p-2"
          />
        </label>
        {!!statuses.length && (
          <label className="grid gap-1 text-sm">
            Status
            <select
              name="status"
              defaultValue={input.status}
              className="rounded border bg-card p-2"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {!!projects.length && (
          <label className="grid gap-1 text-sm">
            Project
            <select
              name="project"
              defaultValue={input.project}
              className="rounded border bg-card p-2"
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!!reasons.length && (
          <label className="grid gap-1 text-sm">
            Reason
            <select
              className="rounded border bg-card p-2"
              name="reason"
              defaultValue={input.reason}
            >
              <option value="all">All reasons</option>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {taskFilters && (
          <label className="grid gap-1 text-sm">
            Assignee (exact name; blank for all)
            <input
              className="rounded border bg-card p-2"
              name="assignee"
              defaultValue={input.assignee === "all" ? "" : input.assignee}
            />
          </label>
        )}
        {!projects.length && input.project !== "all" && (
          <input type="hidden" name="project" value={input.project} />
        )}
        <button className="rounded border bg-card px-4 py-2">
          Apply filters
        </button>
      </form>
      <nav aria-label="Result pages" className="flex gap-4 text-sm">
        <span>
          {total} results · page {input.page}
        </span>
        {input.page > 1 && (
          <Link className="underline" href={link(input.page - 1)}>
            Previous page
          </Link>
        )}
        {input.page * 25 < total && (
          <Link className="underline" href={link(input.page + 1)}>
            Next page
          </Link>
        )}
      </nav>
    </section>
  );
}
