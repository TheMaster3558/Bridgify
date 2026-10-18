"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Proposal = {
  id: string;
  revision: number;
  title: string;
  project: string;
  amount: number;
  status: "awaiting_client" | "draft" | "superseded" | "approved";
  delivery: "sent" | "not_sent";
  sent: string;
  request: string;
  expires: string;
  dateChange: string;
};

const proposals: Proposal[] = [
  { id: "P-001", revision: 2, title: "Customer accounts (email and password)", project: "Harbor & Pine Bakery", amount: 60000, status: "awaiting_client", delivery: "sent", sent: "Oct 14, 5:02 PM", request: "R-5", expires: "Oct 30, 2026", dateChange: "Nov 20 → Dec 4, 2026" },
  { id: "P-002", revision: 1, title: "Google sign-in for customer accounts", project: "Harbor & Pine Bakery", amount: 35000, status: "draft", delivery: "not_sent", sent: "—", request: "R-6", expires: "—", dateChange: "No date change" },
  { id: "P-001", revision: 1, title: "Customer accounts (email and password)", project: "Harbor & Pine Bakery", amount: 60000, status: "superseded", delivery: "sent", sent: "Oct 14, 3:20 PM", request: "R-5", expires: "—", dateChange: "Nov 20 → Nov 27, 2026" },
  { id: "P-007", revision: 1, title: "Spanish translation of all pages", project: "Okafor Law website", amount: 90000, status: "approved", delivery: "sent", sent: "Aug 28, 2026", request: "R-31", expires: "—", dateChange: "Sep 30 → Oct 7, 2026" },
];

const filters = ["all", "awaiting_client", "draft", "approved", "superseded"] as const;
type Filter = (typeof filters)[number];

