"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, FileText, LayoutGrid, List, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProposalRevisionRecord } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

function proposalCode(id: string) {
  return `P-${id.slice(0, 8).toUpperCase()}`;
}

function proposalKey(proposal: ProposalRevisionRecord) {
  return `${proposal.proposal_id}-r${proposal.revision}`;
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
  const text = status.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type StatusGroup = "draft" | "awaiting" | "approved" | "closed";
const statusFilters: { id: "all" | StatusGroup; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "awaiting", label: "Awaiting client" },
  { id: "approved", label: "Approved" },
  { id: "closed", label: "Closed" },
];

function statusGroup(status: string): StatusGroup {
  if (["awaiting_client", "sent"].includes(status)) return "awaiting";
  if (status === "approved") return "approved";
  if (["superseded", "withdrawn", "expired", "rejected", "declined"].includes(status)) return "closed";
  return "draft";
}

const statusClass: Record<StatusGroup, string> = {
  draft: "border-info/20 bg-info-soft text-info",
  awaiting: "border-warn/20 bg-warn-soft text-warn",
  approved: "border-ok/20 bg-ok-soft text-ok",
  closed: "border-border bg-muted text-muted-foreground",
};

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

function textList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => typeof item === "string" ? item : JSON.stringify(item)) : [];
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
}

