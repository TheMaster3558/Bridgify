"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
export function TaskEditor({
  task,
  projectId,
  projects = [],
  onSaved,
}: {
  task?: DashboardTask;
  projectId?: string;
  projects?: { id: string; name: string }[];
  onSaved?: (task: DashboardTask) => void;
}) {
  const router = useRouter();
  const [project, setProject] = useState(projectId ?? projects[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  return (
    <details className="group rounded-2xl border border-sidebar-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40">
        <span aria-hidden className="grid size-6 place-items-center rounded-full bg-primary text-base leading-none text-primary-foreground transition-transform group-open:rotate-45">+</span>
        <span>{task ? "Edit task details" : "New task"}</span>
      </summary>
      <form
        className="grid gap-4 border-t border-sidebar-border p-4 sm:grid-cols-2"
        onChange={() => setKey(crypto.randomUUID())}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          const details = {
            title: String(form.get("title")),
            instructions: String(form.get("instructions")),
            acceptance_criteria: String(form.get("criteria")),
            priority: String(form.get("priority")),
            internal_due_date: form.get("due") || null,
            internal_note: String(form.get("note")),
          };
          try {
            const r = await fetch(
              task
                ? `/api/v1/tasks/${task.id}`
                : `/api/v1/projects/${project}/tasks`,
              {
                method: task ? "PATCH" : "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Idempotency-Key": key,
                },
                body: JSON.stringify(
                  task
                    ? {
                        action: "edit",
                        expectedUpdatedAt: task.updated_at,
                        details,
                      }
                    : details,
                ),
              },
            );
            const v = await r.json();
            if (!r.ok)
              throw new Error(v.error?.message ?? "Task could not be saved.");
            onSaved?.({ ...task, ...v.data });
            setKey(crypto.randomUUID());
            router.refresh();
            if (!task) router.push(`/app/tasks/${v.data.id}`);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Task could not be saved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {!task && !projectId && (
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            Project
            <select
              className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              required
            >
              <option value="">Choose project</option>
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          Title
          <input
            className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            name="title"
            defaultValue={task?.title}
            required
            maxLength={500}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          Instructions
          <textarea
            className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            name="instructions"
            defaultValue={task?.value ?? ""}
            maxLength={8000}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          Acceptance criteria
          <textarea
            className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            name="criteria"
            defaultValue={task?.acceptance_criteria ?? ""}
            maxLength={4000}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Priority
          <select
            className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            name="priority"
            defaultValue={task?.priority ?? "normal"}
          >
            {["high", "normal", "low"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Internal target date
          <input
            className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            name="due"
            type="date"
            defaultValue={task?.internal_due_date ?? ""}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          Private notes
          <textarea
            className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            name="note"
            defaultValue={task?.internal_note ?? ""}
            maxLength={4000}
          />
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Internal target dates do not change client-agreed deadlines. Manual
          tasks do not use revisions.
        </p>
        {error && <p role="alert" className="rounded-xl bg-crit-soft px-3 py-2 text-sm text-crit sm:col-span-2">{error}</p>}
        <button
          className="h-9 justify-self-start rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:col-span-2"
          disabled={busy || (!task && !project)}
        >
          {busy ? "Saving…" : "Save task"}
        </button>
      </form>
    </details>
  );
}
