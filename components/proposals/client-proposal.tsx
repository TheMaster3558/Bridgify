"use client";

import { useState } from "react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { lineItems } from "@/lib/sample";
import { cn } from "@/lib/utils";

const states = ["open", "approved", "superseded", "expired", "denied"] as const;

export function ClientProposal({ proposalId }: { proposalId: string }) {
  const [state, setState] = useState<(typeof states)[number]>("open");
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Preview state</span>
        {states.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setState(item);
              setConfirming(false);
            }}
            className={cn(
              "rounded-full border px-3 py-1 capitalize",
              state === item && "border-foreground bg-foreground text-background",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      {state === "approved" ? (
        <p className="rounded-lg border border-info/30 bg-info-soft px-4 py-2 text-sm">
          Approved. Opening this link again shows the same result.
        </p>
      ) : null}
      {state === "superseded" ? (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-2 text-sm">
          This is an older revision. It can no longer be approved.
        </p>
      ) : null}
      {state === "expired" ? (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-4 py-2 text-sm">
          This proposal expired. Ask the project owner to send a new one.
        </p>
      ) : null}
      {state === "denied" ? (
        <p className="rounded-lg border border-crit/30 bg-crit-soft px-4 py-2 text-sm">
          You’re signed in, but you aren’t the designated approver for this proposal.
        </p>
      ) : null}
      <article className="flex flex-col gap-5 rounded-xl border bg-card p-7">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Northlight Web Studio · {proposalId} · Revision 2
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Customer accounts for your website</h1>
          <p className="text-sm text-muted-foreground">Harbor & Pine Bakery website · for Maya Chen</p>
          <div className="mt-3">
            <StatusPill tone={state === "approved" ? "ok" : state === "open" ? "warn" : "neutral"}>
              {state === "open" ? "Awaiting your decision" : state}
            </StatusPill>
          </div>
        </div>
        <p className="text-sm">
          This adds email-and-password accounts so regulars can sign in and save a favorite location. Online ordering and social sign-in are not part of this proposal.
        </p>
        <ul className="divide-y rounded-lg border">
          {lineItems.map(([key, title, criteria, price]) => (
            <li key={key} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground">Done means: {criteria}</p>
              </div>
              <span>{price}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-2 border-t pt-4 text-sm">
          <dt>Additional project price</dt>
          <dd className="text-right font-semibold">$600 USD</dd>
          <dt>Launch date</dt>
          <dd className="text-right">Nov 20 → Dec 4, 2026</dd>
          <dt>Respond by</dt>
          <dd className="text-right">Oct 30, 2026</dd>
        </dl>
        {state === "open" ? (
          <>
            <label className="text-sm font-medium">
              Note to Amogh (optional)
              <Textarea className="mt-1.5 font-normal" placeholder="Anything you’d like changed?" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setConfirming(true)}>
                Approve proposal
              </Button>
              <Button type="button" variant="outline">
                Request changes
              </Button>
              <Button type="button" variant="outline">
                Decline
              </Button>
            </div>
          </>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Approving records these exact terms. A reply in iMessage doesn’t count as approval.
        </p>
      </article>
      {confirming ? (
        <div className="fixed inset-0 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6" role="dialog" aria-labelledby="approve-title">
            <h2 id="approve-title" className="text-xl font-semibold">
              Approve these terms?
            </h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Proposal</dt><dd>{proposalId}, revision 2</dd></div>
              <div className="flex justify-between"><dt>Additional price</dt><dd className="font-semibold">$600 USD</dd></div>
              <div className="flex justify-between"><dt>New launch date</dt><dd className="font-semibold">Dec 4, 2026</dd></div>
            </dl>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Go back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setState("approved");
                }}
              >
                Yes, approve $600
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