export function ProposalsWorkspace({ proposals }: { proposals: ProposalRevisionRecord[] }) {
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [project, setProject] = useState("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const projects = useMemo(() => [...new Map(proposals.map((proposal) => [proposal.project_id, proposal.project_name])).entries()], [proposals]);
  const visible = useMemo(
    () => proposals.filter((proposal) =>
      (filter === "all" || statusGroup(proposal.status) === filter) &&
      (project === "all" || proposal.project_id === project),
    ),
    [proposals, filter, project],
  );
  const selected = proposals.find((proposal) => proposalKey(proposal) === selectedKey) ?? null;
  const pending = proposals.filter((proposal) => statusGroup(proposal.status) === "awaiting").length;

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-5 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Proposals</h1>
            <p className="mt-1 text-sm text-muted-foreground">Private commercial records. Discuss changes with clients through iMessage.</p>
          </div>
          <Badge variant="outline" className="border-info/20 bg-info-soft text-info">Database records · {proposals.length}</Badge>
        </header>

        <section aria-label="Proposal filters and view options">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-full border bg-card p-1" aria-label="Filter by status">
              {statusFilters.map((item) => (
                <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
                  className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors", filter === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={project} onValueChange={setProject}>
                <SelectTrigger aria-label="Project filter" className="w-[170px] bg-card"><SelectValue placeholder="All projects" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="inline-flex rounded-md border bg-card p-0.5" aria-label="Choose proposal view">
                <Button type="button" variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" /></Button>
                <Button type="button" variant={view === "board" ? "secondary" : "ghost"} size="icon-sm" aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")}><LayoutGrid aria-hidden="true" /></Button>
              </div>
            </div>
          </div>
        </section>

        {pending > 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
            <AlertCircle className="size-4 shrink-0 text-warn" aria-hidden="true" />
            <span><strong>{pending} proposal{pending === 1 ? "" : "s"} awaiting client review.</strong> Follow-ups are owner-reviewed.</span>
          </p>
        )}

        {view === "list" ? (
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Proposals">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>{["Proposal", "Project", "Client", "Revision", "Additional price", "Status", "Expires"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {visible.map((proposal) => {
                    const key = proposalKey(proposal);
                    const terms = objectValue(proposal.shared_terms);
                    return (
                      <tr key={key} tabIndex={0} onClick={() => setSelectedKey(key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedKey(key); } }} className="cursor-pointer border-b last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60">
                        <td className="w-[320px] min-w-[320px] px-3 py-3"><div className="flex min-w-0 items-start gap-2"><span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground">{proposalCode(proposal.proposal_id)}</span><span className="min-w-0 break-words font-medium">{proposalTitle(proposal)}</span></div></td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{proposal.project_name}</td>
                        <td className="whitespace-nowrap px-3 py-3">{proposal.client_name}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">r{proposal.revision}</td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{money(priceCents(terms), stringField(terms, "currency") || "USD")}</td>
                        <td className="px-3 py-3"><Badge variant="outline" className={statusClass[statusGroup(proposal.status)]}>{readableStatus(proposal.status)}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{displayDate(proposal.expires_at) ?? <span className="text-muted-foreground">No expiry</span>}</td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && <tr><td colSpan={7} className="px-6 py-14 text-center"><p className="font-medium">No proposals to show</p><p className="mt-1 text-sm text-muted-foreground">Proposal revisions saved for your projects will appear here.</p></td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap justify-between gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground"><span>{visible.length} of {proposals.length} revisions</span><span>Approved proposals become tasks in Actionable Tasks</span></footer>
          </section>
        ) : (
          <section className="overflow-x-auto pb-1" aria-label="Proposals by status">
            <div className="grid min-w-[880px] grid-cols-4 gap-3">
              {statusFilters.slice(1).map((column) => {
                const columnProposals = visible.filter((proposal) => statusGroup(proposal.status) === column.id);
                return (
                  <div key={column.id} className="flex min-h-48 flex-col gap-2 rounded-lg bg-muted p-2.5">
                    <h2 className="flex items-center justify-between px-1 text-sm font-semibold">{column.label}<span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{columnProposals.length}</span></h2>
                    {columnProposals.map((proposal) => {
                      const terms = objectValue(proposal.shared_terms);
                      return <button type="button" key={proposalKey(proposal)} onClick={() => setSelectedKey(proposalKey(proposal))} className="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3 text-left text-sm shadow-sm hover:border-primary/50"><span className="min-w-0 break-words font-medium">{proposalTitle(proposal)}</span><span className="text-xs text-muted-foreground">{proposal.project_name} · {money(priceCents(terms), stringField(terms, "currency") || "USD")}</span><span className="font-mono text-[11px] text-muted-foreground">{proposalCode(proposal.proposal_id)} · r{proposal.revision}</span></button>;
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Proposal data is loaded from stored revisions. Clients discuss terms through the project conversation and have no website access.</p>
      </main>

      {selected && <ProposalDetail proposal={selected} onClose={() => setSelectedKey(null)} />}
    </>
  );
}

function ProposalDetail({ proposal, onClose }: { proposal: ProposalRevisionRecord; onClose: () => void }) {
  const terms = objectValue(proposal.shared_terms);
  const lines = proposalLines(terms);
  const currency = stringField(terms, "currency") || "USD";
  const explanation = stringField(terms, "explanation", "description", "client_explanation");
  const exclusions = textList(terms.exclusions);
  const dependencies = textList(terms.dependencies);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button className="absolute inset-0 bg-foreground/35" aria-label="Close proposal details" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="proposal-detail-title">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <span className="font-mono text-xs text-muted-foreground">{proposalCode(proposal.proposal_id)} · r{proposal.revision}</span>
            <h2 id="proposal-detail-title" className="mt-1 break-words font-display text-xl font-semibold">{proposalTitle(proposal)}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><Badge variant="outline" className={statusClass[statusGroup(proposal.status)]}>{readableStatus(proposal.status)}</Badge><span className="text-muted-foreground">{proposal.project_name} · {proposal.client_name}</span></div>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close proposal details" onClick={onClose}><X aria-hidden="true" /></Button>
        </div>
        <div className="flex flex-col gap-6 p-5">
          <section className="grid gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What the client sees</h3>
            <blockquote className="rounded-r-md border-l-[3px] border-info bg-info-soft p-3 text-sm">{explanation || "No client-facing explanation is recorded in this revision."}</blockquote>
          </section>

          <section className="grid gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deliverables</h3>
            {lines.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {lines.map((line) => <li key={line.key} className="flex items-start justify-between gap-4 px-3 py-2.5"><span className="flex min-w-0 items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="break-words">{line.title}</span></span><span className="shrink-0 tabular-nums text-muted-foreground">{money(line.price, currency)}</span></li>)}
                <li className="flex justify-between gap-4 bg-muted/50 px-3 py-2.5 font-semibold"><span>Additional project price</span><span className="tabular-nums">{money(priceCents(terms), currency)}</span></li>
              </ul>
            ) : <p className="text-sm text-muted-foreground">No deliverable lines are present in the stored terms.</p>}
            <p className="text-xs text-muted-foreground">Approve work from Needs Attention to turn these lines into tasks.</p>
          </section>

          <section className="grid gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terms</h3>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Exclusions</dt><dd>{exclusions.length ? <ul className="list-disc space-y-1 pl-4">{exclusions.map((item, index) => <li key={index}>{item}</li>)}</ul> : "None recorded"}</dd>
              <dt className="text-muted-foreground">Dependencies</dt><dd>{dependencies.length ? <ul className="list-disc space-y-1 pl-4">{dependencies.map((item, index) => <li key={index}>{item}</li>)}</ul> : "None recorded"}</dd>
              <dt className="text-muted-foreground">Expires</dt><dd>{proposal.expires_at ? new Date(proposal.expires_at).toLocaleString() : "No expiry recorded"}</dd>
              <dt className="text-muted-foreground">Revision</dt><dd className="font-mono text-xs">r{proposal.revision}</dd>
            </dl>
          </section>

          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Stored terms record</summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t bg-muted/50 p-3 font-mono text-xs">{JSON.stringify(proposal.shared_terms, null, 2)}</pre>
          </details>

          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-4" aria-hidden="true" />Delivery state and sent time are not stored yet.</p>
        </div>
      </aside>
    </div>
  );
}
