"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Decision = {
  id: string;
  requestId: string;
  reason: string;
  title: string;
  age: string;
  severity: "warning" | "critical" | "info";
  source: string;
  sourceMeta: string;
  evidence: string;
  evidenceSource: string;
  explanation: string;
  missing: string[];
  options: [string, string][];
  reply: string;
  privateNote?: string;
  history: string[];
};

const decisions: Decision[] = [
  {
    id: "D-11", requestId: "R-11", reason: "deadline_change", title: "Client asks to finish by Nov 10 (agreed: Nov 20)", age: "1 h", severity: "warning",
    source: "Can you finish everything by Nov 10 instead?", sourceMeta: "Maya Chen · Oct 16, 8:20 AM",
    evidence: "Agreement §4: “Target launch: November 20, 2026.”", evidenceSource: "Agreement PDF p.2",
    explanation: "Policy v3 prohibits the assistant from agreeing to new dates.", missing: ["Which pages must be live by Nov 10, or the whole site?"],
    options: [["Keep Nov 20", "Reply that the agreed date stays Nov 20."], ["Prepare proposal", "Quote an expedite fee and new date for client approval."], ["Ask client", "Ask which pages are needed early."]],
    reply: "Thanks for flagging this. The agreed launch date is still November 20. Amogh will follow up about whether an earlier date is possible.",
    privateNote: "Menu + Locations by Nov 10 is doable. Contact form is blocked on their email anyway.",
    history: ["Oct 16, 8:20 AM · Request recorded", "Oct 16, 8:20 AM · Acknowledgment queued", "Oct 16, 8:20 AM · Delivery unknown (timeout after send)"],
  },
  {
    id: "D-12d", requestId: "R-11", reason: "delivery_unknown", title: "Acknowledgment may not have reached the group", age: "1 h", severity: "critical",
    source: "Outbox message OB-219 · “I’ve noted the requested earlier date; it isn’t confirmed yet.”", sourceMeta: "Photon send timed out · Oct 16, 8:20:07 AM",
    evidence: "No provider message GUID returned. Reconciliation is not supported by the current Photon setup.", evidenceSource: "outbox_messages.state = unknown",
    explanation: "Unknown sends are never retried blindly.", missing: [],
    options: [["Confirm delivered", "Mark as sent after checking the iMessage group yourself."], ["Resend after review", "Send the same text once more."], ["Cancel", "Leave it unsent and handle it in D-11’s reply."]],
    reply: "(Same text as OB-219)", history: ["Oct 16, 8:20 AM · Send started", "Oct 16, 8:20 AM · Timeout after network submission → unknown"],
  },
  {
    id: "D-12", requestId: "R-12", reason: "unknown_participant", title: "Unverified number joined the group and asked for status", age: "1 h", severity: "warning",
    source: "Hey what’s the status on the site?", sourceMeta: "+1 (415) ••• 0192 · Oct 16, 8:31 AM",
    evidence: "This sender is not in participant bindings for this project. No project details were sent.", evidenceSource: "participant_bindings",
    explanation: "Only bound requesters can trigger work or receive project status.", missing: ["Who is this person and what authority do they have?"],
    options: [["Add as requester", "Bind this number as a client requester."], ["Add as viewer only", "Allow status answers, no requests."], ["Ignore sender", "Keep messages as evidence only."]],
    reply: "No automatic reply. If you add this person, the assistant can answer status questions next time.",
    privateNote: "Probably Maya’s business partner Theo. Check before adding.", history: ["Oct 16, 8:31 AM · Membership change detected", "Oct 16, 8:31 AM · Message stored; no reply sent"],
  },
  {
    id: "D-8", requestId: "R-8", reason: "scope_addition", title: "Online ordering requested", age: "23 h", severity: "warning",
    source: "Fix the “Pasteries” typo on the Menu page, and can we add online ordering?", sourceMeta: "Maya Chen · Oct 15, 9:50 AM",
    evidence: "Agreement §3.2 exclusions: online ordering, checkout, or payment processing.", evidenceSource: "Agreement PDF p.2",
    explanation: "Checkout and payments are always escalated for owner review.", missing: ["Pickup only, or delivery too?", "Which payment provider, if any?", "Is this for the full menu or pre-orders only?"],
    options: [["Ask client", "Send the three questions above."], ["Prepare proposal", "Draft an ordering add-on with fixed price."], ["Decline", "Explain it is outside this project."]],
    reply: "Online ordering would be new functionality beyond the current project. Before Amogh can quote it: is this pickup only or delivery too, and do you already use a payment provider?",
    privateNote: "Could refer them to Square Online instead of custom build. About $1,800 if custom.", history: ["Oct 15, 9:50 AM · Split from mixed message (also R-7)", "Oct 15, 9:50 AM · Acknowledged: needs review against current scope"],
  },
  {
    id: "D-7", requestId: "R-7", reason: "exhausted_allowance", title: "Menu page typo fix, but no revisions left", age: "23 h", severity: "warning",
    source: "Fix the “Pasteries” typo on the Menu page, and can we add online ordering?", sourceMeta: "Maya Chen · Oct 15, 9:50 AM",
    evidence: "Revision allowance: 2 total · 1 reserved · 1 consumed · 0 available.", evidenceSource: "revision_buckets v4",
    explanation: "No unit is available and menu.title is not a confirmed automation target.", missing: [],
    options: [["Allow an extra revision", "Record a waiver; accept and create a task."], ["Prepare proposal", "Quote a paid revision."], ["Decline", "Explain the allowance is used."]],
    reply: "Good news: Amogh will fix the “Pasteries” typo at no charge. It’s on the work list.", privateNote: "It’s our typo, not theirs. Waive it.",
    history: ["Oct 15, 9:50 AM · Policy check failed: exhausted allowance", "Oct 15, 9:50 AM · Acknowledged once"],
  },
  {
    id: "D-9", requestId: "R-9", reason: "conflicting_request", title: "Heading: green → blue after work started", age: "17 h", severity: "warning",
    source: "Actually, make the heading blue instead", sourceMeta: "Maya Chen · Oct 15, 4:45 PM",
    evidence: "Corrects R-1 (accepted). T-107 moved to in progress on Oct 14; its revision unit is already consumed.", evidenceSource: "tasks T-107 · revision_ledger L4",
    explanation: "Corrections to started work always go to the owner.", missing: ["Which blue? (hex or reference)"],
    options: [["Update T-107", "Swap the color on the same task; no new unit."], ["Allow an extra revision", "Treat as a new change with a waiver."], ["Prepare proposal", "Quote the extra revision."]],
    reply: "No problem. The heading will be blue instead of green, on the same work item. Which shade of blue would you like?",
    privateNote: "Haven’t pushed the green yet. Easy swap.", history: ["Oct 15, 4:45 PM · Linked to R-1 / T-107", "Oct 15, 4:45 PM · Acknowledged; owner review required"],
  },
  {
    id: "D-3", requestId: "R-3", reason: "exhausted_allowance", title: "Subtext color to cream (#F5EBDD), no revisions left", age: "3 d", severity: "warning",
    source: "Can you make that line cream colored? #F5EBDD", sourceMeta: "Maya Chen · Oct 13, 11:15 AM",
    evidence: "Second unit was reserved 95 minutes earlier by R-2.", evidenceSource: "revision_ledger L3",
    explanation: "The operation and target are eligible, but there are no revision units available.", missing: [],
    options: [["Prepare proposal", "Quote a paid revision ($75)."], ["Allow an extra revision", "Record a waiver."], ["Decline", "Explain the allowance is used."]],
    reply: "The two included revisions are used. Amogh can add this color change as a $75 revision. Here’s the approval link: …",
    history: ["Oct 13, 11:15 AM · Policy check failed: exhausted allowance", "Oct 13, 11:15 AM · Acknowledged once"],
  },
  {
    id: "D-6", requestId: "R-6", reason: "scope_addition", title: "Google sign-in for customer accounts", age: "1 d", severity: "info",
    source: "For the accounts, could people sign in with Google too?", sourceMeta: "Maya Chen · Oct 15, 10:30 AM",
    evidence: "Pending proposal P-001 r2 excludes social login (Google, Apple, Facebook).", evidenceSource: "proposal_revisions P-001 r2",
    explanation: "This request was checked against approved and pending additions, not only the original agreement.", missing: [],
    options: [["Continue P-002 draft", "Open the draft proposal."], ["Decline", "Keep accounts email-only."]],
    reply: "(Will be generated from the P-002 proposal when you send it.)", privateNote: "Draft started. Depends on P-001 approval.",
    history: ["Oct 15, 10:30 AM · Acknowledged", "Oct 15, 2:10 PM · Owner chose Prepare proposal → P-002 draft"],
  },
];

