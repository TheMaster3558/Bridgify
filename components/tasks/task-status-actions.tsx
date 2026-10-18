"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Save } from "lucide-react";
import { panelFooter } from "@/components/dashboard/table-ui";
import { settingsPrimaryButton } from "@/components/settings/settings-ui";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

const box =
  "rounded-2xl bg-card ring-1 ring-sidebar-border transition-shadow focus-within:ring-[3px] focus-within:ring-sidebar-ring/40 dark:bg-sidebar";

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
  const needsNote = ["blocked", "cancelled"].includes(status);
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
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="grid gap-4 border-t border-sidebar-border bg-sidebar/60 px-6 pt-6 pb-6 dark:bg-sidebar/40">
        <h3 className="text-base font-semibold tracking-tight">
          Update status
        </h3>
        <label className="grid gap-2">
          <span className="text-sm font-medium">Task status</span>
          <span className={cn(box, "relative flex items-center")}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="h-11 w-full appearance-none bg-transparent px-3.5 pr-10 text-[15px] outline-none"
            >
              <option value="ready">Ready</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3.5 size-4 text-neutral-400"
            />
          </span>
        </label>
        <label className="grid gap-2">
          <span className="flex items-center justify-between text-sm font-medium">
            Internal update
            <span className="font-normal text-neutral-500 dark:text-neutral-400">
              {needsNote ? "Required" : "Optional · only you see this"}
            </span>
          </span>
          <span className={box}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Required when blocking or cancelling"
              className="block w-full resize-none bg-transparent px-3.5 py-3 text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </span>
        </label>
        <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Client status replies use this saved status. Accepted revision usage
          is retained when tasks are cancelled.
        </p>
      </section>
      <div className={panelFooter}>
        {error && (
          <p role="alert" className="text-sm text-crit">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={cn(settingsPrimaryButton, "h-9 gap-1.5 px-4")}
            disabled={
              busy ||
              status === task.status ||
              (needsNote && note.trim().length < 3)
            }
            onClick={() => void save()}
          >
            <Save aria-hidden className="size-4" />
            Save task status
          </button>
          {status !== task.status && !busy && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Unsaved change
            </span>
          )}
        </div>
      </div>
    </>
  );
}
