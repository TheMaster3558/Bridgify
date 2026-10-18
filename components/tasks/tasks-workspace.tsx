"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  LayoutGrid,
  List,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TaskStatus = "ready" | "in_progress" | "blocked" | "done";
type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: "high" | "normal" | "low";
  assignee: string;
  date?: string;
  origin: "auto" | "agreement";
  originText: string;
  updated: string;
  blocked?: string;
  target?: string;
  operation?: string;
  value?: string;
  criteria?: string;
  request?: string;
};

const tasks: Task[] = [
  {
    id: "T-107",
    title: "Change homepage heading to green",
    status: "in_progress",
    priority: "normal",
    assignee: "Amogh",
    origin: "auto",
    originText: "Auto-accepted · R-1",
    updated: "Oct 14, 1:30 PM",
    target: "home.hero.heading",
    operation: "change_color",
    value: "Green (exact shade selected by owner)",
    criteria: "Homepage hero heading renders green on desktop and mobile; no other text color changes.",
    request: "Make the homepage heading green.",
  },
  {
    id: "T-108",
    title: "Replace homepage subtext",
    status: "ready",
    priority: "normal",
    assignee: "Amogh",
    origin: "auto",
    originText: "Auto-accepted · R-2",
    updated: "Oct 13, 9:40 AM",
    target: "home.hero.subtext",
    operation: "replace_text",
    value: "Fresh bread daily → Baked before sunrise, every day",
    criteria: "Subtext under the homepage heading uses the approved replacement text.",
    request: "Replace homepage subtext with the approved copy.",
  },
  {
    id: "T-103",
    title: "Build Menu page",
    status: "in_progress",
    priority: "high",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.1",
    updated: "Oct 15, 5:12 PM",
  },
  {
    id: "T-105",
    title: "Contact form delivers to bakery inbox",
    status: "blocked",
    priority: "high",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.3",
    updated: "Oct 15, 11:02 AM",
    blocked: "Waiting on the recipient email address from the client",
  },
  {
    id: "T-104",
    title: "Build Locations page (2 shops)",
    status: "ready",
    priority: "normal",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.1",
    updated: "Oct 12, 4:10 PM",
  },
  {
    id: "T-106",
    title: "Basic SEO titles and descriptions, 5 pages",
    status: "ready",
    priority: "low",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.4",
    updated: "Oct 12, 4:10 PM",
  },
  {
    id: "T-109",
    title: "Deploy to client hosting account",
    status: "ready",
    priority: "normal",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.5",
    updated: "Oct 12, 4:10 PM",
  },
  {
    id: "T-101",
    title: "Build Home page",
    status: "done",
    priority: "high",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.1",
    updated: "Oct 11, 6:40 PM",
  },
  {
    id: "T-102",
    title: "Build About page",
    status: "done",
    priority: "normal",
    assignee: "Amogh",
    date: "Nov 20 (launch)",
    origin: "agreement",
    originText: "Agreement §2.1",
    updated: "Oct 12, 2:15 PM",
  },
];

const pendingTasks = [
  { title: "Customer sign-up and sign-in (email + password)", from: "P-001 r2 · line 1" },
  { title: "Password reset by email", from: "P-001 r2 · line 2" },
  { title: "Account profile page", from: "P-001 r2 · line 3" },
];

