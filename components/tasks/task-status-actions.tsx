"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";

export function TaskStatusActions({
  task,
  onSaved,
}: {
  task: DashboardTask;
  onSaved: (task: DashboardTask) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note,
          expectedUpdatedAt: task.updated_at,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "Task could not be saved.");
      onSaved({ ...task, ...result.data });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded border p-3">
      <label className="grid gap-1 text-sm">
        Task status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded border bg-background p-2"
        >
          <option value="ready">Ready</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Internal update
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="Required when blocking or cancelling"
          className="min-h-20 rounded border bg-background p-2"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Client status replies use this saved status. Accepted revision usage is
        retained when tasks are cancelled.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        disabled={
          busy ||
          status === task.status ||
          (["blocked", "cancelled"].includes(status) && note.trim().length < 3)
        }
        onClick={() => void save()}
      >
        Save task status
      </Button>
    </section>
  );
}
