"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CircleDot,
  ClipboardList,
  Eye,
  History,
  LayoutGrid,
  List,
  Lock,
  MessageCircle,
  Minus,
  MoreVertical,
  Plus,
  Search,
} from "lucide-react";
import { Checkbox, DropdownMenu } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  headCell,
  iconButton,
  menuContent,
  menuItem,
  panelAside,
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
import { clientKey } from "@/lib/clients/photos";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";
import { TaskStatusActions } from "./task-status-actions";

type Task = DashboardTask;
type TaskStatus = Exclude<Task["status"], "cancelled">;
type SortKey = "title" | "priority" | "date" | "updated";

function taskCriteriaLabel(value: string) {
  try {
    const payload = JSON.parse(value);
    const instructions =
      payload?.instructions ??
      payload?.ownerReviewedCorrection?.payload?.instructions;
    return typeof instructions === "string" ? instructions : value;
  } catch {
    return value;
  }
}

const statusFilters: { id: "all" | TaskStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

const statusLabels: Record<Task["status"], string> = {
  ready: "Ready",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const statusDot: Record<Task["status"], string> = {
  ready: "bg-blue-500",
  in_progress: "bg-violet-500",
  blocked: "bg-rose-500",
  done: "bg-lime-500",
  cancelled: "bg-neutral-400",
};

const priorityTone: Record<Task["priority"], PillTone> = {
  high: "red",
  normal: "blue",
  low: "gray",
};

const priorityRank: Record<Task["priority"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

const originTone: Record<Task["origin"], PillTone> = {
  auto: "cyan",
  agreement: "green",
  proposal: "blue",
  manual: "gray",
};

// Bulk changes are limited to statuses that don't require an internal note.
const bulkStatuses: { id: "in_progress" | "done"; label: string }[] = [
  { id: "in_progress", label: "Mark in progress" },
  { id: "done", label: "Mark done" },
];

function displayDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "short", day: "2-digit" },
  );
}

function StatusChip({ status }: { status: Task["status"] }) {
  return <DotChip dot={statusDot[status]}>{statusLabels[status]}</DotChip>;
}

function PriorityPill({ priority }: { priority: Task["priority"] }) {
  return (
    <Pill tone={priorityTone[priority]}>
      <span className="capitalize">{priority}</span>
    </Pill>
  );
}

