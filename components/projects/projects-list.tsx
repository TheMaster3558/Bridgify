"use client";

import { DeleteProject } from "./delete-project";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Compass,
  Eye,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Play,
  Plus,
  Search,
  Sparkles,
  UserRound,
  Workflow,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import {
  DotChip,
  InitialsAvatar,
  PanelClose,
  PanelSection,
  Pill,
  SortHeader,
  filterActive,
  filterButton,
  filterIdle,
  formatShortDate,
  headCell,
  iconButton,
  menuItem,
  panelAside,
  panelFooter,
  panelHeader,
  tableCard,
  tableHead,
  tableRow,
  tableRowSelected,
  type PillTone,
} from "@/components/dashboard/table-ui";
import {
  settingsButton,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import { ClientPhotoCard } from "@/components/dashboard/client-photo";
import { clientKey } from "@/lib/clients/photos";
import { formatAgreedDate } from "@/lib/projects/draft";
import {
  projectListStatus,
  type ProjectListStatus,
} from "@/lib/projects/status";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const SETUP_STEPS = 5;

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

type SortKey = "name" | "date" | "value" | "updated";

const FILTERS: { id: "all" | ProjectListStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

const statusDot: Record<ProjectListStatus, string> = {
  active: "bg-lime-500",
  draft: "bg-neutral-400",
  paused: "bg-yellow-400",
  completed: "bg-blue-500",
  archived: "bg-neutral-300 dark:bg-neutral-600",
  unknown: "bg-rose-500",
};

const projectLinks = [
  { path: "", label: "Overview", icon: LayoutDashboard },
  { path: "/conversation", label: "Conversation", icon: MessagesSquare },
  { path: "/requests", label: "Requests", icon: Inbox },
  { path: "/work", label: "Work", icon: ListChecks },
  { path: "/scope", label: "Scope", icon: Compass },
  { path: "/proposals", label: "Proposals", icon: FileText },
  { path: "/activity", label: "Activity", icon: Activity },
  { path: "/automation", label: "Automation", icon: Workflow },
];

function workspaceHref(project: WorkspaceProject) {
  return project.status === "draft"
    ? `/app/projects/${project.id}/setup`
    : `/app/projects/${project.id}`;
}

function automation(project: WorkspaceProject): {
  label: string;
  tone: PillTone;
  detail: string;
} {
  if (project.status === "draft")
    return {
      label: "Off",
      tone: "gray",
      detail: "A draft stays off until you activate it.",
    };
  if (project.policy?.mode === "enabled" && project.status === "active")
    return {
      label: "Enabled",
      tone: "green",
      detail: "Automation is on for this project.",
    };
  if (project.policy?.mode === "review_only")
    return {
      label: "Review only",
      tone: "yellow",
      detail:
        "Requests are interpreted, and each one still needs your approval.",
    };
  return { label: "Off", tone: "gray", detail: "Automation is off." };
}

function workspaceValue(project: WorkspaceProject) {
  if (project.status === "draft") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: project.currency || "USD",
  }).format((project.original_amount_cents || 0) / 100);
}

function StateChip({ status }: { status: ProjectListStatus }) {
  return (
    <DotChip dot={statusDot[status]}>
      <span className="capitalize">
        {status === "unknown" ? "Unavailable" : status}
      </span>
    </DotChip>
  );
}

function SetupProgress({ step }: { step: number }) {
  const done = Math.min(Math.max(step - 1, 0), SETUP_STEPS);
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className="flex gap-0.5">
        {Array.from({ length: SETUP_STEPS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 w-3 rounded-full",
              index < done ? "bg-blue-500" : "bg-sidebar-accent",
            )}
          />
        ))}
      </span>
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        Setup step {step} of {SETUP_STEPS}
      </span>
    </span>
  );
}

