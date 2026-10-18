"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Bundle } from "@/lib/domain/types";
import { INTRODUCTION } from "@/lib/domain/security";
export function ConnectionRecovery({ bundle }: { bundle: Bundle }) {
  const router = useRouter();
  const p = bundle.project;
  const b = bundle.binding;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false);
  const [notDelivered, setNotDelivered] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [reason, setReason] = useState("");
  const [intro, setIntro] = useState(b?.introduction_text ?? INTRODUCTION);
  const act = async (path: string, input: unknown) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/v1/projects/${p.id}/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          expectedVersion: p.version,
          ...(input as object),
        }),
      });
      const v = await r.json();
      if (!r.ok)
        throw new Error(v.error?.message ?? "Connection action failed");
      setNotice(v.data?.message ?? "Saved. Refreshing the connection.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="grid gap-3 rounded-2xl border border-sidebar-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Client connection recovery</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden
              className={`size-2 rounded-full ${b?.hold_reason ? "bg-warn" : b?.test_state === "sent" ? "bg-ok" : "bg-neutral-400"}`}
            />
            Introduction: {b?.test_state ?? "not configured"} ·{" "}
            {b?.hold_reason ?? "No connection hold"}
          </p>
        </div>
        <Link
          className="inline-flex h-8 items-center rounded-full bg-sidebar-accent px-3 text-sm font-medium hover:bg-muted"
          href={`/app/projects/${p.id}/conversation`}
        >
          Inspect conversation and provider message IDs
        </Link>
      </div>
      {p.status === "active" && (
        <p className="text-xs text-muted-foreground">
          Pause the project using its lifecycle controls before reverifying.
        </p>
      )}
      {["draft", "paused", "review_only"].includes(p.status) && p.people && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I verified the client identity and consent to assistant processing.
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Successful introduction provider message ID
            <input
              className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              maxLength={256}
            />
          </label>
          <button
            className="h-9 w-fit rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={busy || !receipt || !consent}
            onClick={() =>
              void act("connection", {
                action: "verify",
                providerMessageId: receipt,
                disclosed: true,
              })
            }
          >
            Verify actual introduction receipt
          </button>
          {b && ["unknown", "failed", "sending"].includes(b.test_state) && (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notDelivered}
                  onChange={(e) => setNotDelivered(e.target.checked)}
                />
                I checked the conversation and confirmed the introduction was
                not delivered.
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Reason
                <input
                  className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <button
                className="h-9 w-fit rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                disabled={busy || !notDelivered || reason.trim().length < 3}
                onClick={() =>
                  void act("connection", {
                    action: "retry",
                    confirmedNotDelivered: true,
                    reason,
                  })
                }
              >
                Authorize another introduction attempt
              </button>
            </>
          )}
          {(!b || ["pending", "failed"].includes(b.test_state)) && (
            <>
              <label className="grid gap-1.5 text-sm font-medium">
                Introduction
                <textarea
                  className="rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <button
                className="h-9 w-fit rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                disabled={busy || !consent || !intro.trim()}
                onClick={() => void act("chat-test", { introduction: intro })}
              >
                Send introduction
              </button>
            </>
          )}
        </>
      )}
      {error && <p role="alert" className="rounded-xl bg-crit-soft px-3 py-2 text-sm text-crit">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{notice}</p>}
    </section>
  );
}
