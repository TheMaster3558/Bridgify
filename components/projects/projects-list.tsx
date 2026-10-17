"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  automationLabel,
  approvedValueLabel,
  formatAgreedDate,
  formatSavedAt,
  projectTitle,
  type ProjectDraft,
  type ProjectStatus,
} from "@/lib/projects/draft";
import { createSavedDraft, upsertProject } from "@/lib/projects/storage";
import { useHydrated, useProjectList } from "@/lib/projects/use-projects";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const FILTERS: { id: "all" | ProjectStatus; label: string }[] = [
  { id: "all", label: "All states" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

export function ProjectsList() {
  const router = useRouter();
  const hydrated = useHydrated();
  const list = useProjectList();
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ProjectDraft | null>(null);
  const projects = useMemo(() => (list.ok ? list.data : []), [list]);
  const error = actionError || (list.ok ? "" : list.error);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesState = filter === "all" || project.status === filter;
      const matchesName = !needle || projectTitle(project).toLowerCase().includes(needle);
      return matchesState && matchesName;
    });
  }, [projects, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function startProject() {
    if (starting) return;
    setStarting(true);
    const created = createSavedDraft();
    if (!created.ok) {
      setStarting(false);
      setActionError(created.error);
      return;
    }
    router.push(`/app/projects/new?project=${created.data.id}`);
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    const saved = upsertProject({
      ...archiveTarget,
      status: "archived",
      savedAt: new Date().toISOString(),
      version: archiveTarget.version + 1,
    });
    if (!saved.ok) {
      setActionError(saved.error);
      return;
    }
    setArchiveTarget(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          {hydrated ? (
            <p className="text-xs text-muted-foreground">Last refreshed {formatSavedAt(new Date().toISOString())}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="project-search">
            Search by name
          </label>
          <Input
            id="project-search"
            value={query}
            placeholder="Search by name"
            className="w-56"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <label className="sr-only" htmlFor="project-state">
            Filter by state
          </label>
          <select
            id="project-state"
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as (typeof FILTERS)[number]["id"]);
              setPage(1);
            }}
          >
            {FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Button type="button" onClick={startProject} disabled={starting}>
            {starting ? "Starting…" : "New project"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-crit/30 bg-crit-soft px-3 py-2 text-sm" role="alert">
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!hydrated ? <div className="h-48 animate-pulse rounded-lg bg-muted" /> : null}

      {hydrated && projects.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">Nothing here yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Create a project and connect its iMessage group to start. A draft stays off until you activate it.
          </p>
          <Button type="button" onClick={startProject} disabled={starting}>
            Create your first project
          </Button>
        </div>
      ) : null}

      {hydrated && projects.length > 0 ? (
        <section className="overflow-hidden rounded-lg border bg-card">
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No projects match that name and state.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Client</th>
                    <th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 font-medium">Automation</th>
                    <th className="px-3 py-2 font-medium">Pending decisions</th>
                    <th className="px-3 py-2 font-medium">Next agreed date</th>
                    <th className="px-3 py-2 text-right font-medium">Approved value</th>
                    <th className="px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((project) => (
                    <tr key={project.id} className="border-t">
                      <td className="px-3 py-3 font-medium">
                        <Link href={`/app/projects/new?project=${project.id}`} className="underline-offset-2 hover:underline">
                          {projectTitle(project)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{project.basics.clientName || "—"}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={project.status} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{automationLabel(project)}</td>
                      <td className="px-3 py-3 tabular-nums">0</td>
                      <td className="px-3 py-3 tabular-nums">{formatAgreedDate(project.basics.agreedDate)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{approvedValueLabel(project)}</td>
                      <td className="px-3 py-3">
                        {project.status === "active" || project.status === "completed" ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setArchiveTarget(project)}>
                            Archive…
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>
              {filtered.length} {filtered.length === 1 ? "project" : "projects"}
              {pageCount > 1 ? ` · page ${currentPage} of ${pageCount}` : ""}
            </span>
            <span>Drafts are saved in this browser. Approved value is agreed work, not payment collected.</span>
            {pageCount > 1 ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {archiveTarget ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/30 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="archive-title" className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
            <h2 id="archive-title" className="text-lg font-semibold">
              Archive {projectTitle(archiveTarget)}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Archived projects stop accepting new work. The setup and history stay in this list.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setArchiveTarget(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmArchive}>
                Archive project
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        status === "active" && "bg-ok-soft text-ok",
        status === "draft" && "bg-secondary text-muted-foreground",
        status === "completed" && "bg-info-soft text-info",
        status === "archived" && "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}
