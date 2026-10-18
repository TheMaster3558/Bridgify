"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ListChecks,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  settingsButton,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import { panelFooter } from "@/components/dashboard/table-ui";
import { cn } from "@/lib/utils";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";

export function DecisionActions({
  decision,
  onResolved,
  onDelete,
}: {
  decision: OwnerDecisionRecord;
  onResolved?: (id: string) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taskTitle, setTaskTitle] = useState(decision.title ?? "");
  const canApprove =
    !decision.task_change_kind &&
    Boolean(decision.automation_request_id) &&
    !["unknown_participant", "delivery_unknown"].includes(decision.reason);
  async function resolve(action: "approve" | "decline" | "dismiss") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/decisions/${decision.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          action,
          note,
          reply,
          ...(action === "approve" ? { taskTitle } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Decision could not be saved.",
        );
      onResolved?.(decision.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  const field =
    "w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500";
  const box =
    "rounded-2xl bg-card ring-1 ring-sidebar-border transition-shadow focus-within:ring-[3px] focus-within:ring-sidebar-ring/40 dark:bg-sidebar";
  const failedProcessingHint =
    "Automatic interpretation failed. Review the original message and enter the task you want to authorize. Your approval creates the task directly.";
  return (
    <>
      <section className="grid gap-4 border-t border-sidebar-border bg-sidebar/60 px-6 pt-6 pb-6 dark:bg-sidebar/40">
        <h3 className="text-base font-semibold tracking-tight">
          Your decision
        </h3>
        {decision.task_change_kind && (
          <Link
            href={`/app/projects/${decision.project_id}/automation`}
            className="group flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-sidebar-border outline-none hover:ring-blue-300 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-sidebar"
          >
            <span>
              <span className="block text-[15px] font-medium">
                Apply this {decision.task_change_kind} to an existing task
              </span>
              <span className="mt-0.5 block text-sm text-neutral-500 dark:text-neutral-400">
                Opens the project automation page.
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}
        {canApprove && (
          <label className="grid gap-2">
            <span className="text-sm font-medium">Task to approve</span>
            <div className={cn(box, "flex items-center gap-2.5 px-3.5")}>
              <ListChecks
                aria-hidden
                className="size-[18px] shrink-0 text-blue-600 dark:text-blue-400"
              />
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                minLength={3}
                maxLength={500}
                className={cn(field, "h-11")}
              />
            </div>
            <span className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {decision.reason === "failed_processing"
                ? failedProcessingHint
                : "Approving authorizes this work, including an exception to policy where needed. Individual requests use one revision; rounds remain under manual accounting."}
            </span>
          </label>
        )}
        {!canApprove && decision.reason === "failed_processing" && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {failedProcessingHint}
          </p>
        )}
        <label className="grid gap-2">
          <span className="flex items-center justify-between text-sm font-medium">
            Reply to client
            <span className="font-normal text-neutral-500 dark:text-neutral-400">
              Optional
            </span>
          </span>
          <div className={box}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Approval uses a saved-task confirmation; other actions stay silent when blank"
              className={cn(field, "block resize-none px-3.5 pt-3 pb-1")}
            />
            <div className="flex items-center justify-between gap-3 px-3.5 pb-2.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <MessageCircle aria-hidden className="size-3.5" />
                Sent over iMessage
              </span>
              <span className="tabular-nums">{reply.length}/4000</span>
            </div>
          </div>
          <span className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Approval queues a client confirmation after the task is saved. Leave
            the reply blank to use that confirmation. Delivery and identity
            issues must be checked in the conversation before sending another
            message.
          </span>
        </label>
        {showNote ? (
          <label className="grid gap-2">
            <span className="flex items-center justify-between text-sm font-medium">
              Private reason
              <span className="font-normal text-neutral-500 dark:text-neutral-400">
                Only you see this
              </span>
            </span>
            <div className={box}>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Add context for your records if needed"
                className={cn(field, "block resize-none px-3.5 py-3")}
              />
            </div>
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="flex w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-blue-600 outline-none hover:text-blue-700 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-blue-400"
          >
            <Plus aria-hidden className="size-4" />
            Add a private reason
          </button>
        )}
      </section>
      <div className={panelFooter}>
        {error && (
          <p role="alert" className="text-sm text-crit">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          {canApprove && (
            <button
              type="button"
              className={cn(settingsPrimaryButton, "h-9 gap-1.5 px-4")}
              disabled={busy || taskTitle.trim().length < 3}
              onClick={() => void resolve("approve")}
            >
              <Check aria-hidden className="size-4" />
              Accept work
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              className={cn(settingsButton, "h-9 px-3.5")}
              disabled={busy}
              onClick={() => void resolve("decline")}
            >
              Decline
            </button>
          )}
          <button
            type="button"
            className={cn(
              canApprove
                ? cn(settingsButton, "h-9 px-3.5")
                : cn(settingsPrimaryButton, "h-9 px-4"),
            )}
            disabled={busy}
            onClick={() => void resolve("dismiss")}
          >
            Dismiss
          </button>
          <button
            type="button"
            aria-label="Delete review"
            title="Delete review"
            className={cn(
              settingsButton,
              "ml-auto size-9 px-0 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-300",
            )}
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}
