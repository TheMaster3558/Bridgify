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
    <details className="rounded border bg-card p-4">
      <summary className="cursor-pointer font-medium">
        {task ? "Edit task details" : "New task"}
      </summary>
      <form
        className="mt-4 grid gap-3"
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
          <label className="grid gap-1">
            Project
            <select
              className="rounded border bg-background p-2"
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
        <label className="grid gap-1">
          Title
          <input
            className="rounded border bg-background p-2"
            name="title"
            defaultValue={task?.title}
            required
            maxLength={500}
          />
        </label>
        <label className="grid gap-1">
          Instructions
          <textarea
            className="rounded border bg-background p-2"
            name="instructions"
            defaultValue={task?.value ?? ""}
            maxLength={8000}
          />
        </label>
        <label className="grid gap-1">
          Acceptance criteria
          <textarea
            className="rounded border bg-background p-2"
            name="criteria"
            defaultValue={task?.acceptance_criteria ?? ""}
            maxLength={4000}
          />
        </label>
        <label className="grid gap-1">
          Priority
          <select
            className="rounded border bg-background p-2"
            name="priority"
            defaultValue={task?.priority ?? "normal"}
          >
            {["high", "normal", "low"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Internal target date
          <input
            className="rounded border bg-background p-2"
            name="due"
            type="date"
            defaultValue={task?.internal_due_date ?? ""}
          />
        </label>
        <label className="grid gap-1">
          Private notes
          <textarea
            className="rounded border bg-background p-2"
            name="note"
            defaultValue={task?.internal_note ?? ""}
            maxLength={4000}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Internal target dates do not change client-agreed deadlines. Manual
          tasks do not use revisions.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          className="rounded border p-2"
          disabled={busy || (!task && !project)}
        >
          {busy ? "Saving…" : "Save task"}
        </button>
      </form>
    </details>
  );
}