function SelectBox({
  checked,
  label,
  onChange,
}: {
  checked: boolean | "indeterminate";
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox.Root
      checked={checked}
      aria-label={label}
      onCheckedChange={(value) => onChange(value === true)}
      onClick={(event) => event.stopPropagation()}
      className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-neutral-300 bg-card text-white outline-none transition-colors hover:border-neutral-400 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 data-[state=checked]:border-[#2563eb] data-[state=checked]:bg-[#2563eb] data-[state=indeterminate]:border-[#2563eb] data-[state=indeterminate]:bg-[#2563eb] dark:border-neutral-600 dark:bg-background"
    >
      <Checkbox.Indicator>
        {checked === "indeterminate" ? (
          <Minus aria-hidden className="size-3.5" strokeWidth={3} />
        ) : (
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        )}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}

async function patchStatus(task: Task, status: Task["status"]) {
  const response = await fetch(`/api/v1/tasks/${task.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      note: "",
      expectedUpdatedAt: task.updated_at,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.error?.message ?? "Task could not be saved.");
  return { ...task, ...result.data, status } as Task;
}

function TaskDetail({
  task,
  photo,
  onClose,
  onSaved,
}: {
  task: Task;
  photo?: string | null;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const details = [
    task.operation && {
      label: "Operation",
      value:
        task.operation === "project_change" ? "Project change" : task.operation,
      mono: true,
    },
    task.target_id && { label: "Target", value: task.target_id, mono: true },
    {
      label: task.origin === "auto" ? "Value" : "Deliverable",
      value: task.value ?? task.title,
    },
    task.acceptance_criteria && {
      label: "Acceptance criteria",
      value: taskCriteriaLabel(task.acceptance_criteria),
    },
    {
      label: "Agreed date",
      value: displayDate(task.agreed_due_date) ?? "No date agreed",
    },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];
  const provenance = [
    task.request_code && { label: "Request", value: task.request_code },
    task.authorized_by && { label: "Authorized by", value: task.authorized_by },
    task.revision_unit && { label: "Revision unit", value: task.revision_unit },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <header className={panelHeader}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="rounded-md bg-sidebar px-1.5 py-0.5 dark:bg-sidebar-accent">
              {task.task_code}
            </span>
            {task.request_code && (
              <span className="rounded-md bg-sidebar px-1.5 py-0.5 dark:bg-sidebar-accent">
                {task.request_code}
              </span>
            )}
          </div>
          <PanelClose label="Close task details" onClick={onClose} />
        </div>
        <h2
          id="task-detail-title"
          className="text-xl leading-snug font-semibold tracking-tight break-words"
        >
          {task.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={task.status} />
          <PriorityPill priority={task.priority} />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {task.assignee || "Unassigned"}
          </span>
        </div>
      </header>

      <div className="grid gap-7 px-6 py-6">
        <Link
          href={`/app/projects/${task.project_id}/work`}
          className="group flex items-center gap-3 rounded-2xl bg-sidebar p-3 outline-none hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
        >
          <InitialsAvatar name={task.client_name} size="md" src={photo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">
              {task.client_name}
            </span>
            <span className="block truncate text-sm text-neutral-500 dark:text-neutral-400">
              {task.project_name} · Work
            </span>
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>

        {task.status === "blocked" && task.blocked_reason && (
          <div className="flex gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 ring-inset dark:bg-rose-500/10 dark:ring-rose-500/25">
            <span
              aria-hidden
              className="mt-1.5 size-2 shrink-0 rounded-full bg-rose-500"
            />
            <p className="text-[15px] text-rose-900 dark:text-rose-100">
              <span className="font-medium">Blocked:</span>{" "}
              {task.blocked_reason}
            </p>
          </div>
        )}

        <PanelSection icon={ClipboardList} title="Requested change">
          <dl className="divide-y divide-card overflow-hidden rounded-2xl bg-sidebar dark:divide-background">
            {details.map((item) => (
              <div key={item.label} className="grid gap-0.5 px-4 py-3">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {item.label}
                </dt>
                <dd
                  className={cn(
                    "text-[15px] break-words",
                    item.mono && "font-mono text-xs",
                  )}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </PanelSection>

        <PanelSection icon={MessageCircle} title="Why this task exists">
          {task.source_text ? (
            <div className="flex items-end gap-2.5">
              <InitialsAvatar name={task.client_name} src={photo} />
              <div className="min-w-0">
                <div className="w-fit max-w-full rounded-[20px] rounded-bl-md bg-sidebar-accent px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {task.source_text}
                </div>
                <p className="mt-1 pl-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {task.source_meta ?? task.origin_text}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No linked source message is recorded.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={originTone[task.origin]}>{task.origin_text}</Pill>
            {provenance.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 rounded-md bg-sidebar px-2 py-0.5 text-sm dark:bg-sidebar-accent"
              >
                <span className="text-neutral-500 dark:text-neutral-400">
                  {item.label}
                </span>
                {item.value}
              </span>
            ))}
          </div>
        </PanelSection>

        <div className="flex gap-3 rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200 ring-inset dark:bg-yellow-400/10 dark:ring-yellow-400/25">
          <Lock
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-yellow-700 dark:text-yellow-300"
          />
          <div>
            <p className="text-xs font-semibold tracking-wide text-yellow-800 uppercase dark:text-yellow-200">
              Internal notes · owner only
            </p>
            <p className="mt-1 text-[15px] text-yellow-950 dark:text-yellow-50">
              {task.internal_note ?? "No internal note recorded."}
            </p>
          </div>
        </div>

        <PanelSection icon={History} title="History">
          <ol className="relative grid gap-3 pl-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-sidebar-border">
            {[
              `Updated ${new Date(task.updated_at).toLocaleString()}`,
              ...task.history,
            ].map((item, index) => (
              <li
                key={`${task.id}-history-${index}`}
                className="relative text-sm text-neutral-600 dark:text-neutral-300"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 -left-5 size-[11px] rounded-full border-2 border-card dark:border-background",
                    index === 0
                      ? "bg-blue-500"
                      : "bg-neutral-300 dark:bg-neutral-600",
                  )}
                />
                {item}
              </li>
            ))}
          </ol>
        </PanelSection>
      </div>

      <TaskStatusActions key={task.id} task={task} onSaved={onSaved} />
    </>
  );
}

export function TasksWorkspace({
  tasks,
  clientPhotos = {},
  serverManaged = false,
}: {
  tasks: Task[];
  clientPhotos?: Record<string, string>;
  serverManaged?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] =
    useState<(typeof statusFilters)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [project, setProject] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, Task>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "updated",
    dir: "desc",
  });

  const allTasks = useMemo(
    () => tasks.map((task) => saved[task.id] ?? task),
    [tasks, saved],
  );
  const projects = useMemo(
    () => [
      ...new Map(
        allTasks.map((task) => [task.project_id, task.project_name]),
      ).entries(),
    ],
    [allTasks],
  );
  const assignees = useMemo(
    () => [...new Set(allTasks.map((task) => task.assignee).filter(Boolean))],
    [allTasks],
  );
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: allTasks.length };
    for (const task of allTasks)
      result[task.status] = (result[task.status] ?? 0) + 1;
    return result;
  }, [allTasks]);
  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allTasks.filter(
      (task) =>
        (project === "all" || task.project_id === project) &&
        (assignee === "all" || task.assignee === assignee) &&
        (!needle ||
          task.title.toLowerCase().includes(needle) ||
          task.task_code.toLowerCase().includes(needle)),
    );
  }, [allTasks, project, assignee, query]);
  const visibleTasks = useMemo(() => {
    if (serverManaged) return allTasks;
    const direction = sort.dir === "asc" ? 1 : -1;
    return scoped
      .filter((task) => filter === "all" || task.status === filter)
      .sort((a, b) => {
        if (sort.key === "title")
          return a.title.localeCompare(b.title) * direction;
        if (sort.key === "priority")
          return (
            (priorityRank[a.priority] - priorityRank[b.priority]) * direction
          );
        if (sort.key === "date")
          return (
            (a.agreed_due_date || "9999").localeCompare(
              b.agreed_due_date || "9999",
            ) * direction
          );
        return a.updated_at.localeCompare(b.updated_at) * direction;
      });
  }, [scoped, filter, sort, serverManaged, allTasks]);
  const selected = allTasks.find((task) => task.id === selectedId);
  const checkedVisible = visibleTasks.filter((task) =>
    checkedIds.includes(task.id),
  );
  const allChecked: boolean | "indeterminate" =
    checkedVisible.length === 0
      ? false
      : checkedVisible.length === visibleTasks.length
        ? true
        : "indeterminate";
  const photoFor = (name: string) => clientPhotos[clientKey(name)];

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as Element | null;
      if (
        event.key === "Escape" &&
        !target?.closest?.('[role="dialog"],[role="listbox"],[role="menu"]')
      )
        setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

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
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
  }

  function remember(task: Task) {
    setSaved((current) => ({ ...current, [task.id]: task }));
  }

  async function bulkUpdate(status: "in_progress" | "done") {
    const targets = checkedVisible.filter((task) => task.status !== status);
    if (!targets.length) return;
    setBulkBusy(true);
    setBulkError("");
    const results = await Promise.allSettled(
      targets.map((task) => patchStatus(task, status)),
    );
    const updated = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    setSaved((current) => ({
      ...current,
      ...Object.fromEntries(updated.map((task) => [task.id, task])),
    }));
    const failed = targets.filter(
      (_, index) => results[index].status === "rejected",
    );
    setCheckedIds(failed.map((task) => task.id));
    if (failed.length)
      setBulkError(
        `${failed.length} of ${targets.length} tasks could not be updated. They may have changed; refresh and try again.`,
      );
    setBulkBusy(false);
    router.refresh();
  }

  const selectTrigger =
    "h-9 w-[170px] rounded-full border-0 bg-sidebar-accent px-3.5 text-sm font-medium shadow-none";

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
            <h1 className="font-display text-2xl font-semibold">
              Actionable Tasks
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirmed work across projects. Same records as each project’s
              Work tab.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Choose task view"
              className="flex items-center gap-1 rounded-full bg-sidebar-accent p-1"
            >
              {(
                [
                  ["list", "List view", List],
                  ["board", "Board view", LayoutGrid],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-neutral-500 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-400",
                    view === id &&
                      "bg-card text-foreground shadow-sm dark:bg-neutral-700 dark:text-white",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled
              title="Task creation will be connected with the work-management workflow"
              className={cn(settingsPrimaryButton, "h-9 gap-1.5 px-4")}
            >
              <Plus aria-hidden className="size-4" />
              New task
            </button>
          </div>
        </header>

        {!serverManaged && <>
        <section
          aria-label="Task filters and view options"
          className="grid gap-3"
        >
          <div
            role="group"
            aria-label="Filter by status"
            className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1"
          >
            {statusFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => {
                  setFilter(item.id);
                  setCheckedIds([]);
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
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 w-full items-center gap-2 rounded-full bg-sidebar-accent px-3 text-neutral-500 focus-within:ring-[3px] focus-within:ring-sidebar-ring/40 sm:w-64 dark:text-neutral-400">
              <Search aria-hidden className="size-[18px] shrink-0" />
              <span className="sr-only">Search tasks</span>
              <input
                value={query}
                placeholder="Search tasks"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCheckedIds([]);
                }}
              />
            </label>
            <Select
              value={project}
              onValueChange={(value) => {
                setProject(value);
                setCheckedIds([]);
              }}
            >
              <SelectTrigger
                aria-label="Project filter"
                className={selectTrigger}
              >
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={assignee}
              onValueChange={(value) => {
                setAssignee(value);
                setCheckedIds([]);
              }}
            >
              <SelectTrigger
                aria-label="Assignee filter"
                className={cn(selectTrigger, "w-[150px]")}
              >
                <SelectValue placeholder="Any assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any assignee</SelectItem>
                {assignees.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        </>}
        {view === "list" ? (
          <section aria-labelledby="tasks-heading" className={tableCard}>
            <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <h2 id="tasks-heading" className="text-[17px] font-medium">
                {filter === "all"
                  ? "All tasks"
                  : `${statusLabels[filter]} tasks`}
              </h2>
              {checkedVisible.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {checkedVisible.length} selected
                  </span>
                  <button
                    type="button"
                    className={settingsButton}
                    disabled={bulkBusy}
                    onClick={() => {
                      setCheckedIds([]);
                      setBulkError("");
                    }}
                  >
                    Clear
                  </button>
                  {bulkStatuses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(settingsButton, "gap-1.5")}
                      disabled={bulkBusy}
                      onClick={() => void bulkUpdate(item.id)}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          statusDot[item.id],
                        )}
                      />
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Proposed work appears in Proposals until approved.
                </p>
              )}
            </div>
            {bulkError && (
              <p role="alert" className="px-4 pb-2.5 text-sm text-crit">
                {bulkError}
              </p>
            )}
            {visibleTasks.length === 0 ? (
              <div className="grid place-items-center border-t border-sidebar-border px-4 py-14 text-center">
                <ClipboardList
                  aria-hidden
                  className="mb-2 size-6 text-neutral-400"
                />
                <p className="text-[15px] font-medium">No tasks to show</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Tasks recorded for your projects will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className={tableHead}>
                    <tr>
                      <th scope="col" className="w-0 py-2.5 pr-1 pl-4">
                        <SelectBox
                          checked={allChecked}
                          label="Select all tasks"
                          onChange={(value) =>
                            setCheckedIds(
                              value ? visibleTasks.map((task) => task.id) : [],
                            )
                          }
                        />
                      </th>
                      <th scope="col" className={cn(headCell, "pl-2")}>
                        <SortHeader
                          label="Task"
                          sortKey="title"
                          sort={sort}
                          onSort={onSort}
                        />
                      </th>
                      <th scope="col" className={headCell}>
                        Project
                      </th>
                      <th scope="col" className={headCell}>
                        Status
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "hidden @3xl:table-cell")}
                      >
                        <SortHeader
                          label="Priority"
                          sortKey="priority"
                          sort={sort}
                          onSort={onSort}
                        />
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "hidden @5xl:table-cell")}
                      >
                        Assignee
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "hidden @4xl:table-cell")}
                      >
                        <SortHeader
                          label="Agreed date"
                          sortKey="date"
                          sort={sort}
                          onSort={onSort}
                        />
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "hidden @6xl:table-cell")}
                      >
                        Accepted via
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
                    {visibleTasks.map((task) => {
                      const isSelected = selected?.id === task.id;
                      const isChecked = checkedIds.includes(task.id);
                      return (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedId(task.id)}
                          aria-selected={isSelected}
                          className={cn(
                            tableRow,
                            (isSelected || isChecked) && tableRowSelected,
                          )}
                        >
                          <td className="py-2 pr-1 pl-4">
                            <SelectBox
                              checked={isChecked}
                              label={`Select ${task.title}`}
                              onChange={(value) =>
                                setCheckedIds((current) =>
                                  value
                                    ? [...current, task.id]
                                    : current.filter((id) => id !== task.id),
                                )
                              }
                            />
                          </td>
                          <td className="py-2 pr-3 pl-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(task.id);
                              }}
                              aria-current={isSelected ? "true" : undefined}
                              className="block max-w-[26rem] min-w-44 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                            >
                              <span className="line-clamp-1 text-[15px] leading-5 font-medium text-foreground">
                                {task.title}
                              </span>
                              <span
                                className={cn(
                                  "line-clamp-1 text-sm leading-5",
                                  task.status === "blocked" &&
                                    task.blocked_reason
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "font-mono text-xs text-neutral-500 dark:text-neutral-400",
                                )}
                              >
                                {task.status === "blocked" &&
                                task.blocked_reason
                                  ? `Blocked: ${task.blocked_reason}`
                                  : task.task_code}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex max-w-56 items-center gap-2.5">
                              <InitialsAvatar
                                name={task.client_name}
                                src={photoFor(task.client_name)}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-[15px] leading-5">
                                  {task.project_name}
                                </p>
                                <p className="truncate text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                                  {task.client_name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusChip status={task.status} />
                          </td>
                          <td className="hidden px-3 py-2 @3xl:table-cell">
                            <PriorityPill priority={task.priority} />
                          </td>
                          <td className="hidden px-3 py-2 text-[15px] whitespace-nowrap @5xl:table-cell">
                            {task.assignee || (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="hidden px-3 py-2 text-[15px] whitespace-nowrap tabular-nums @4xl:table-cell">
                            {displayDate(task.agreed_due_date) ?? (
                              <span className="text-neutral-500 dark:text-neutral-400">
                                No date agreed
                              </span>
                            )}
                          </td>
                          <td className="hidden px-3 py-2 @6xl:table-cell">
                            <Pill tone={originTone[task.origin]}>
                              {task.origin_text}
                            </Pill>
                          </td>
                          <td className="py-2 pr-4 pl-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                aria-label={`Review ${task.title}`}
                                className={iconButton}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedId(task.id);
                                }}
                              >
                                <Eye aria-hidden className="size-4" />
                              </button>
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger
                                  aria-label={`More actions for ${task.title}`}
                                  className={iconButton}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreVertical
                                    aria-hidden
                                    className="size-4"
                                  />
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    sideOffset={6}
                                    className={menuContent}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <DropdownMenu.Item
                                      className={menuItem}
                                      onSelect={() => setSelectedId(task.id)}
                                    >
                                      <Eye aria-hidden className="size-4" />
                                      Review task
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      asChild
                                      className={menuItem}
                                    >
                                      <Link
                                        href={`/app/projects/${task.project_id}/work`}
                                      >
                                        <ArrowUpRight
                                          aria-hidden
                                          className="size-4"
                                        />
                                        Open project work
                                      </Link>
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="flex flex-wrap justify-between gap-2 border-t border-sidebar-border px-4 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
              <span>
                {visibleTasks.length} of {allTasks.length} tasks
              </span>
            </footer>
          </section>
        ) : (
          <section
            className="overflow-x-auto pb-1"
            aria-label="Tasks by status"
          >
            <div className="grid min-w-[1000px] grid-cols-5 gap-3">
              {statusFilters.slice(1).map((column) => {
                const columnTasks = scoped
                  .filter((task) => task.status === column.id)
                  .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
                return (
                  <div
                    key={column.id}
                    className="flex min-h-48 flex-col gap-2 rounded-2xl bg-sidebar p-2.5"
                  >
                    <h2 className="flex items-center gap-2 px-1.5 py-1 text-sm font-medium">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          statusDot[column.id as TaskStatus],
                        )}
                      />
                      {column.label}
                      <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-neutral-500 dark:bg-background dark:text-neutral-400">
                        {columnTasks.length}
                      </span>
                    </h2>
                    {columnTasks.map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => setSelectedId(task.id)}
                        className={cn(
                          "grid min-w-0 gap-2.5 rounded-xl bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-sidebar-border outline-none transition-shadow hover:ring-blue-300 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-background",
                          selected?.id === task.id && "ring-2 ring-blue-500",
                        )}
                      >
                        <span className="min-w-0 text-[15px] leading-snug font-medium break-words">
                          {task.title}
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <InitialsAvatar
                            name={task.client_name}
                            src={photoFor(task.client_name)}
                          />
                          <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                            {task.project_name}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <PriorityPill priority={task.priority} />
                          <span className="rounded-md bg-sidebar px-1.5 py-0.5 text-xs tabular-nums dark:bg-sidebar-accent">
                            {displayDate(task.agreed_due_date) ?? "No date"}
                          </span>
                          <span className="ml-auto font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                            {task.task_code}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <div className="flex min-h-48 flex-col gap-2 rounded-2xl border border-dashed border-sidebar-border p-2.5">
                <h2 className="flex items-center gap-2 px-1.5 py-1 text-sm font-medium">
                  <CircleDot
                    aria-hidden
                    className="size-3.5 text-neutral-400"
                  />
                  Awaiting approval
                </h2>
                <p className="rounded-xl bg-sidebar p-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Proposed deliverables remain in Proposals until approval
                  creates tasks.
                </p>
              </div>
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Task status is saved to your workspace and used in automatic client
          status replies.
        </p>
      </div>

      {selected && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
            onClick={() => setSelectedId(null)}
          />
          <aside aria-labelledby="task-detail-title" className={panelAside}>
            <TaskDetail
              task={selected}
              photo={photoFor(selected.client_name)}
              onClose={() => setSelectedId(null)}
              onSaved={remember}
            />
          </aside>
        </>
      )}
    </main>
  );
}
