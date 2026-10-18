import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PAGE_SIZE, type ListInput } from "@/lib/dashboard/list-query";
import { cn } from "@/lib/utils";

const field =
  "h-9 rounded-full border-0 bg-sidebar-accent px-3.5 text-sm font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
const label = "grid gap-1 text-xs font-medium text-muted-foreground";
const pageLink =
  "grid size-8 place-items-center rounded-full bg-sidebar-accent text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";

export function ListControls({
  input,
  total,
  statuses,
  projects = [],
  reasons = [],
  taskFilters = false,
  hideStatus = false,
  embedded = false,
}: {
  /** Rendered inside a page that already provides width and padding. */
  embedded?: boolean;
  input: ListInput;
  total: number;
  statuses: string[];
  projects?: { id: string; name: string }[];
  reasons?: string[];
  taskFilters?: boolean;
  /** Keep the current status in the URL without showing a status picker. */
  hideStatus?: boolean;
}) {
  const link = (page: number) =>
    `?${new URLSearchParams({ ...input, page: String(page) })}`;
  const first = total ? (input.page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(input.page * PAGE_SIZE, total);
  return (
    <section
      className={cn(
        "flex w-full flex-wrap items-end justify-between gap-3",
        !embedded && "mx-auto max-w-[1280px] px-5 pt-5 md:px-6 md:pt-6",
      )}
      aria-label="Search and pagination"
    >
      <form className="flex flex-wrap items-end gap-2" method="get">
        {input.task !== "all" && (
          <input type="hidden" name="task" value={input.task} />
        )}
        <input type="hidden" name="sort" value={input.sort} />
        <input type="hidden" name="dir" value={input.dir} />
        <label className={label}>
          Search
          <span className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              name="q"
              type="search"
              defaultValue={input.q}
              maxLength={100}
              placeholder="Search"
              className={cn(field, "w-56 pl-9 font-normal")}
            />
          </span>
        </label>
        {!!statuses.length && !hideStatus && (
          <label className={label}>
            Status
            <select
              name="status"
              defaultValue={input.status}
              className={cn(field, "capitalize")}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {hideStatus && input.status !== "all" && (
          <input type="hidden" name="status" value={input.status} />
        )}
        {!!projects.length && (
          <label className={label}>
            Project
            <select
              name="project"
              defaultValue={input.project}
              className={field}
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
          <label className={label}>
            Reason
            <select
              className={cn(field, "capitalize")}
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
          <label className={label}>
            Assignee (exact name; blank for all)
            <input
              className={cn(field, "w-48 font-normal")}
              name="assignee"
              defaultValue={input.assignee === "all" ? "" : input.assignee}
            />
          </label>
        )}
        {!projects.length && input.project !== "all" && (
          <input type="hidden" name="project" value={input.project} />
        )}
        <button className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40">
          Apply filters
        </button>
      </form>
      <nav
        aria-label="Result pages"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <span className="tabular-nums" aria-live="polite">
          {total ? `${first}–${last} of ${total}` : "0 results"} · page{" "}
          {input.page}
        </span>
        {input.page > 1 && (
          <Link className={pageLink} href={link(input.page - 1)}>
            <ChevronLeft aria-hidden className="size-4" />
            <span className="sr-only">Previous page</span>
          </Link>
        )}
        {input.page * PAGE_SIZE < total && (
          <Link className={pageLink} href={link(input.page + 1)}>
            <ChevronRight aria-hidden className="size-4" />
            <span className="sr-only">Next page</span>
          </Link>
        )}
      </nav>
    </section>
  );
}
