"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, LayoutGrid, List, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

type TaskStatus = Exclude<DashboardTask["status"], "cancelled">;
const statusFilters: { id: "all" | TaskStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];
const statusLabels: Record<DashboardTask["status"], string> = {
  ready: "Ready", in_progress: "In progress", blocked: "Blocked", done: "Done", cancelled: "Cancelled",
};
const statusClass: Record<DashboardTask["status"], string> = {
  ready: "border-info/20 bg-info-soft text-info",
  in_progress: "border-accent/20 bg-accent text-accent-foreground",
  blocked: "border-warn/20 bg-warn-soft text-warn",
  done: "border-ok/20 bg-ok-soft text-ok",
  cancelled: "border-border bg-muted text-muted-foreground",
};

function displayDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function TasksWorkspace({ tasks }: { tasks: DashboardTask[] }) {
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [project, setProject] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [selectedTask, setSelectedTask] = useState<DashboardTask | null>(null);
  const projects = useMemo(() => [...new Map(tasks.map((task) => [task.project_id, task.project_name])).entries()], [tasks]);
  const assignees = useMemo(() => [...new Set(tasks.map((task) => task.assignee).filter(Boolean))], [tasks]);
  const visibleTasks = useMemo(
    () => tasks.filter((task) =>
      (filter === "all" || task.status === filter) &&
      (project === "all" || task.project_id === project) &&
      (assignee === "all" || task.assignee === assignee),
    ),
    [tasks, filter, project, assignee],
  );

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-5 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Actionable Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">Confirmed work across projects. Same records as each project’s Work tab.</p>
          </div>
          <Badge variant="outline" className="border-info/20 bg-info-soft text-info">Database records · {tasks.length}</Badge>
        </header>

        <section aria-label="Task filters and view options">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-full border bg-card p-1" aria-label="Filter by status">
              {statusFilters.map((item) => (
                <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
                  className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors", filter === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger aria-label="Project filter" className="w-[170px] bg-card"><SelectValue placeholder="All projects" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger aria-label="Assignee filter" className="w-[150px] bg-card"><SelectValue placeholder="Any assignee" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Any assignee</SelectItem>{assignees.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="inline-flex rounded-md border bg-card p-0.5" aria-label="Choose task view">
                <Button type="button" variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" /></Button>
                <Button type="button" variant={view === "board" ? "secondary" : "ghost"} size="icon-sm" aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")}><LayoutGrid aria-hidden="true" /></Button>
              </div>
              <Button disabled title="Task creation will be connected with the work-management workflow">New task</Button>
            </div>
          </div>
        </section>

        {view === "list" ? (
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Tasks">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>{["Task", "Project", "Status", "Priority", "Assignee", "Agreed date", "Accepted via", "Updated"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => (
                    <tr key={task.id} tabIndex={0} onClick={() => setSelectedTask(task)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedTask(task); } }} className="cursor-pointer border-b last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60">
                      <td className="w-[320px] min-w-[320px] px-3 py-3"><div className="flex min-w-0 items-start gap-2"><span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground">{task.task_code}</span><span className="min-w-0 break-words font-medium">{task.title}</span></div>{task.blocked_reason && <span className="mt-1 block text-xs text-muted-foreground">Blocked: {task.blocked_reason}</span>}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{task.project_name}</td>
                      <td className="px-3 py-3"><Badge variant="outline" className={statusClass[task.status]}>{statusLabels[task.status]}</Badge></td>
                      <td className="px-3 py-3"><Badge variant="outline" className={cn("border-transparent capitalize", task.priority === "high" ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{task.priority}</Badge></td>
                      <td className="whitespace-nowrap px-3 py-3">{task.assignee || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{displayDate(task.agreed_due_date) ?? <span className="text-muted-foreground">No date agreed</span>}</td>
                      <td className="whitespace-nowrap px-3 py-3"><span className={task.origin === "auto" ? "rounded-full bg-accent px-2 py-1 text-xs text-accent-foreground" : "text-muted-foreground"}>{task.origin_text}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground tabular-nums">{new Date(task.updated_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {visibleTasks.length === 0 && <tr><td colSpan={8} className="px-6 py-14 text-center"><p className="font-medium">No tasks to show</p><p className="mt-1 text-sm text-muted-foreground">Tasks recorded for your projects will appear here.</p></td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap justify-between gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground"><span>{visibleTasks.length} of {tasks.length} tasks · 25 per page</span><span>Proposed work appears in Proposals until approved</span></footer>
          </section>
        ) : (
          <section className="overflow-x-auto pb-1" aria-label="Tasks by status">
            <div className="grid min-w-[1000px] grid-cols-5 gap-3">
              {statusFilters.slice(1).map((column) => {
                const columnTasks = visibleTasks.filter((task) => task.status === column.id);
                return <div key={column.id} className="flex min-h-48 flex-col gap-2 rounded-lg bg-muted p-2.5"><h2 className="flex items-center justify-between px-1 text-sm font-semibold">{column.label}<span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span></h2>{columnTasks.map((task) => <button type="button" key={task.id} onClick={() => setSelectedTask(task)} className="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3 text-left text-sm shadow-sm hover:border-primary/50"><span className="min-w-0 break-words font-medium">{task.title}</span><span className="text-xs text-muted-foreground">{task.origin_text} · {displayDate(task.agreed_due_date) ?? "No date agreed"}</span><span className="font-mono text-[11px] text-muted-foreground">{task.task_code}</span></button>)}</div>;
              })}
              <div className="flex min-h-48 flex-col gap-2 rounded-lg bg-muted p-2.5"><h2 className="px-1 text-sm font-semibold">Awaiting approval</h2><p className="rounded-md border border-dashed bg-background/60 p-3 text-xs text-muted-foreground">Proposed deliverables remain in Proposals until approval creates tasks.</p></div>
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Task records load from your workspace database. Task state changes are not enabled yet.</p>
      </main>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button className="absolute inset-0 bg-foreground/35" aria-label="Close task details" onClick={() => setSelectedTask(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
            <div className="flex items-start justify-between gap-4 border-b p-5"><div className="min-w-0"><span className="font-mono text-xs text-muted-foreground">{selectedTask.task_code}</span><h2 id="task-detail-title" className="mt-1 break-words font-display text-xl font-semibold">{selectedTask.title}</h2><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline" className={statusClass[selectedTask.status]}>{statusLabels[selectedTask.status]}</Badge><span className="capitalize text-muted-foreground">{selectedTask.priority} priority · {selectedTask.assignee || "Unassigned"}</span></div></div><Button variant="ghost" size="icon-sm" aria-label="Close task details" onClick={() => setSelectedTask(null)}><X aria-hidden="true" /></Button></div>
            <div className="flex flex-col gap-6 p-5">
              <div className="flex flex-wrap gap-2"><Button disabled><Check aria-hidden="true" />{selectedTask.status === "ready" ? "Start task" : "Mark done"}</Button><Button variant="outline" disabled>Mark blocked…</Button><Button variant="outline" disabled>Cancel task…</Button></div>
              {selectedTask.status === "ready" && selectedTask.origin === "auto" && <div className="rounded-md border border-info/20 bg-info-soft p-3 text-sm text-info">Starting this task consumes its reserved revision unit. This happens once.</div>}
              <section className="grid gap-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requested change</h3><dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">{selectedTask.operation && <><dt className="text-muted-foreground">Operation</dt><dd className="font-mono text-xs">{selectedTask.operation}</dd></>}{selectedTask.target_id && <><dt className="text-muted-foreground">Target</dt><dd className="font-mono text-xs">{selectedTask.target_id}</dd></>}<dt className="text-muted-foreground">{selectedTask.origin === "auto" ? "Value" : "Deliverable"}</dt><dd>{selectedTask.value ?? selectedTask.title}</dd>{selectedTask.acceptance_criteria && <><dt className="text-muted-foreground">Acceptance criteria</dt><dd>{selectedTask.acceptance_criteria}</dd></>}<dt className="text-muted-foreground">Agreed date</dt><dd>{displayDate(selectedTask.agreed_due_date) ?? "No date agreed"}</dd></dl></section>
              <section className="grid gap-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why this task exists</h3><blockquote className="rounded-r-md border-l-[3px] border-info bg-info-soft p-3 text-sm">“{selectedTask.source_text ?? "No linked source message is recorded."}”<cite className="mt-1 block text-xs not-italic text-muted-foreground">{selectedTask.source_meta ?? selectedTask.origin_text}</cite></blockquote><dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm"><dt className="text-muted-foreground">Project</dt><dd>{selectedTask.project_name} · {selectedTask.client_name}</dd>{selectedTask.request_code && <><dt className="text-muted-foreground">Request</dt><dd>{selectedTask.request_code}</dd></>}{selectedTask.authorized_by && <><dt className="text-muted-foreground">Authorized by</dt><dd>{selectedTask.authorized_by}</dd></>}{selectedTask.revision_unit && <><dt className="text-muted-foreground">Revision unit</dt><dd>{selectedTask.revision_unit}</dd></>}</dl></section>
              <section className="grid gap-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal notes · owner only</h3><p className="rounded-md border border-warn/20 bg-warn-soft p-3 text-sm">{selectedTask.internal_note ?? "No internal note recorded."}</p></section>
              <section className="grid gap-3 rounded-lg border p-4 opacity-75"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Complete task</h3><label className="grid gap-1 text-sm font-medium">What was done (internal record)<textarea className="min-h-20 rounded-md border bg-background p-3 font-normal" disabled /></label><label className="grid gap-1 text-sm font-medium">Public completion note<textarea className="min-h-20 rounded-md border bg-background p-3 font-normal" disabled /></label><Button disabled>Mark done</Button></section>
              <section className="grid gap-2 text-xs text-muted-foreground"><p className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />Updated {new Date(selectedTask.updated_at).toLocaleString()}</p>{selectedTask.history.map((entry, index) => <p key={`${selectedTask.id}-history-${index}`}>{entry}</p>)}</section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
