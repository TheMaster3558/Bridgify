"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  Circle,
  CircleAlert,
  Clock3,
  ListTodo,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TaskState = "In progress" | "Ready to start" | "Completed";
type Task = {
  id: string;
  title: string;
  project: string;
  client: string;
  due: string;
  state: TaskState;
  priority: "High" | "Normal";
};

const sampleTasks: Task[] = [
  {
    id: "task-1",
    title: "Send the revised homepage copy",
    project: "Website refresh",
    client: "Northstar Studio",
    due: "Today",
    state: "In progress",
    priority: "High",
  },
  {
    id: "task-2",
    title: "Review the mobile checkout flow",
    project: "Storefront improvements",
    client: "Harbor Supply Co.",
    due: "Tomorrow",
    state: "Ready to start",
    priority: "Normal",
  },
  {
    id: "task-3",
    title: "Share final logo files",
    project: "Brand identity",
    client: "Juniper & Co.",
    due: "Oct 21",
    state: "Ready to start",
    priority: "Normal",
  },
  {
    id: "task-4",
    title: "Confirm the launch checklist",
    project: "Fall campaign",
    client: "Northstar Studio",
    due: "Oct 23",
    state: "Completed",
    priority: "Normal",
  },
];

const filters = ["All tasks", "Open", "Completed"] as const;
type Filter = (typeof filters)[number];

function stateStyles(state: TaskState) {
  if (state === "In progress") {
    return "border-info/20 bg-info-soft text-info";
  }
  if (state === "Completed") {
    return "border-ok/20 bg-ok-soft text-ok";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function TasksWorkspace() {
  const [filter, setFilter] = useState<Filter>("All tasks");
  const [query, setQuery] = useState("");
  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sampleTasks.filter((task) => {
      const matchesFilter =
        filter === "All tasks" ||
        (filter === "Open" && task.state !== "Completed") ||
        (filter === "Completed" && task.state === "Completed");
      const matchesQuery =
        !normalizedQuery ||
        `${task.title} ${task.project} ${task.client}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  const openCount = sampleTasks.filter((task) => task.state !== "Completed").length;
  const completedCount = sampleTasks.length - openCount;

  return (
    <main className="mx-auto grid max-w-6xl gap-7 p-5 md:p-9">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">Actionable Tasks</span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Actionable Tasks
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Keep project work moving with a clear view of what needs to happen next.
          </p>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto">
          <ArrowDownUp aria-hidden="true" />
          Sort: Due date
        </Button>
      </header>

      <section aria-label="Task overview" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Open tasks</span>
            <span className="grid size-9 place-items-center rounded-lg bg-info-soft text-info">
              <ListTodo className="size-[18px]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{openCount}</span>
            <span className="text-sm text-muted-foreground">need your attention</span>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Due today</span>
            <span className="grid size-9 place-items-center rounded-lg bg-warn-soft text-warn">
              <Clock3 className="size-[18px]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">1</span>
            <span className="text-sm text-muted-foreground">across your projects</span>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completed</span>
            <span className="grid size-9 place-items-center rounded-lg bg-ok-soft text-ok">
              <CheckCheck className="size-[18px]" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{completedCount}</span>
            <span className="text-sm text-muted-foreground">in this view</span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b p-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Your task list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A sample preview of tasks from across your projects.
            </p>
          </div>
          <label className="relative block w-full md:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks or projects"
              aria-label="Search tasks or projects"
              className="pl-9"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-5">
          <div className="flex gap-1 rounded-lg bg-muted p-1" aria-label="Filter tasks">
            {filters.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === option
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}
                {option === "Open" && (
                  <span className="ml-2 text-xs text-muted-foreground">{openCount}</span>
                )}
              </button>
            ))}
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div className="divide-y">
          {visibleTasks.map((task) => (
            <article key={task.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_150px] md:items-center md:px-5">
              <div className="flex min-w-0 gap-3">
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                    task.state === "Completed"
                      ? "bg-ok-soft text-ok"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {task.state === "Completed" ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <h3 className={`font-medium ${task.state === "Completed" ? "text-muted-foreground line-through" : ""}`}>
                    {task.title}
                  </h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {task.project} <span className="px-1">·</span> {task.client}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={stateStyles(task.state)}>
                      {task.state}
                    </Badge>
                    {task.priority === "High" && task.state !== "Completed" && (
                      <Badge variant="outline" className="border-crit/20 bg-crit-soft text-crit">
                        <CircleAlert aria-hidden="true" />
                        High priority
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pl-11 text-sm md:justify-end md:pl-0">
                <span className={`flex items-center gap-1.5 ${task.due === "Today" ? "font-medium text-warn" : "text-muted-foreground"}`}>
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {task.due}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label={`Open ${task.title}`} disabled>
                  <ArrowUpRight aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
          {visibleTasks.length === 0 && (
            <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <Search className="size-5" aria-hidden="true" />
              </span>
              <p className="font-medium">No tasks match that search</p>
              <p className="text-sm text-muted-foreground">Try another task or project name.</p>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground md:px-5">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Preview data only. Live task syncing and task actions will be connected here.</p>
        </div>
      </section>
    </main>
  );
}
