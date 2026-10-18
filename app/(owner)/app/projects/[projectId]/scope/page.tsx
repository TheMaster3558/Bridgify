import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CircleCheck,
  CircleSlash,
  Handshake,
  RefreshCcw,
} from "lucide-react";
import { AutomationManagement } from "@/components/automation/management";
import { RevisionMeter } from "@/components/dashboard/table-ui";
import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import { revisionSummary } from "@/lib/dashboard/summary";
import type { Bundle } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-sidebar-border bg-card";

const groups = [
  { kind: "inclusion", title: "Included", icon: CircleCheck, tone: "text-ok bg-ok-soft" },
  { kind: "exclusion", title: "Not included", icon: CircleSlash, tone: "text-crit bg-crit-soft" },
  { kind: "date", title: "Deadlines", icon: CalendarClock, tone: "text-info bg-info-soft" },
  { kind: "revision", title: "Revisions", icon: RefreshCcw, tone: "text-primary bg-accent" },
  { kind: "responsibility", title: "Client provides", icon: Handshake, tone: "text-warn bg-warn-soft" },
] as const;

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { client } = await requireOwner();
  const [bundle, accounting] = await Promise.all([
    projectBundle(client, projectId) as Promise<Bundle>,
    revisionSummary(client, projectId),
  ]);
  const p = bundle.project;
  const baseline = bundle.scope.find((s) => s.version === p.scope_version);
  const rounds = p.policy?.allowance_mode === "manual_rounds";
  const included = p.policy?.allowance ?? baseline?.agreement?.commercial.revision.allowance ?? 0;
  const used = rounds ? accounting.roundsUsed : accounting.requestsUsed;
  const page = (spanId: string) => bundle.spans.find((s) => s.id === spanId)?.page;

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Scope & Revisions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What you agreed to with {p.client_name}. Bridgify checks every client request against this.
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sidebar-accent px-4 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
          href={`/app/projects/${projectId}/scope/history`}
        >
          Read confirmed agreement and scope history
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <section className="grid gap-4" aria-label="Agreement at a glance">
          {baseline ? (
            groups.map((g) => {
              const terms = baseline.terms.filter((t) => t.kind === g.kind);
              if (!terms.length) return null;
              return (
                <section key={g.kind} className={cn(card, "p-5")}>
                  <h2 className="mb-3 flex items-center gap-2 font-medium">
                    <span className={cn("grid size-7 place-items-center rounded-full", g.tone)}>
                      <g.icon aria-hidden className="size-4" />
                    </span>
                    {g.title}
                    <span className="text-sm font-normal text-muted-foreground">{terms.length}</span>
                  </h2>
                  <ul className="grid gap-1">
                    {terms.map((t, i) => (
                      <li key={i}>
                        <details className="group rounded-xl px-3 py-2 transition-colors open:bg-sidebar-accent/60 hover:bg-sidebar-accent/40">
                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm leading-relaxed">
                            <span>{t.text}</span>
                            <span className="shrink-0 pt-0.5 text-xs text-muted-foreground group-open:hidden">Source</span>
                          </summary>
                          <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                            “{t.quote}”
                            <cite className="mt-1 block text-xs not-italic">
                              {page(t.span_id) ? `Agreement page ${page(t.span_id)}` : "Agreement"}
                            </cite>
                          </blockquote>
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          ) : (
            <section className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-sidebar-border bg-card/60 px-6 py-14 text-center">
              <p className="font-medium">No confirmed agreement yet</p>
              <p className="max-w-[48ch] text-sm text-muted-foreground">
                Import and confirm the agreement in setup. Bridgify won’t accept any work until the scope is confirmed.
              </p>
              <Link className="mt-2 text-sm font-medium text-primary hover:underline" href={`/app/projects/${projectId}/setup?step=2`}>
                Go to agreement setup
              </Link>
            </section>
          )}
        </section>

        <aside className="grid gap-5 lg:sticky lg:top-5">
          <section className={cn(card, "grid gap-4 p-5")}>
            <h2 className="text-sm font-medium text-muted-foreground">{rounds ? "Feedback rounds" : "Included revisions"}</h2>
            <RevisionMeter included={included} used={used} unit={rounds ? "rounds" : "requests"} />
            <dl className="grid gap-1.5 border-t border-sidebar-border pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Accepted requests</dt>
                <dd className="tabular-nums">{accounting.grossRequests}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Refunded</dt>
                <dd className="tabular-nums">{accounting.requestRefunds}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Baseline</dt>
                <dd>{p.scope_version ? `Scope v${p.scope_version}` : "Not confirmed"}</dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Accepting a request uses one. Cancelling keeps the usage unless you refund it below, with a reason.
            </p>
          </section>
        </aside>
      </div>

      <section className="grid gap-3" aria-label="Usage and refunds">
        <h2 className="font-display text-lg font-semibold">Usage and refunds</h2>
        <AutomationManagement projectId={projectId} accountingOnly />
      </section>
    </main>
  );
}