function ProjectPanel({
  project,
  pending,
  onClose,
  photo,
  onPhotoChange,
}: {
  project: WorkspaceProject;
  pending: number;
  photo?: string | null;
  onPhotoChange: (url: string | null) => void;
  onClose: () => void;
}) {
  const status = projectListStatus(project.status);
  const draft = project.status === "draft";
  const mode = automation(project);
  const stats = [
    { label: "Approved value", value: workspaceValue(project) },
    {
      label: "Next agreed date",
      value: formatAgreedDate(project.agreed_due_date || ""),
    },
    { label: "Pending decisions", value: pending ? String(pending) : "None" },
    { label: "Last updated", value: formatShortDate(project.updated_at) },
  ];

  return (
    <>
      <header className={panelHeader}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <InitialsAvatar name={project.name} size="md" square src={photo} />
            <div className="min-w-0">
              <h2 className="truncate text-xl leading-snug font-semibold tracking-tight">
                {project.name}
              </h2>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {project.client_name || "No client name"}
              </p>
            </div>
          </div>
          <PanelClose label="Close project" onClick={onClose} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateChip status={status} />
          <Pill tone={mode.tone}>{mode.label}</Pill>
        </div>
      </header>

      <div className="grid gap-7 px-6 py-6">
        <dl className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-sidebar p-3.5">
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                {stat.label}
              </dt>
              <dd className="mt-1 truncate text-[17px] font-semibold tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        {pending > 0 && (
          <Link
            href="/app/decisions"
            className="group flex items-center gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 ring-inset outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-rose-500/10 dark:ring-rose-500/25"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-rose-500"
            />
            <span className="flex-1 text-[15px] text-rose-900 dark:text-rose-100">
              {pending} {pending === 1 ? "decision needs" : "decisions need"}{" "}
              your review
            </span>
            <ChevronRight
              aria-hidden
              className="size-4 text-rose-400 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}

        <PanelSection icon={UserRound} title="Client">
          <ClientPhotoCard
            clientName={project.client_name}
            src={photo}
            onChange={onPhotoChange}
          >
            <p className="truncate text-[15px] font-medium">
              {project.client_name}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {photo
                ? "Photo shows on every project for this client."
                : "Add a photo to show instead of initials."}
            </p>
          </ClientPhotoCard>
        </PanelSection>

        <PanelSection icon={Sparkles} title="Automation">
          <div className="grid justify-items-start gap-2 rounded-2xl bg-sidebar p-4">
            {draft ? (
              <SetupProgress step={project.setup_step} />
            ) : (
              <Pill tone={mode.tone}>{mode.label}</Pill>
            )}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {mode.detail}
            </p>
          </div>
        </PanelSection>

        {!draft && (
          <PanelSection icon={ClipboardList} title="Jump to">
            <nav
              aria-label={`${project.name} pages`}
              className="divide-y divide-card overflow-hidden rounded-2xl bg-sidebar dark:divide-background"
            >
              {projectLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.label}
                    href={`/app/projects/${project.id}${link.path}`}
                    className="group flex items-center gap-3 px-4 py-2.5 text-[15px] outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent"
                  >
                    <Icon
                      aria-hidden
                      className="size-[18px] text-neutral-500 dark:text-neutral-400"
                    />
                    <span className="flex-1">{link.label}</span>
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                );
              })}
            </nav>
          </PanelSection>
        )}
      </div>

      <div className={panelFooter}>
        <div className="flex items-center gap-2">
          <Link
            href={workspaceHref(project)}
            className={cn(settingsPrimaryButton, "h-9 gap-1.5 px-4")}
          >
            {draft ? (
              <>
                <Play aria-hidden className="size-4" />
                Resume setup
              </>
            ) : (
              <>
                <ArrowUpRight aria-hidden className="size-4" />
                Open project
              </>
            )}
          </Link>
          {!draft && (
            <Link
              href={`/app/projects/${project.id}/conversation`}
              className={cn(settingsButton, "h-9 px-3.5")}
            >
              Conversation
            </Link>
          )}
          <div className="ml-auto">
            <DeleteProject id={project.id} name={project.name} icon />
          </div>
        </div>
      </div>
    </>
  );
}

