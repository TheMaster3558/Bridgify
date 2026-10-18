"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Your decision
      </h3>
      <label className="grid gap-1 text-sm">
        Decision reason (private, optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="Add context for your records if needed"
          className="min-h-20 rounded border bg-background p-2"
        />
      </label>
      {canApprove && (
        <label className="grid gap-1 text-sm">
          Task to approve
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            minLength={3}
            maxLength={500}
            className="rounded border bg-background p-2"
          />
        </label>
      )}
      {decision.reason === "failed_processing" && (
        <p className="text-sm text-muted-foreground">
          Automatic interpretation failed. Review the original message and enter
          the task you want to authorize. Your approval creates the task
          directly.
        </p>
      )}
      {canApprove && (
        <p className="text-xs text-muted-foreground">
          Approving authorizes this work, including an exception to policy where
          needed. Individual requests use one revision; rounds remain under
          manual accounting.
        </p>
      )}
      <label className="grid gap-1 text-sm">
        Client reply (optional)
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={4000}
          placeholder="Approval uses a saved-task confirmation; other actions stay silent when blank"
          className="min-h-20 rounded border bg-background p-2"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Approval queues a client confirmation after the task is saved. Leave the
        reply blank to use that confirmation. Delivery and identity issues must
        be checked in the conversation before sending another message.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button
            disabled={
              busy || taskTitle.trim().length < 3
            }
            onClick={() => void resolve("approve")}
          >
            Accept work
          </Button>
        )}
        {canApprove && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void resolve("decline")}
          >
            Decline
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void resolve("dismiss")}
        >
          Dismiss review
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => void resolve("delete")}
        >
          Delete review
        </Button>
      </div>
    </section>
  );
}
