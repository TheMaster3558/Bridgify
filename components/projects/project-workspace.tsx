"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Project } from "@/lib/domain/types";

export const projectTabs = [
  ["", "Overview"],
  ["work", "Work"],
  ["requests", "Requests"],
  ["scope", "Scope & Revisions"],
  ["proposals", "Proposals"],
  ["conversation", "Conversation"],
  ["activity", "Activity"],
  ["automation", "Automation"],
] as const;
export function ProjectWorkspace({
  project,
  children,
}: {
  project: Project;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const root = `/app/projects/${project.id}`;
  if (path === `${root}/setup`) return children;
  const active = projectTabs.find(([segment]) =>
    segment
      ? path === `${root}/${segment}` || path.startsWith(`${root}/${segment}/`)
      : path === root,
  );
  const mode = project.policy?.mode;
  return (
    <div className="project-workspace min-h-screen bg-background text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4 text-sm text-muted-foreground lg:px-8">
        <p>
          <Link className="hover:text-foreground" href="/app/projects">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-foreground">{project.name}</span>
          <span className="mx-2">/</span>
          {active?.[1] || "Project"}
        </p>
        <span>Project workspace</span>
      </div>
      <header className="border-b bg-card px-5 pt-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-5 pb-6">
          <div className="grid gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{project.client_name}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${project.status === "active" ? "bg-ok-soft text-ok" : "bg-muted text-muted-foreground"}`}
              >
                {project.status.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs">
                {mode
                  ? `${project.status === "active" && mode === "enabled" ? "Automation on" : project.status === "paused" ? "Automation paused" : mode === "review_only" ? "Review only" : "Automation not active"} · policy v${project.policy_version}`
                  : "Automation not configured"}
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs">
                {project.scope_version
                  ? `Scope v${project.scope_version}`
                  : "Scope unconfirmed"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link
              href={`${root}/setup`}
              className="rounded-md border px-4 py-2.5 hover:bg-muted"
            >
              {project.activation_cutoff ? "Project setup" : "Resume setup"}
            </Link>
            <Link
              href="/app/decisions"
              className="rounded-md bg-primary px-4 py-2.5 text-primary-foreground hover:opacity-90"
            >
              Review decisions
            </Link>
          </div>
        </div>
        <nav
          aria-label="Project sections"
          className="-mb-px flex gap-1 overflow-x-auto"
        >
          {projectTabs.map(([segment, label]) => (
            <Link
              key={segment}
              href={segment ? `${root}/${segment}` : root}
              aria-current={active?.[0] === segment ? "page" : undefined}
              className={`shrink-0 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${active?.[0] === segment ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