const filters = ["all", "scope_addition", "exhausted_allowance", "deadline_change", "conflicting_request", "unknown_participant", "delivery_unknown"];

const severityStyle: Record<Decision["severity"], string> = {
  warning: "border-l-warn",
  critical: "border-l-crit",
  info: "border-l-info",
};

function reasonLabel(reason: string) {
  return reason.replaceAll("_", " ");
}

export function NeedsAttention() {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("D-11");
  const visible = useMemo(
    () => decisions.filter((decision) => filter === "all" || decision.reason === filter),
    [filter],
  );
  const selected = visible.find((decision) => decision.id === selectedId) ?? visible[0];

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Needs Attention</h1>
        <p className="mt-1 text-sm text-muted-foreground">Decisions the assistant isn’t allowed to make. Routine requests never land here.</p>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Filter decisions">
        {filters.map((item) => (
          <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors", filter === item ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>
            {item === "all" ? `All (${decisions.length})` : reasonLabel(item)}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.4fr)]">
        <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Open decisions">
          <div className="border-b px-4 py-3">
            <h2 className="font-display font-semibold">Open decisions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{visible.length} items · owner review required</p>
          </div>
          <div className="divide-y">
            {visible.map((decision) => (
              <button key={decision.id} type="button" onClick={() => setSelectedId(decision.id)} aria-current={selected.id === decision.id ? "true" : undefined}
                className={cn("flex w-full items-start justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors hover:bg-muted/60", severityStyle[decision.severity], selected.id === decision.id && "bg-accent/70")}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug">{decision.title}</span>
                  <span className="mt-1 block text-xs capitalize text-muted-foreground">{reasonLabel(decision.reason)} · {decision.requestId}</span>
                </span>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{decision.age}</span>
              </button>
            ))}
          </div>
        </section>

        {selected ? (
          <section className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Decision details">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 md:px-5">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{selected.id} · {selected.requestId} · Harbor &amp; Pine</p>
                <h2 className="mt-1 font-display text-lg font-semibold leading-snug">{selected.title}</h2>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize">{reasonLabel(selected.reason)}</Badge>
            </div>
            <div className="grid gap-5 p-4 md:p-5">
              <section className="grid gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client request</h3>
                <blockquote className="rounded-r-md border-l-[3px] border-info bg-info-soft p-3 text-sm">“{selected.source}”<cite className="mt-1 block text-xs not-italic text-muted-foreground">{selected.sourceMeta} · iMessage group</cite></blockquote>
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="grid content-start gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope evidence</h3>
                  <div className="rounded-r-md border-l-[3px] border-primary bg-accent/70 p-3 text-sm">{selected.evidence}<p className="mt-1 text-xs text-muted-foreground">{selected.evidenceSource}</p></div>
                </section>
                <section className="grid content-start gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why it was escalated</h3>
                  <p className="text-sm leading-relaxed">{selected.explanation}</p>
                  {selected.missing.length > 0 && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing details</p><ul className="list-disc space-y-1 pl-5 text-sm">{selected.missing.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                </section>
              </div>

              <section className="grid gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested options</h3>
                <div className="divide-y rounded-md border">
                  {selected.options.map(([title, description], index) => (
                    <div key={title} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div><p className="text-sm font-medium">{title}{index === 0 && <Badge className="ml-2" variant="secondary">Suggested</Badge>}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your decision · preview only</h3>
                <div className="flex flex-wrap gap-2">
                  {["Accept included work", "Allow an extra revision", "Ask client", "Prepare proposal", "Decline", "Dismiss"].map((label) => <Button key={label} variant={label === "Decline" ? "outline" : "secondary"} size="sm" disabled>{label}</Button>)}
                </div>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">Override reason <span className="font-normal">Required when accepting work outside policy</span><input className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" placeholder="e.g. Our typo, waived at no charge" disabled /></label>
              </section>

              <section className="grid gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client reply preview · editable</h3>
                <div className="rounded-md border bg-muted/50 p-3 text-sm">{selected.reply}</div>
                <p className="text-xs text-muted-foreground">Shown to Harbor &amp; Pine × Website after you confirm. Prices and dates appear only if you enter them.</p>
              </section>

              {selected.privateNote && <section className="grid gap-2 rounded-md border border-warn/30 bg-warn-soft p-3 text-sm"><h3 className="text-xs font-semibold uppercase tracking-wider text-warn">Private note · owner only</h3><p>{selected.privateNote}</p></section>}

              <section className="grid gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolution history</h3>
                <div className="grid gap-1 text-xs text-muted-foreground">{selected.history.map((item) => <p key={item}>{item}</p>)}</div>
              </section>
            </div>
          </section>
        ) : (
          <section className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            <div><ShieldAlert className="mx-auto mb-2 size-6" aria-hidden="true" /><p>No open decisions in this category.</p></div>
          </section>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="size-4" aria-hidden="true" />Sample data. Decision actions are disabled until the review workflow is connected.</p>
    </main>
  );
}