export function ProjectsList({
  workspaceProjects = [],
  serverManaged = false,
  pendingDecisions = {},
  clientPhotos = {},
}: {
  workspaceProjects?: WorkspaceProject[];
  serverManaged?: boolean;
  pendingDecisions?: Record<string, number>;
  clientPhotos?: Record<string, string>;
}) {
  const [photoOverrides, setPhotoOverrides] = useState<
    Record<string, string | null>
  >({});
  const photoFor = (name: string) => {
    const key = clientKey(name);
    return key in photoOverrides ? photoOverrides[key] : clientPhotos[key];
  };
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "updated",
    dir: "desc",
  });

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: workspaceProjects.length };
    for (const project of workspaceProjects) {
      const status = projectListStatus(project.status);
      result[status] = (result[status] ?? 0) + 1;
    }
    return result;
  }, [workspaceProjects]);

  const workspaceFiltered = useMemo(() => {
    if (serverManaged) return workspaceProjects;
    const needle = query.trim().toLowerCase();
    const direction = sort.dir === "asc" ? 1 : -1;
    return workspaceProjects
      .filter((project) => {
        const matchesState =
          filter === "all" || projectListStatus(project.status) === filter;
        const matchesName =
          !needle || project.name.toLowerCase().includes(needle);
        return matchesState && matchesName;
      })
      .sort((a, b) => {
        if (sort.key === "name")
          return a.name.localeCompare(b.name) * direction;
        if (sort.key === "value")
          return (
            ((a.status === "draft" ? -1 : a.original_amount_cents) -
              (b.status === "draft" ? -1 : b.original_amount_cents)) *
            direction
          );
        if (sort.key === "date")
          return (
            (a.agreed_due_date || "9999").localeCompare(
              b.agreed_due_date || "9999",
            ) * direction
          );
        return a.updated_at.localeCompare(b.updated_at) * direction;
      });
  }, [workspaceProjects, query, filter, sort, serverManaged]);

  const pageCount = Math.max(
    1,
    Math.ceil(workspaceFiltered.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const visible = workspaceFiltered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const emptyWorkspace = workspaceProjects.length === 0;
  const selected = workspaceProjects.find(
    (project) => project.id === selectedId,
  );

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as Element | null;
      if (event.key === "Escape" && !target?.closest?.('[role="dialog"]'))
        setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  function startProject() {
    if (starting) return;
    setStarting(true);
    router.push("/app/projects/new");
  }

  function onSort(key: SortKey) {
    if (serverManaged) {
      const params = new URLSearchParams(window.location.search);
      params.set("dir", params.get("sort") === key && params.get("dir") === "asc" ? "desc" : "asc");
      params.set("sort", key); params.delete("page");
      router.push(`?${params}`); return;
    }
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "value" ? "desc" : "asc" },
    );
  }

  return (
    <main
      className={cn(
        "mx-auto grid w-full max-w-[1280px] items-start gap-5 p-5 md:p-6",
        selected &&
          "xl:max-w-[1640px] xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]",
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every client project, its automation and its agreed value.
            </p>
          </div>
          <button
            type="button"
            onClick={startProject}
            disabled={starting}
            className={cn(settingsPrimaryButton, "h-9 gap-1.5 px-4")}
          >
            <Plus aria-hidden className="size-4" />
            {starting ? "Starting…" : "New project"}
          </button>
        </header>

        {emptyWorkspace ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sidebar-border bg-card px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-sidebar-accent text-neutral-500">
              <FolderKanban aria-hidden className="size-6" />
            </span>
            <h2 className="text-lg font-medium">Nothing here yet</h2>
            <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
              Create a project and connect its iMessage chat to start. A draft
              stays off until you activate it.
            </p>
            <button
              type="button"
              onClick={startProject}
              disabled={starting}
              className={cn(settingsPrimaryButton, "mt-1 h-9 px-4")}
            >
              Create your first project
            </button>
          </div>
        ) : (
          <>
            {!serverManaged && <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="group"
                aria-label="Filter by state"
                className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1"
              >
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={filter === item.id}
                    onClick={() => {
                      setFilter(item.id);
                      setPage(1);
                    }}
                    className={cn(
                      filterButton,
                      filter === item.id ? filterActive : filterIdle,
                    )}
                  >
                    {item.label} ({counts[item.id] ?? 0})
                  </button>
                ))}
              </div>
              <label className="flex h-9 w-full items-center gap-2 rounded-full bg-sidebar-accent px-3 text-neutral-500 focus-within:ring-[3px] focus-within:ring-sidebar-ring/40 sm:w-64 dark:text-neutral-400">
                <Search aria-hidden className="size-[18px] shrink-0" />
                <span className="sr-only">Search by name</span>
                <input
                  id="project-search"
                  value={query}
                  placeholder="Search by name"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>

            </>}
            <section aria-labelledby="projects-heading" className={tableCard}>
              <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <h2 id="projects-heading" className="text-[17px] font-medium">
                  {filter === "all"
                    ? "All projects"
                    : `${FILTERS.find((item) => item.id === filter)?.label} projects`}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Approved value is agreed work, not payment collected.
                </p>
              </div>
              {visible.length === 0 ? (
                <div className="grid place-items-center border-t border-sidebar-border px-4 py-14 text-center">
                  <Search
                    aria-hidden
                    className="mb-2 size-6 text-neutral-400"
                  />
                  <p className="text-[15px] font-medium">
                    No projects match that name and state.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className={tableHead}>
                      <tr>
                        <th scope="col" className={cn(headCell, "pl-4")}>
                          <SortHeader
                            label="Project"
                            sortKey="name"
                            sort={sort}
                            onSort={onSort}
                          />
                        </th>
                        <th scope="col" className={headCell}>
                          State
                        </th>
                        <th scope="col" className={headCell}>
                          Automation
                        </th>
                        <th
                          scope="col"
                          className={cn(headCell, "hidden @4xl:table-cell")}
                        >
                          Pending
                        </th>
                        <th
                          scope="col"
                          className={cn(headCell, "hidden @5xl:table-cell")}
                        >
                          <SortHeader
                            label="Next agreed date"
                            sortKey="date"
                            sort={sort}
                            onSort={onSort}
                          />
                        </th>
                        <th
                          scope="col"
                          className={cn(headCell, "hidden @3xl:table-cell")}
                        >
                          <SortHeader
                            label="Approved value"
                            sortKey="value"
                            sort={sort}
                            onSort={onSort}
                          />
                        </th>
                        <th
                          scope="col"
                          className={cn(headCell, "pr-4 text-right")}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((project) => {
                        const status = projectListStatus(project.status);
                        const mode = automation(project);
                        const pending = pendingDecisions[project.id] ?? 0;
                        const isSelected = selected?.id === project.id;
                        const draft = project.status === "draft";
                        return (
                          <tr
                            key={project.id}
                            onClick={() => setSelectedId(project.id)}
                            aria-selected={isSelected}
                            className={cn(
                              tableRow,
                              isSelected && tableRowSelected,
                            )}
                          >
                            <td className="py-2 pr-3 pl-4">
                              <div className="flex max-w-72 items-center gap-2.5">
                                <InitialsAvatar
                                  name={project.name}
                                  square
                                  src={photoFor(project.client_name)}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] leading-5 font-medium">
                                    {project.name}
                                  </p>
                                  <p className="truncate text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                                    {project.client_name || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <StateChip status={status} />
                            </td>
                            <td className="px-3 py-2">
                              {draft ? (
                                <SetupProgress step={project.setup_step} />
                              ) : (
                                <Pill tone={mode.tone}>{mode.label}</Pill>
                              )}
                            </td>
                            <td className="hidden px-3 py-2 @4xl:table-cell">
                              {pending ? (
                                <Pill tone="red">{pending} open</Pill>
                              ) : (
                                <span className="text-sm text-neutral-400">
                                  None
                                </span>
                              )}
                            </td>
                            <td
                              className={cn(
                                "hidden px-3 py-2 text-[15px] whitespace-nowrap tabular-nums @5xl:table-cell",
                                !project.agreed_due_date &&
                                  "text-neutral-500 dark:text-neutral-400",
                              )}
                            >
                              {formatAgreedDate(project.agreed_due_date || "")}
                            </td>
                            <td className="hidden px-3 py-2 @3xl:table-cell">
                              {draft ? (
                                <span className="text-sm text-neutral-400">
                                  —
                                </span>
                              ) : (
                                <span className="inline-flex rounded-md bg-sidebar px-2 py-1 text-sm font-medium whitespace-nowrap tabular-nums dark:bg-sidebar-accent">
                                  {workspaceValue(project)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4 pl-3">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={workspaceHref(project)}
                                  aria-label={draft ? "Resume setup" : "Open"}
                                  title={
                                    draft ? "Resume setup" : "Open project"
                                  }
                                  className={iconButton}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {draft ? (
                                    <Play aria-hidden className="size-4" />
                                  ) : (
                                    <ArrowUpRight
                                      aria-hidden
                                      className="size-4"
                                    />
                                  )}
                                </Link>
                                <DeleteProject
                                  id={project.id}
                                  name={project.name}
                                  menu
                                  menuItems={
                                    <>
                                      <DropdownMenu.Item
                                        className={menuItem}
                                        onSelect={() =>
                                          setSelectedId(project.id)
                                        }
                                      >
                                        <Eye aria-hidden className="size-4" />
                                        Preview details
                                      </DropdownMenu.Item>
                                      {!draft && (
                                        <DropdownMenu.Item
                                          asChild
                                          className={menuItem}
                                        >
                                          <Link
                                            href={`/app/projects/${project.id}/conversation`}
                                          >
                                            <MessagesSquare
                                              aria-hidden
                                              className="size-4"
                                            />
                                            Open conversation
                                          </Link>
                                        </DropdownMenu.Item>
                                      )}
                                    </>
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border px-4 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                <span>
                  {workspaceFiltered.length}{" "}
                  {workspaceFiltered.length === 1 ? "project" : "projects"}
                  {pageCount > 1
                    ? ` · page ${currentPage} of ${pageCount}`
                    : ""}
                </span>
                {pageCount > 1 ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={settingsButton}
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className={settingsButton}
                      disabled={currentPage === pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>

      {selected && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
            onClick={() => setSelectedId(null)}
          />
          <aside aria-label="Project details" className={panelAside}>
            <ProjectPanel
              key={selected.id}
              project={selected}
              pending={pendingDecisions[selected.id] ?? 0}
              photo={photoFor(selected.client_name)}
              onPhotoChange={(url) =>
                setPhotoOverrides((current) => ({
                  ...current,
                  [clientKey(selected.client_name)]: url,
                }))
              }
              onClose={() => setSelectedId(null)}
            />
          </aside>
        </>
      )}
    </main>
  );
}
