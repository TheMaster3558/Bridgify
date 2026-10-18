"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FolderKanban, Search } from "lucide-react";
import { Dialog } from "radix-ui";
import { navItem, navItemActive } from "@/components/dashboard/nav-styles";
import { cn } from "@/lib/utils";

export type SearchPage = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type Result = SearchPage & { group: "Pages" | "Projects"; detail?: string };

type Project = { id: string; name: string; client_name?: string };

const hintKey =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-black/10 px-1 font-sans text-[11px] font-semibold dark:bg-white/10";

export function QuickSearch({
  pages,
  className,
}: {
  pages: SearchPage[];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || projects || loading.current) return;
    loading.current = true;
    fetch("/api/v1/projects", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        setProjects(response.ok && Array.isArray(body.data) ? body.data : []);
      })
      .catch(() => setProjects([]))
      .finally(() => {
        loading.current = false;
      });
  }, [open, projects]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelected(0);
    }
  }

  const needle = query.trim().toLowerCase();
  const matches = (text: string | undefined) =>
    !needle || (text ?? "").toLowerCase().includes(needle);
  const results: Result[] = [
    ...pages
      .filter((page) => matches(page.label))
      .map((page) => ({ ...page, group: "Pages" as const })),
    ...(projects ?? [])
      .filter(
        (project) => matches(project.name) || matches(project.client_name),
      )
      .map((project) => ({
        href: `/app/projects/${project.id}`,
        label: project.name,
        detail: project.client_name,
        icon: FolderKanban,
        group: "Projects" as const,
      })),
  ];
  const active = Math.min(selected, Math.max(results.length - 1, 0));

  function go(result: Result | undefined) {
    if (!result) return;
    handleOpenChange(false);
    router.push(result.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((active + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((active - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger className={className}>
        <Search aria-hidden className="size-5 shrink-0" />
        <span className="flex-1 text-left">Quick Search</span>
        <kbd className="rounded-md bg-black/10 px-1 py-0.5 font-sans text-[11px] leading-none font-semibold text-neutral-500 dark:bg-white/10 dark:text-neutral-400">
          ⌘K
        </kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed top-[15vh] left-1/2 z-40 flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 overflow-hidden rounded-[28px] border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-xl outline-none">
          <Dialog.Title className="sr-only">Quick Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search pages and projects.
          </Dialog.Description>
          <div className="flex items-center gap-2 rounded-full bg-sidebar-accent px-3 focus-within:ring-[3px] focus-within:ring-sidebar-ring/40">
            <Search
              aria-hidden
              className="size-5 shrink-0 text-neutral-500 dark:text-neutral-400"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages and projects…"
              aria-label="Search"
              aria-controls="quick-search-results"
              aria-activedescendant={
                results[active] ? `quick-search-${active}` : undefined
              }
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-sidebar-foreground outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            />
          </div>
          <ul
            id="quick-search-results"
            role="listbox"
            className="flex max-h-[min(400px,60vh)] flex-col gap-0.5 overflow-y-auto"
          >
            {results.map((result, index) => {
              const Icon = result.icon;
              return (
                <li
                  key={result.href}
                  id={`quick-search-${index}`}
                  role="option"
                  aria-selected={index === active}
                >
                  {(index === 0 ||
                    results[index - 1].group !== result.group) && (
                    <p className="px-3 pt-2 pb-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                      {result.group}
                    </p>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseMove={() => setSelected(index)}
                    onClick={() => go(result)}
                    className={cn(navItem, index === active && navItemActive)}
                  >
                    <Icon aria-hidden className="size-[18px] shrink-0" />
                    <span className="truncate">{result.label}</span>
                    {result.detail && (
                      <span
                        className={cn(
                          "ml-auto truncate text-sm font-normal text-neutral-400 dark:text-neutral-500",
                          index === active &&
                            "text-white/80 dark:text-white/80",
                        )}
                      >
                        {result.detail}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-[15px] text-neutral-500 dark:text-neutral-400">
                {projects === null ? "Loading…" : "No results."}
              </li>
            )}
          </ul>
          <div className="flex items-center gap-4 border-t border-sidebar-border px-3 pt-2.5 pb-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <kbd className={hintKey}>↑</kbd>
              <kbd className={hintKey}>↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className={hintKey}>
                <CornerDownLeft aria-hidden className="size-3" />
              </kbd>
              to open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className={hintKey}>esc</kbd>
              to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
