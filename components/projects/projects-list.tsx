"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAgreedDate, type ProjectStatus } from "@/lib/projects/draft";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export type WorkspaceProject = {
  id: string;
  name: string;
  client_name: string;
  status: string;
  setup_step: number;
  original_amount_cents: number;
  currency: string;
  agreed_due_date: string | null;
  policy: { mode?: string } | null;
  updated_at: string;
};

const FILTERS: { id: "all" | ProjectStatus; label: string }[] = [
  { id: "all", label: "All states" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

function workspaceHref(project: WorkspaceProject) {
  return project.status === "draft"
    ? `/app/projects/${project.id}/setup`
    : `/app/projects/${project.id}`;
}

function workspaceAutomation(project: WorkspaceProject) {
  if (project.status === "draft")
    return `off (setup step ${project.setup_step} of 5)`;
  if (project.policy?.mode === "enabled" && project.status === "active")
    return "Enabled";
  if (project.policy?.mode === "review_only") return "Review only";
  return "off";
}

function workspaceValue(project: WorkspaceProject) {
  if (project.status === "draft") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: project.currency || "USD",
  }).format((project.original_amount_cents || 0) / 100);
}

export function ProjectsList({
  workspaceProjects = [],
}: {
  workspaceProjects?: WorkspaceProject[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);

  const workspaceFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return workspaceProjects.filter((project) => {
      const matchesState = filter === "all" || project.status === filter;
      const matchesName =
        !needle || project.name.toLowerCase().includes(needle);
      return matchesState && matchesName;
    });
  }, [workspaceProjects, query, filter]);

  const pageCount = Math.max(1, Math.ceil(workspaceFiltered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = workspaceFiltered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const emptyWorkspace = workspaceProjects.length === 0;

  function startProject() {
    if (starting) return;
    setStarting(true);
    router.push("/app/projects/new");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
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

      {emptyWorkspace ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">Nothing here yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Create a project and connect its iMessage chat to start. A draft
            stays off until you activate it.
          </p>
          <Button type="button" onClick={startProject} disabled={starting}>
            Create your first project
          </Button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card">
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              No projects match that name and state.
            </p>
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
                    <th className="px-3 py-2 text-right font-medium">
                      Approved value
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((project) => (
                    <tr key={project.id} className="border-t">
                      <td className="px-3 py-3 font-medium">
                        <Link
                          href={workspaceHref(project)}
                          className="underline-offset-2 hover:underline"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{project.client_name || "—"}</td>
                      <td className="px-3 py-3">
                        <StatusPill
                          status={
                            project.status === "active" ||
                            project.status === "draft" ||
                            project.status === "completed" ||
                            project.status === "archived"
                              ? project.status
                              : "draft"
                          }
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {workspaceAutomation(project)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">0</td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatAgreedDate(project.agreed_due_date || "")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {workspaceValue(project)}
                      </td>
                      <td className="px-3 py-3">
                        {project.status === "draft" ? (
                          <Link
                            href={workspaceHref(project)}
                            className="text-sm underline"
                          >
                            Resume setup
                          </Link>
                        ) : (
                          <Link
                            href={workspaceHref(project)}
                            className="text-sm underline"
                          >
                            Open
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>
              {workspaceFiltered.length}{" "}
              {workspaceFiltered.length === 1 ? "project" : "projects"}
              {pageCount > 1 ? ` · page ${currentPage} of ${pageCount}` : ""}
            </span>
            <span>Approved value is agreed work, not payment collected.</span>
            {pageCount > 1 ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
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
      )}
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
