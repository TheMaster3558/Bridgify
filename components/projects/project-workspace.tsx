"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronRight,
  FileSignature,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Settings2,
  Scale,
} from "lucide-react";
import { DotChip, InitialsAvatar } from "@/components/dashboard/table-ui";
import type { Project } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

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

const tabIcons: Record<(typeof projectTabs)[number][0], typeof Activity> = {
  "": LayoutDashboard,
  work: ListChecks,
  requests: Inbox,
  scope: Scale,
  proposals: FileSignature,
  conversation: MessagesSquare,
  activity: Activity,
  automation: Bot,
};

function automationState(project: Project) {
  const mode = project.policy?.mode;
  if (!mode)
    return { label: "Automation not configured", dot: "bg-neutral-400" };
  if (project.status === "paused")
    return { label: "Automation paused", dot: "bg-warn" };
  if (mode === "review_only") return { label: "Review only", dot: "bg-info" };
  if (project.status === "active" && mode === "enabled")
    return { label: "Automation on", dot: "bg-ok" };
  return { label: "Automation not active", dot: "bg-neutral-400" };
}

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
  const automation = automationState(project);
  const statusDot =
    project.status === "active"
      ? "bg-ok"
      : project.status === "paused"
        ? "bg-warn"
        : "bg-neutral-400";
  return (
    <div className="project-workspace min-h-screen min-w-0 max-w-full overflow-hidden bg-background text-foreground">
      <header className="border-b border-sidebar-border bg-card">
        <div className="mx-auto grid max-w-[1280px] gap-5 px-5 pt-5 md:px-6">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link
              className="rounded hover:text-foreground"
              href="/app/projects"
            >
              Projects
            </Link>
            <ChevronRight aria-hidden className="size-3.5 shrink-0" />
            <Link
              className="truncate rounded hover:text-foreground"
              href={root}
            >
              {project.name}
            </Link>
            <ChevronRight aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate text-foreground">
              {active?.[1] || "Project"}
            </span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <InitialsAvatar
                name={project.client_name || project.name}
                size="lg"
                square
              />
              <div className="grid min-w-0 gap-2">
                <h1 className="truncate font-display text-[28px] leading-tight font-semibold tracking-tight">
                  {project.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="mr-1 text-muted-foreground">
                    for {project.client_name}
                  </span>
                  <DotChip dot={statusDot}>
                    <span className="capitalize">
                      {project.status.replaceAll("_", " ")}
                    </span>
                  </DotChip>
                  <DotChip dot={automation.dot}>
                    {automation.label}
                    {project.policy?.mode && (
                      <span className="text-muted-foreground">
                        · policy v{project.policy_version}
                      </span>
                    )}
                  </DotChip>
                  <DotChip
                    dot={
                      project.scope_version ? "bg-primary" : "bg-neutral-400"
                    }
                  >
                    {project.scope_version
                      ? `Scope v${project.scope_version}`
                      : "Scope unconfirmed"}
                  </DotChip>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-medium">
              <Link
                href={`${root}/setup`}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-sidebar-accent px-4 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
              >
                <Settings2 aria-hidden className="size-4" />
                {project.activation_cutoff ? "Project setup" : "Resume setup"}
              </Link>
              <Link
                href={`/app/decisions?project=${project.id}`}
                className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
              >
                Review decisions
              </Link>
            </div>
          </div>
          <nav
            aria-label="Project sections"
            className="-mx-1 -mb-px flex gap-1 overflow-x-auto"
          >
            {projectTabs.map(([segment, label]) => {
              const Icon = tabIcons[segment];
              const current = active?.[0] === segment;
              return (
                <Link
                  key={segment}
                  href={segment ? `${root}/${segment}` : root}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "group flex shrink-0 items-center gap-2 border-b-2 px-3 pt-2 pb-3 text-sm font-medium outline-none transition-colors focus-visible:text-foreground",
                    current
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4",
                      current
                        ? "text-primary"
                        : "opacity-70 group-hover:opacity-100",
                    )}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