const statusLabels: Record<Proposal["status"], string> = {
  awaiting_client: "Awaiting client",
  draft: "Draft",
  superseded: "Superseded",
  approved: "Approved",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function statusStyle(status: Proposal["status"]) {
  return {
    awaiting_client: "border-warn/20 bg-warn-soft text-warn",
    draft: "border-border bg-muted text-muted-foreground",
    superseded: "border-border bg-muted text-muted-foreground",
    approved: "border-ok/20 bg-ok-soft text-ok",
  }[status];
}

export function ProposalsWorkspace() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedKey, setSelectedKey] = useState("P-001-r2");
  const visible = useMemo(
    () => proposals.filter((proposal) => filter === "all" || proposal.status === filter),
    [filter],
  );
  const selected = visible.find((proposal) => `${proposal.id}-r${proposal.revision}` === selectedKey) ?? visible[0];

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Proposals</h1>
          <p className="mt-1 text-sm text-muted-foreground">Additional work offered to clients. Same list component as each project’s Proposals tab.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-info/20 bg-info-soft text-info">Preview data</Badge>
          <Button disabled title="Proposal creation will be connected with the proposal workflow">New proposal</Button>
        </div>
      </header>

      <section className="flex flex-wrap gap-2" aria-label="Filter proposals">
        {filters.map((item) => (
          <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors", filter === item ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>
            {item === "all" ? `All (${proposals.length})` : statusLabels[item]}
          </button>
        ))}
      </section>

      {visible.some((proposal) => proposal.status === "awaiting_client") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
          <p><strong>P-001 r2 awaiting Maya Chen</strong> for 2 days. Expires Oct 30. Follow-ups are owner-reviewed.</p>
          <Button variant="outline" size="sm" disabled>Draft follow-up</Button>
        </div>
      )}

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Proposals">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-sm">
            <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>{["Number", "Title", "Project", "Revision", "Additional price", "Business status", "Delivery", "Sent"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((proposal) => {
                const key = `${proposal.id}-r${proposal.revision}`;
                const isSelected = selected?.id === proposal.id && selected?.revision === proposal.revision;
                return (
                  <tr key={key} tabIndex={0} aria-current={isSelected ? "true" : undefined}
                    onClick={() => setSelectedKey(key)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedKey(key); } }}
                    className={cn("cursor-pointer border-b last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60", isSelected && "bg-accent/60")}>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{proposal.id}</td>
                    <td className="min-w-[250px] px-3 py-3 font-medium">{proposal.title}<span className="mt-1 block text-xs font-normal text-muted-foreground">From {proposal.request}</span></td>
                    <td className="whitespace-nowrap px-3 py-3">{proposal.project}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">r{proposal.revision}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatMoney(proposal.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3"><Badge variant="outline" className={statusStyle(proposal.status)}>{statusLabels[proposal.status]}</Badge></td>
                    <td className="whitespace-nowrap px-3 py-3"><Badge variant="outline" className={proposal.delivery === "sent" ? "border-info/20 bg-info-soft text-info" : "border-border bg-muted text-muted-foreground"}>{proposal.delivery === "sent" ? "Sent" : "Not sent"}</Badge></td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">{proposal.sent}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={8} className="px-6 py-14 text-center text-muted-foreground">No proposals in this view.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="border-t px-3 py-2.5 text-xs text-muted-foreground">{visible.length} proposals · Business status and delivery status are tracked separately.</footer>
      </section>

      {selected && (
        <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-5" aria-label="Selected proposal details">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{selected.id} · revision {selected.revision} · from {selected.request}</p>
              <h2 className="mt-1 font-display text-xl font-semibold">{selected.title}</h2>
              <div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline" className={statusStyle(selected.status)}>{statusLabels[selected.status]}</Badge><Badge variant="outline" className="border-info/20 bg-info-soft text-info">{selected.delivery === "sent" ? `Delivered · ${selected.sent}` : "Not sent"}</Badge>{selected.status === "superseded" && <span className="self-center text-xs text-muted-foreground">This revision can no longer be approved.</span>}</div>
            </div>
            <div className="flex gap-2"><Button variant="outline" disabled>Supersede with new revision…</Button><Button variant="outline" disabled>Withdraw</Button></div>
          </div>

          {selected.delivery === "sent" && <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info-soft p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" /><p>This revision has been sent, so its terms are frozen. Changing the price, deliverables, or date creates a new revision.</p></div>}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
            <div className="grid gap-4">
              <section className="overflow-hidden rounded-md border">
                <div className="border-b px-4 py-3"><h3 className="font-display font-semibold">Terms</h3></div>
                <div className="grid gap-3 p-4">
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">Title<input className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={selected.title} readOnly /></label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">Client-facing explanation<textarea className="min-h-20 rounded-md border bg-background p-3 text-sm font-normal text-foreground" value="You asked whether customers can create accounts. This adds email-and-password accounts so regulars can sign in and save their favorite location. Online ordering and social sign-in are not included." readOnly /></label>
                  <p className="text-xs text-muted-foreground">Draft terms for owner review. Commercial terms are set by the project owner.</p>
                </div>
              </section>

              <section className="overflow-hidden rounded-md border">
                <div className="border-b px-4 py-3"><h3 className="font-display font-semibold">Deliverables and fixed-price lines</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm"><thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Key</th><th className="px-3 py-2">Deliverable</th><th className="px-3 py-2">Price</th></tr></thead>
                    <tbody className="divide-y"><tr><td className="px-3 py-2 font-mono text-xs">L1</td><td className="px-3 py-2">Customer sign-up and sign-in (email + password)</td><td className="px-3 py-2 tabular-nums">$350</td></tr><tr><td className="px-3 py-2 font-mono text-xs">L2</td><td className="px-3 py-2">Password reset by email</td><td className="px-3 py-2 tabular-nums">$150</td></tr><tr><td className="px-3 py-2 font-mono text-xs">L3</td><td className="px-3 py-2">Account profile page</td><td className="px-3 py-2 tabular-nums">$100</td></tr></tbody>
                    <tfoot className="border-t bg-muted/50 font-semibold"><tr><td colSpan={2} className="px-3 py-2">Additional project price</td><td className="px-3 py-2 tabular-nums">{formatMoney(selected.amount)}</td></tr></tfoot>
                  </table>
                </div>
              </section>

              <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
                <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exclusions</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Social login (Google, Apple, Facebook)</li><li>Saved payment methods or order history</li><li>Online ordering or checkout</li></ul></div>
                <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li>Client provides a transactional email account</li><li>Privacy policy text supplied by client</li></ul></div>
                <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule impact</h3><p className="mt-2 text-sm">Agreed launch moves <strong>{selected.dateChange}</strong></p></div>
                <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expiry and approver</h3><p className="mt-2 text-sm">Expires {selected.expires} · Approver: <strong>Maya Chen</strong></p></div>
              </div>
            </div>

            <div className="grid gap-4">
              <section className="grid gap-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="font-display font-semibold">Outgoing iMessage</h3><span className="text-xs text-muted-foreground">Exact text sent</span></div>
                <p className="rounded-md bg-muted p-3 text-sm">Amogh has prepared a proposal for customer accounts ($600, launch moves to Dec 4). Please review and confirm here so the exact terms are recorded: bridgify.app/proposals/P-001?revision={selected.revision}</p>
                <Button variant="outline" disabled><ArrowUpRight aria-hidden="true" />Preview client page</Button>
              </section>
              <section className="grid gap-3 rounded-md border p-4">
                <h3 className="font-display font-semibold">Value if approved</h3>
                <dl className="grid grid-cols-[1fr_auto] gap-2 text-sm"><dt>Original project price</dt><dd>$3,000</dd><dt>Approved additions</dt><dd>$0</dd><dt className="text-muted-foreground">This proposal</dt><dd className="text-muted-foreground">+{formatMoney(selected.amount)}</dd><dt className="border-t pt-2 font-semibold">Approved total after approval</dt><dd className="border-t pt-2 font-semibold">{formatMoney(300000 + selected.amount)}</dd></dl>
                <p className="text-xs text-muted-foreground">Agreed work value, not payment received.</p>
              </section>
              <section className="grid gap-3 rounded-md border p-4">
                <h3 className="font-display font-semibold">Revisions</h3>
                <div className="flex items-start justify-between gap-2 border-t pt-3"><div><p className="text-sm font-medium">r2 · $600 · Dec 4</p><p className="mt-0.5 text-xs text-muted-foreground">Sent Oct 14, 5:02 PM · hash 9be1…04</p></div><Badge variant="outline" className={statusStyle("awaiting_client")}>Awaiting client</Badge></div>
                <div className="flex items-start justify-between gap-2 border-t pt-3"><div><p className="text-sm font-medium">r1 · $600 · Nov 27</p><p className="mt-0.5 text-xs text-muted-foreground">Sent Oct 14, 3:20 PM · date was too tight</p></div><Badge variant="outline" className={statusStyle("superseded")}>Superseded</Badge></div>
              </section>
              <section className="grid gap-3 rounded-md border p-4"><h3 className="font-display font-semibold">Tasks created on approval</h3>{["Customer sign-up and sign-in (email + password)", "Password reset by email", "Account profile page"].map((title, index) => <div key={title} className="flex items-start gap-2 border-t pt-2 text-sm"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{title}<span className="mt-0.5 block font-mono text-xs text-muted-foreground">P-001 r2 · line {index + 1}</span></span></div>)}</section>
            </div>
          </div>
        </section>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="size-4" aria-hidden="true" />Sample data. Proposal edits, sending, and approval are not connected yet.</p>
    </main>
  );
}
