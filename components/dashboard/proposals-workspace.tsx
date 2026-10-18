"use client";

import { useMemo, useState } from "react";
import { AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProposalRevisionRecord } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

function proposalCode(id: string) {
  return `P-${id.slice(0, 8).toUpperCase()}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key] as string;
  return "";
}

function priceCents(terms: Record<string, unknown>) {
  for (const key of ["amount_cents", "price_cents", "additional_price_cents", "total_cents"]) {
    const value = terms[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function money(cents: number | null, currency = "USD") {
  if (cents === null) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusStyle(status: string) {
  if (["awaiting_client", "sent"].includes(status)) return "border-warn/20 bg-warn-soft text-warn";
  if (status === "approved") return "border-ok/20 bg-ok-soft text-ok";
  if (["superseded", "withdrawn", "expired"].includes(status)) return "border-border bg-muted text-muted-foreground";
  return "border-info/20 bg-info-soft text-info";
}

function proposalTitle(proposal: ProposalRevisionRecord) {
  const terms = objectValue(proposal.shared_terms);
  return stringField(terms, "title", "name", "summary") || "Proposal terms";
}

function proposalLines(terms: Record<string, unknown>) {
  const raw = Array.isArray(terms.lines) ? terms.lines : Array.isArray(terms.deliverables) ? terms.deliverables : [];
  return raw.map((item, index) => {
    if (typeof item === "string") return { key: `line-${index + 1}`, title: item, price: null as number | null };
    const line = objectValue(item);
    const amount = typeof line.amount_cents === "number" ? line.amount_cents : typeof line.price_cents === "number" ? line.price_cents : null;
    return {
      key: stringField(line, "key", "id") || `line-${index + 1}`,
      title: stringField(line, "title", "description", "deliverable", "name") || `Deliverable ${index + 1}`,
      price: amount,
    };
  });
}

export function ProposalsWorkspace({ proposals }: { proposals: ProposalRevisionRecord[] }) {
  const [filter, setFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const statuses = useMemo(() => [...new Set(proposals.map((proposal) => proposal.status))], [proposals]);
  const visible = useMemo(() => proposals.filter((proposal) => filter === "all" || proposal.status === filter), [proposals, filter]);
  const selected = visible.find((proposal) => `${proposal.proposal_id}-r${proposal.revision}` === selectedKey) ?? visible[0];
  const pending = proposals.filter((proposal) => proposal.status === "awaiting_client");

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold">Proposals</h1><p className="mt-1 text-sm text-muted-foreground">Private commercial records. Discuss changes with clients through iMessage.</p></div><div className="flex items-center gap-2"><Badge variant="outline" className="border-info/20 bg-info-soft text-info">Database records · {proposals.length}</Badge></div></header>

      <section className="flex flex-wrap gap-2" aria-label="Filter proposals"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", filter === "all" ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground")}>All ({proposals.length})</button>{statuses.map((status) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium capitalize", filter === status ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground")}>{readableStatus(status)}</button>)}</section>

      {pending.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm"><p><strong>{pending.length} proposal{pending.length === 1 ? "" : "s"} awaiting client review.</strong> Follow-ups are owner-reviewed.</p></div>}

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Proposals">
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-sm"><thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><tr>{["Number", "Title", "Project", "Revision", "Additional price", "Business status", "Expires"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{visible.map((proposal) => {const key = `${proposal.proposal_id}-r${proposal.revision}`; const isSelected = selected?.proposal_id === proposal.proposal_id && selected?.revision === proposal.revision; const terms = objectValue(proposal.shared_terms); const currency = stringField(terms, "currency") || "USD"; return <tr key={key} tabIndex={0} aria-current={isSelected ? "true" : undefined} onClick={() => setSelectedKey(key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedKey(key); } }} className={cn("cursor-pointer border-b last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60", isSelected && "bg-accent/60")}><td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{proposalCode(proposal.proposal_id)}</td><td className="min-w-[240px] px-3 py-3 font-medium">{proposalTitle(proposal)}</td><td className="whitespace-nowrap px-3 py-3">{proposal.project_name}</td><td className="whitespace-nowrap px-3 py-3 font-mono text-xs">r{proposal.revision}</td><td className="whitespace-nowrap px-3 py-3 tabular-nums">{money(priceCents(terms), currency)}</td><td className="whitespace-nowrap px-3 py-3"><Badge variant="outline" className={cn("capitalize", statusStyle(proposal.status))}>{readableStatus(proposal.status)}</Badge></td><td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">{proposal.expires_at ? new Date(proposal.expires_at).toLocaleDateString() : "—"}</td></tr>;})}{visible.length === 0 && <tr><td colSpan={7} className="px-6 py-14 text-center"><p className="font-medium">No proposals to show</p><p className="mt-1 text-sm text-muted-foreground">Proposal revisions saved for your projects will appear here.</p></td></tr>}</tbody>
        </table></div><footer className="border-t px-3 py-2.5 text-xs text-muted-foreground">{visible.length} revisions · Business status is read from proposal revisions. Delivery events are not stored yet.</footer>
      </section>

      {selected && (() => {const terms = objectValue(selected.shared_terms); const lines = proposalLines(terms); const currency = stringField(terms, "currency") || "USD"; const explanation = stringField(terms, "explanation", "description", "client_explanation"); const exclusions = Array.isArray(terms.exclusions) ? terms.exclusions : []; const dependencies = Array.isArray(terms.dependencies) ? terms.dependencies : []; return <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-5" aria-label="Selected proposal details">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{proposalCode(selected.proposal_id)} · revision {selected.revision} · {selected.project_name}</p><h2 className="mt-1 font-display text-xl font-semibold">{proposalTitle(selected)}</h2><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline" className={cn("capitalize", statusStyle(selected.status))}>{readableStatus(selected.status)}</Badge><span className="self-center text-xs text-muted-foreground">Client: {selected.client_name}</span></div></div><div className="flex gap-2"></div></div>
        {selected.status !== "draft" && <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-soft p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" /><p>Proposal terms are loaded from the stored shared revision. Clients discuss these terms through iMessage; no client website access is available.</p></div>}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
          <div className="grid gap-4"><section className="overflow-hidden rounded-md border"><div className="border-b px-4 py-3"><h3 className="font-display font-semibold">Shared terms</h3></div><div className="grid gap-3 p-4"><p className="text-sm">{explanation || "No client-facing explanation is recorded in this revision."}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs">{JSON.stringify(selected.shared_terms, null, 2)}</pre></div></section>
            <section className="overflow-hidden rounded-md border"><div className="border-b px-4 py-3"><h3 className="font-display font-semibold">Deliverables and fixed-price lines</h3></div>{lines.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Deliverable</th><th className="px-3 py-2">Price</th></tr></thead><tbody className="divide-y">{lines.map((line) => <tr key={line.key}><td className="px-3 py-2">{line.title}</td><td className="whitespace-nowrap px-3 py-2 tabular-nums">{money(line.price, currency)}</td></tr>)}</tbody></table></div> : <p className="p-4 text-sm text-muted-foreground">No deliverable lines are present in the stored terms.</p>}</section>
            <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exclusions</h3>{exclusions.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{exclusions.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">None recorded.</p>}</div><div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</h3>{dependencies.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{dependencies.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">None recorded.</p>}</div><div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expiry</h3><p className="mt-2 text-sm">{selected.expires_at ? new Date(selected.expires_at).toLocaleString() : "No expiry recorded"}</p></div><div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Additional project price</h3><p className="mt-2 text-sm font-semibold tabular-nums">{money(priceCents(terms), currency)}</p></div></div>
          </div>
          <div className="grid gap-4"><section className="grid gap-3 rounded-md border p-4"><h3 className="font-display font-semibold">Revision record</h3><dl className="grid grid-cols-[1fr_auto] gap-2 text-sm"><dt>Proposal</dt><dd className="font-mono">{proposalCode(selected.proposal_id)}</dd><dt>Revision</dt><dd className="font-mono">r{selected.revision}</dd><dt>Business status</dt><dd className="capitalize">{readableStatus(selected.status)}</dd><dt>Expires</dt><dd>{selected.expires_at ? new Date(selected.expires_at).toLocaleDateString() : "—"}</dd></dl><p className="text-xs text-muted-foreground">Delivery state and sent time are not part of the current database schema.</p></section>
            <section className="grid gap-3 rounded-md border p-4"><h3 className="font-display font-semibold">Recorded deliverable lines</h3>{lines.length ? lines.map((line) => <div key={line.key} className="flex items-start gap-2 border-t pt-2 text-sm"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{line.title}<span className="mt-0.5 block text-xs text-muted-foreground">The owner authorizes project work from Needs Attention.</span></span></div>) : <p className="text-sm text-muted-foreground">No task lines are available in this revision.</p>}</section>
          </div>
        </div>
      </section>;})()}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="size-4" aria-hidden="true" />Proposal data is loaded from stored revisions. These private records do not provide client website access. Discuss terms through the project conversation.</p>
    </main>
  );
}
