"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  InitialsAvatar,
  filterActive,
  filterButton,
  filterIdle,
} from "@/components/dashboard/table-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// The pill, search and dropdown filters the owner tables used before they
// moved to server pagination, now driving the URL instead of client state.

type Option = {
  id: string;
  label: string;
  count?: number;
  avatar?: { name: string; src?: string | null };
};

const selectTrigger =
  "h-9 w-full max-w-64 rounded-full border-0 bg-sidebar-accent px-3.5 text-sm font-medium shadow-none sm:w-56";
const pagerButton =
  "grid size-8 place-items-center rounded-full bg-sidebar-accent text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 disabled:pointer-events-none disabled:opacity-40";

// Filtering re-renders the page (and this toolbar) from the server. These
// survive that remount so typing in the search box isn't interrupted.
let refocusSearch = false;
let typedQuery: string | null = null;

export function ListToolbar({
  values,
  pills,
  search,
  selects = [],
  page,
  pageSize,
  total,
  aside,
}: {
  /** Current URL filter values, e.g. { status: "open", q: "", project: "all" }. */
  values: Record<string, string | number>;
  pills: { param: string; label: string; options: Option[] };
  search: { placeholder: string };
  selects?: { param: string; label: string; options: Option[] }[];
  page: number;
  pageSize: number;
  total: number;
  aside?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function navigate(changes: Record<string, string | null>, nextPage = 1) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const input = searchRef.current;
    if (!refocusSearch || !input) return;
    refocusSearch = false;
    input.focus();
    if (typedQuery !== null && typedQuery !== input.value) {
      input.value = typedQuery;
      // Characters typed while the page was loading still need applying.
      timer.current = setTimeout(() => {
        refocusSearch = true;
        navigate({ q: typedQuery });
      }, 300);
    }
    input.setSelectionRange(input.value.length, input.value.length);
    return () => clearTimeout(timer.current);
    // Runs once per mount; navigate only reads the live URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <section
      aria-label="Filters"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div
        role="group"
        aria-label={pills.label}
        className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1"
      >
        {pills.options.map((item) => {
          const active = String(values[pills.param] ?? "all") === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => navigate({ [pills.param]: item.id })}
              className={cn(filterButton, active ? filterActive : filterIdle)}
            >
              {item.label}
              {item.count !== undefined && ` (${item.count})`}
            </button>
          );
        })}
      </div>
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
        <label className="flex h-9 w-full items-center gap-2 rounded-full bg-sidebar-accent px-3 text-neutral-500 focus-within:ring-[3px] focus-within:ring-sidebar-ring/40 sm:w-64 dark:text-neutral-400">
          <Search aria-hidden className="size-[18px] shrink-0" />
          <span className="sr-only">{search.placeholder}</span>
          <input
            ref={searchRef}
            type="search"
            defaultValue={String(values.q ?? "")}
            maxLength={100}
            placeholder={search.placeholder}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            onChange={(event) => {
              const value = event.target.value;
              typedQuery = value;
              clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                refocusSearch = true;
                navigate({ q: value.trim() });
              }, 300);
            }}
          />
        </label>
        {selects.map((select) => (
          <Select
            key={select.param}
            value={String(values[select.param] ?? "all")}
            onValueChange={(value) => navigate({ [select.param]: value })}
          >
            <SelectTrigger aria-label={select.label} className={selectTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {select.options.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.avatar && (
                    <InitialsAvatar
                      name={item.avatar.name}
                      src={item.avatar.src}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span className="text-neutral-500 tabular-nums dark:text-neutral-400">
                      {item.count}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {total > pageSize && (
          <nav
            aria-label="Result pages"
            className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
          >
            <span className="tabular-nums" aria-live="polite">
              {first}–{last} of {total}
            </span>
            <button
              type="button"
              className={pagerButton}
              disabled={page <= 1}
              onClick={() => navigate({}, page - 1)}
            >
              <ChevronLeft aria-hidden className="size-4" />
              <span className="sr-only">Previous page</span>
            </button>
            <button
              type="button"
              className={pagerButton}
              disabled={page * pageSize >= total}
              onClick={() => navigate({}, page + 1)}
            >
              <ChevronRight aria-hidden className="size-4" />
              <span className="sr-only">Next page</span>
            </button>
          </nav>
        )}
        {aside}
      </div>
    </section>
  );
}
