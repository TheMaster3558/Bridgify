"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SettingsGroup,
  settingsButton,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";

export function DecisionActions({
  decision,
  onResolved,
}: {
  decision: OwnerDecisionRecord;
  onResolved?: (id: string) => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taskTitle, setTaskTitle] = useState(decision.title ?? "");
  const canApprove =
    !decision.task_change_kind &&
    Boolean(decision.automation_request_id) &&
    !["unknown_participant", "delivery_unknown"].includes(decision.reason);
  async function resolve(action: "approve" | "decline" | "dismiss" | "delete") {
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
    "w-full rounded-lg bg-card px-3 py-2 text-[15px] ring-1 ring-black/10 outline-none placeholder:text-neutral-400 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-background dark:ring-white/10";
  const hint = "mt-1 text-sm text-neutral-500 dark:text-neutral-400";
  return (
    <section className="grid gap-2">
      <h3 className="px-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        Your decision
      </h3>
      <SettingsGroup>
        {decision.task_change_kind && (
          <div className="px-3.5 py-3">
            <Link
              className="text-[15px] font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
              href={`/app/projects/${decision.project_id}/automation`}
            >
              Review and apply this {decision.task_change_kind} to an existing
              task
            </Link>
          </div>
        )}
        {canApprove && (
          <label className="block px-3.5 py-3">
            <span className="text-[15px] font-medium">Task to approve</span>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              minLength={3}
              maxLength={500}
              className={cn(field, "mt-2")}
            />
            <span className={cn(hint, "block")}>
              {decision.reason === "failed_processing"
                ? "Automatic interpretation failed. Review the original message and enter the task you want to authorize. Your approval creates the task directly."
                : "Approving authorizes this work, including an exception to policy where needed. Individual requests use one revision; rounds remain under manual accounting."}
            </span>
          </label>
        )}
        {!canApprove && decision.reason === "failed_processing" && (
          <p className={cn(hint, "mt-0 px-3.5 py-3")}>
            Automatic interpretation failed. Review the original message and
            enter the task you want to authorize. Your approval creates the task
            directly.
          </p>
        )}
        <label className="block px-3.5 py-3">
          <span className="text-[15px] font-medium">Client reply</span>
          <span className="ml-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            optional
          </span>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={4000}
            placeholder="Approval uses a saved-task confirmation; other actions stay silent when blank"
            className={cn(field, "mt-2 min-h-20 resize-y")}
          />
          <span className={cn(hint, "block")}>
            Approval queues a client confirmation after the task is saved. Leave
            the reply blank to use that confirmation. Delivery and identity
            issues must be checked in the conversation before sending another
            message.
          </span>
        </label>
        <label className="block px-3.5 py-3">
          <span className="text-[15px] font-medium">Decision reason</span>
          <span className="ml-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            private, optional
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder="Add context for your records if needed"
            className={cn(field, "mt-2 min-h-20 resize-y")}
          />
        </label>
      </SettingsGroup>
      {error && (
        <p role="alert" className="px-3.5 text-sm text-crit">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {canApprove && (
          <button
            type="button"
            className={settingsPrimaryButton}
            disabled={busy || taskTitle.trim().length < 3}
            onClick={() => void resolve("approve")}
          >
            Accept work
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            className={settingsButton}
            disabled={busy}
            onClick={() => void resolve("decline")}
          >
            Decline
          </button>
        )}
        <button
          type="button"
          className={settingsButton}
          disabled={busy}
          onClick={() => void resolve("dismiss")}
        >
          Dismiss review
        </button>
        <button
          type="button"
          className={cn(settingsButton, "text-crit hover:text-crit")}
          disabled={busy}
          onClick={() => void resolve("delete")}
        >
          Delete review
        </button>
      </div>
    </section>
  );
}