const statusFilters: { id: "all" | TaskStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

const statusLabels: Record<TaskStatus, string> = {
  ready: "Ready",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

function statusClass(status: TaskStatus) {
  return {
    ready: "border-info/20 bg-info-soft text-info",
    in_progress: "border-accent/20 bg-accent text-accent-foreground",
    blocked: "border-warn/20 bg-warn-soft text-warn",
    done: "border-ok/20 bg-ok-soft text-ok",
  }[status];
}

function priorityClass(priority: Task["priority"]) {
  return priority === "high"
    ? "bg-foreground text-background"
    : "bg-muted text-muted-foreground";
}

export function TasksWorkspace() {
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [project, setProject] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (filter === "all" || task.status === filter) &&
          (project === "all" || project === "Harbor & Pine") &&
          (assignee === "all" || task.assignee === assignee),
      ),
    [filter, project, assignee],
  );

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-5 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Actionable Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirmed work across projects. Same records as each project’s Work tab.
            </p>
          </div>
          <Badge variant="outline" className="border-info/20 bg-info-soft text-info">
            Preview data
          </Badge>
        </header>

        <section aria-label="Task filters and view options" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-full border bg-card p-1" aria-label="Filter by status">
              {statusFilters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    filter === item.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger aria-label="Project filter" className="w-[150px] bg-card">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  <SelectItem value="Harbor & Pine">Harbor &amp; Pine</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger aria-label="Assignee filter" className="w-[150px] bg-card">
                  <SelectValue placeholder="Any assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any assignee</SelectItem>
                  <SelectItem value="Amogh">Amogh</SelectItem>
                </SelectContent>
              </Select>
              <div className="inline-flex rounded-md border bg-card p-0.5" aria-label="Choose task view">
                <Button
                  type="button"
                  variant={view === "list" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  <List aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant={view === "board" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Board view"
                  aria-pressed={view === "board"}
                  onClick={() => setView("board")}
                >
                  <LayoutGrid aria-hidden="true" />
                </Button>
              </div>
              <Button disabled title="Task creation will be connected with the task integration">
                New task
              </Button>
            </div>
          </div>
        </section>

        {view === "list" ? (
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Tasks">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Task", "Project", "Status", "Priority", "Assignee", "Agreed date", "Accepted via", "Updated"].map((heading) => (
                      <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => (
                    <tr
                      key={task.id}
                      tabIndex={0}
                      onClick={() => setSelectedTask(task)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTask(task);
                        }
                      }}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60"
                    >
                      <td className="w-[320px] min-w-[320px] px-3 py-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground">{task.id}</span>
                          <span className="min-w-0 break-words font-medium">{task.title}</span>
                        </div>
                        {task.blocked && (
                          <span className="mt-1 block text-xs text-muted-foreground">Blocked: {task.blocked}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">Harbor &amp; Pine</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={statusClass(task.status)}>{statusLabels[task.status]}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn("border-transparent capitalize", priorityClass(task.priority))}>{task.priority}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{task.assignee}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                        {task.date ?? <span className="text-muted-foreground">No date agreed</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={task.origin === "auto" ? "rounded-full bg-accent px-2 py-1 text-xs text-accent-foreground" : "text-muted-foreground"}>
                          {task.originText}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground tabular-nums">{task.updated}</td>
                    </tr>
                  ))}
                  {visibleTasks.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-14 text-center text-muted-foreground">No tasks in this view.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap justify-between gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground">
              <span>{visibleTasks.length} of {tasks.length} tasks · 25 per page</span>
              <span>Proposed work (P-001, 3 tasks) is in Proposals until approved</span>
            </footer>
          </section>
        ) : (
          <section className="overflow-x-auto pb-1" aria-label="Tasks by status">
            <div className="grid min-w-[1000px] grid-cols-5 gap-3">
              {statusFilters.slice(1).map((column) => {
                const columnTasks = tasks.filter((task) => task.status === column.id);
                return (
                  <div key={column.id} className="flex min-h-48 flex-col gap-2 rounded-lg bg-muted p-2.5">
                    <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                      {column.label}<span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span>
                    </h2>
                    {columnTasks.map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="flex flex-col gap-2 rounded-md border bg-card p-3 text-left text-sm shadow-sm hover:border-primary/50"
                      >
                        <span className="min-w-0 break-words font-medium">{task.title}</span>
                        <span className="text-xs text-muted-foreground">{task.originText} · {task.date ?? "No date agreed"}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <div className="flex min-h-48 flex-col gap-2 rounded-lg bg-muted p-2.5">
                <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                  Awaiting approval<span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">3</span>
                </h2>
                {pendingTasks.map((task) => (
                  <div key={task.title} className="flex flex-col gap-2 rounded-md border border-dashed bg-background/60 p-3 text-sm text-muted-foreground">
                    <span>{task.title}</span><span className="text-xs">{task.from} · not actionable</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Sample preview. Task state and actions aren’t connected to live project data yet.
        </p>
      </main>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button className="absolute inset-0 bg-foreground/35" aria-label="Close task details" onClick={() => setSelectedTask(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <span className="font-mono text-xs text-muted-foreground">{selectedTask.id}</span>
                <h2 id="task-detail-title" className="mt-1 font-display text-xl font-semibold">{selectedTask.title}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className={statusClass(selectedTask.status)}>{statusLabels[selectedTask.status]}</Badge>
                  <span className="capitalize text-muted-foreground">{selectedTask.priority} priority · {selectedTask.assignee}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Close task details" onClick={() => setSelectedTask(null)}><X aria-hidden="true" /></Button>
            </div>
            <div className="flex flex-col gap-6 p-5">
              <div className="flex flex-wrap gap-2">
                <Button disabled><Check aria-hidden="true" />{selectedTask.status === "ready" ? "Start task" : "Mark done"}</Button>
                <Button variant="outline" disabled>Mark blocked…</Button>
                <Button variant="outline" disabled>Cancel task…</Button>
              </div>
              {selectedTask.status === "ready" && selectedTask.origin === "auto" && (
                <div className="rounded-md border border-info/20 bg-info-soft p-3 text-sm text-info">
                  Starting this task consumes its reserved revision unit. This happens once.
                </div>
              )}
              <section className="grid gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requested change</h3>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
                  {selectedTask.operation && <><dt className="text-muted-foreground">Operation</dt><dd className="font-mono text-xs">{selectedTask.operation}</dd></>}
                  {selectedTask.target && <><dt className="text-muted-foreground">Target</dt><dd className="font-mono text-xs">{selectedTask.target}</dd></>}
                  <dt className="text-muted-foreground">{selectedTask.origin === "auto" ? "Value" : "Deliverable"}</dt><dd>{selectedTask.value ?? selectedTask.title}</dd>
                  <dt className="text-muted-foreground">Acceptance criteria</dt><dd>{selectedTask.criteria ?? "Matches the agreement description and approved design."}</dd>
                  <dt className="text-muted-foreground">Agreed date</dt><dd>{selectedTask.date ?? "No date agreed"}</dd>
                </dl>
              </section>
              <section className="grid gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why this task exists</h3>
                <blockquote className="rounded-r-md border-l-[3px] border-info bg-info-soft p-3 text-sm">
                  “{selectedTask.request ?? "Five responsive pages: Home, About, Menu, Locations, Contact."}”
                  <cite className="mt-1 block text-xs not-italic text-muted-foreground">
                    {selectedTask.origin === "auto" ? "Maya Chen · iMessage group" : `Agreement PDF · ${selectedTask.originText} · scope v1`}
                  </cite>
                </blockquote>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Authorized by</dt><dd>{selectedTask.origin === "auto" ? "Policy v3 (standing owner authorization)" : "Signed agreement"}</dd>
                  {selectedTask.request && <><dt className="text-muted-foreground">Request</dt><dd>{selectedTask.originText.split(" · ").pop()}</dd></>}
                  <dt className="text-muted-foreground">Project</dt><dd>Harbor &amp; Pine Bakery</dd>
                </dl>
              </section>
              <section className="grid gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal notes</h3>
                <div className="rounded-md border border-warn/20 bg-warn-soft p-3 text-xs text-warn">
                  Internal · never shared with the client
                </div>
                <textarea className="min-h-20 rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Add an internal note" disabled />
              </section>
              <section className="grid gap-3 rounded-lg border p-4 opacity-75">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Complete task</h3>
                <label className="grid gap-1 text-sm font-medium">What was done (internal record)<textarea className="min-h-20 rounded-md border bg-background p-3 font-normal" disabled /></label>
                <label className="grid gap-1 text-sm font-medium">Public completion note<textarea className="min-h-20 rounded-md border bg-background p-3 font-normal" disabled /></label>
                <Button disabled>Mark done</Button>
              </section>
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-4" aria-hidden="true" /> Updated {selectedTask.updated}</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
