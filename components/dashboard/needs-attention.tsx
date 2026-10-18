"use client";

import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DecisionActions } from "./decision-actions";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

function reasonLabel(reason: string) {
  return reason.replaceAll("_", " ");
}

const severityStyle: Record<OwnerDecisionRecord["severity"], string> = {
  warning: "border-l-warn",
  critical: "border-l-crit",
  info: "border-l-info",
};

export function NeedsAttention({ decisions }: { decisions: OwnerDecisionRecord[] }) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(decisions[0]?.id ?? null);
  const reasons = useMemo(() => [...new Set(decisions.map((decision) => decision.reason))], [decisions]);
  const visible = useMemo(
    () => decisions.filter((decision) => filter === "all" || decision.reason === filter),
    [decisions, filter],
  );
  const selected = visible.find((decision) => decision.id === selectedId) ?? visible[0];

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Needs Attention</h1>
        <p className="mt-1 text-sm text-muted-foreground">Requests needing your judgment and reply delivery issues.</p>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Filter decisions">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", filter === "all" ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>All ({decisions.length})</button>
        {reasons.map((reason) => (
          <button key={reason} type="button" aria-pressed={filter === reason} onClick={() => setFilter(reason)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors", filter === reason ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>
            {reasonLabel(reason)}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.4fr)]">
        <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Open decisions">
          <div className="border-b px-4 py-3"><h2 className="font-display font-semibold">Open decisions</h2><p className="mt-0.5 text-xs text-muted-foreground">{visible.length} items · owner review required</p></div>
          <div className="divide-y">
            {visible.map((decision) => (
              <button key={decision.id} type="button" onClick={() => setSelectedId(decision.id)} aria-current={selected?.id === decision.id ? "true" : undefined}
                className={cn("flex w-full items-start justify-between gap-3 border-l-[3px] px-4 py-3 text-left transition-colors hover:bg-muted/60", severityStyle[decision.severity], selected?.id === decision.id && "bg-accent/70")}>
                <span className="min-w-0"><span className="block text-sm font-medium leading-snug">{decision.title}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{reasonLabel(decision.reason)} · {decision.request_code} · {decision.project_name}</span></span>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{new Date(decision.updated_at).toLocaleDateString()}</span>
              </button>
            ))}
            {visible.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">No open decisions match this filter.</div>}
          </div>
        </section>

        {selected ? (
          <section className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Decision details">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 md:px-5"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{selected.decision_code} · {selected.request_code} · {selected.project_name}</p><h2 className="mt-1 font-display text-lg font-semibold leading-snug">{selected.title}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.client_name}</p></div><Badge variant="outline" className="shrink-0 capitalize">{reasonLabel(selected.reason)}</Badge></div>
            <div className="grid gap-5 p-4 md:p-5">
              <section className="grid gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client request</h3><blockquote className="rounded-r-md border-l-[3px] border-info bg-info-soft p-3 text-sm">“{selected.source_text || "No source text recorded."}”<cite className="mt-1 block text-xs not-italic text-muted-foreground">{selected.source_meta || selected.client_name}</cite></blockquote></section>
              <div className="grid gap-4 md:grid-cols-2">
                <section className="grid content-start gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope evidence</h3><div className="rounded-r-md border-l-[3px] border-primary bg-accent/70 p-3 text-sm">{selected.evidence || "No scope evidence recorded."}<p className="mt-1 text-xs text-muted-foreground">{selected.evidence_source}</p></div></section>
                <section className="grid content-start gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why it was escalated</h3><p className="text-sm leading-relaxed">{selected.explanation || "Owner review is required."}</p>{selected.missing_details.length > 0 && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing details</p><ul className="list-disc space-y-1 pl-5 text-sm">{selected.missing_details.map((item) => <li key={item}>{item}</li>)}</ul></div>}</section>
              </div>
              <section className="grid gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggested options</h3>{selected.suggested_options.length ? <div className="divide-y rounded-md border">{selected.suggested_options.map((option, index) => <div key={`${option.title}-${index}`} className="px-3 py-2.5"><p className="text-sm font-medium">{option.title}{index === 0 && <Badge className="ml-2" variant="secondary">Suggested</Badge>}</p><p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p></div>)}</div> : <p className="rounded-md border p-3 text-sm text-muted-foreground">No suggested options recorded.</p>}</section>
              <DecisionActions key={selected.id} decision={selected} />
              {selected.internal_note && <section className="grid gap-2 rounded-md border border-warn/30 bg-warn-soft p-3 text-sm"><h3 className="text-xs font-semibold uppercase tracking-wider text-warn">Private note · owner only</h3><p>{selected.internal_note}</p></section>}
              <section className="grid gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolution history</h3>{selected.history.length ? <div className="grid gap-1 text-xs text-muted-foreground">{selected.history.map((item, index) => <p key={`${selected.id}-history-${index}`}>{item}</p>)}</div> : <p className="text-xs text-muted-foreground">No history recorded yet.</p>}</section>
            </div>
          </section>
        ) : (
          <section className="grid min-h-64 place-items-center rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground"><div><ShieldAlert className="mx-auto mb-2 size-6" aria-hidden="true" /><p>No decisions are waiting for review.</p><p className="mt-1 text-xs">New owner-review items will appear here when stored in the workspace database.</p></div></section>
        )}
      </div>

    </main>
  );
}
