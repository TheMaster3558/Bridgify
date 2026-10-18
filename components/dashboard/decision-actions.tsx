"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";

export function DecisionActions({
  decision,
}: {
  decision: OwnerDecisionRecord;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canApprove =
    Boolean(decision.automation_request_id) &&
    ![
      "unknown_participant",
      "unsupported_input",
      "failed_processing",
      "delivery_unknown",
    ].includes(decision.reason);
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
        body: JSON.stringify({ action, note, reply }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Decision could not be saved.",
        );
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
        Decision reason (private)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={3}
          maxLength={2000}
          className="min-h-20 rounded border bg-background p-2"
        />
      </label>
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
          placeholder="Leave blank to resolve without sending a message"
          className="min-h-20 rounded border bg-background p-2"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Your reply is queued only when this decision is saved. Delivery and
        identity issues must be checked in the conversation before sending
        another message.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button
            disabled={busy || note.trim().length < 3}
            onClick={() => void resolve("approve")}
          >
            Accept work
          </Button>
        )}
        {canApprove && (
          <Button
            variant="outline"
            disabled={busy || note.trim().length < 3}
            onClick={() => void resolve("decline")}
          >
            Decline
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={busy || note.trim().length < 3}
          onClick={() => void resolve("dismiss")}
        >
          Dismiss review
        </Button>
      </div>
    </section>
  );
}
