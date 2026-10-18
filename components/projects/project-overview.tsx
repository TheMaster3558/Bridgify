import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";
import type { WorkSummary } from "@/lib/dashboard/summary";
import type { Bundle } from "@/lib/domain/types";
import { RevisionMeter } from "@/components/dashboard/table-ui";
import { LifecycleControls } from "@/components/setup/lifecycle-controls";
import { cn } from "@/lib/utils";
import { DeleteProject } from "./delete-project";

const card = "rounded-2xl border border-sidebar-border bg-card";
const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-sidebar-accent px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";

function CardTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sidebar-border py-2.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-words">{children}</dd>
    </div>
  );
}

export function ProjectOverview({
  bundle,
  owner,
  summary,
  accounting,
}: {
  bundle: Bundle;
  owner: string;
  summary?: WorkSummary;
  accounting?: {
    requestsUsed: number;
    roundsUsed: number;
    grossRequests: number;
    requestRefunds: number;
  };
}) {
  const p = bundle.project,
    root = `/app/projects/${p.id}`;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: p.currency,
    }).format(cents / 100);
  const baseline = bundle.scope.find((s) => s.version === p.scope_version);
  const revisions = baseline?.agreement?.commercial.revision;
  const rounds = p.policy?.allowance_mode === "manual_rounds";
  const included = p.policy?.allowance ?? revisions?.allowance ?? 0;
  const used = accounting
    ? rounds
      ? accounting.roundsUsed
      : accounting.requestsUsed
    : 0;
  const additions = p.approved_additions_cents ?? 0;
  const due = p.agreed_due_date
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(`${p.agreed_due_date}T00:00:00Z`))
    : null;
  const client = p.people?.client_name || p.client_name;
  const issues = summary ? summary.unknown + summary.failed : 0;
  const automationOn = p.status === "active" && p.policy?.mode === "enabled";

  const status = !summary
    ? {
        tone: "info",
        icon: ShieldCheck,
        text: "Project summary is not available yet.",
      }
    : summary.decisions > 0
      ? {
          tone: "warn",
          icon: CircleAlert,
          text: `${summary.decisions} ${summary.decisions === 1 ? "decision needs" : "decisions need"} you before Bridgify can answer ${client}.`,
        }
      : issues > 0
        ? {
            tone: "crit",
            icon: CircleAlert,
            text: `${issues} ${issues === 1 ? "reply or analysis needs" : "replies or analyses need"} attention in Automation.`,
          }
        : automationOn
          ? {
              tone: "ok",
              icon: CircleCheck,
              text: `Bridgify is handling ${client}'s chat. Nothing needs you right now.`,
            }
          : p.status === "paused"
            ? {
                tone: "warn",
                icon: CircleAlert,
                text: "Automation is paused. Messages are logged but nothing is accepted automatically.",
              }
            : {
                tone: "info",
                icon: ShieldCheck,
                text: "Bridgify is reading the chat in review-only mode. You approve every request.",
              };
  const toneClass = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    crit: "bg-crit-soft text-crit",
    info: "bg-info-soft text-info",
  }[status.tone]!;
  const StatusIcon = status.icon;

  const work = summary
    ? [
        { label: "Ready", value: summary.ready, bar: "bg-info" },
        { label: "In progress", value: summary.inProgress, bar: "bg-primary" },
        { label: "Blocked", value: summary.blocked, bar: "bg-warn" },
      ]
    : [];
  const workTotal = work.reduce((sum, w) => sum + w.value, 0);

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <section
        className={cn(
          card,
          "flex flex-wrap items-center justify-between gap-4 p-5",
        )}
        aria-label="Where things stand"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full",
              toneClass,
            )}
          >
            <StatusIcon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-xl leading-snug font-semibold">
              {status.text}
            </p>
            {summary && (
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.proposals}{" "}
                {summary.proposals === 1 ? "proposal" : "proposals"} awaiting
                the client · {summary.queued}{" "}
                {summary.queued === 1 ? "reply" : "replies"} queued
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary && summary.decisions > 0 && (
            <Link
              className={cn(chip, "bg-primary text-primary-foreground hover:bg-primary/90")}
              href={`/app/decisions?project=${p.id}`}
            >
              Review {summary.decisions === 1 ? "decision" : "decisions"}
            </Link>
          )}
          {issues > 0 && (
            <Link className={chip} href={`${root}/automation`}>
              Open Automation
            </Link>
          )}
          <Link className={chip} href={`${root}/conversation`}>
            <MessagesSquare aria-hidden className="size-4" />
            Open conversation
          </Link>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <div className="grid gap-5">
          <section className={cn(card, "grid gap-4 p-5")}>
            <CardTitle
              action={
                <Link className={chip} href={`${root}/work`}>
                  Open Work
                </Link>
              }
            >
              Work
            </CardTitle>
            {summary ? (
              <>
                <div
                  className="flex h-2 overflow-hidden rounded-full bg-sidebar-accent"
                  aria-hidden
                >
                  {work.map((w) =>
                    w.value ? (
                      <span
                        key={w.label}
                        className={w.bar}
                        style={{ width: `${(w.value / workTotal) * 100}%` }}
                      />
                    ) : null,
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-3">
                  {work.map((w) => (
                    <div key={w.label} className="grid gap-1">
                      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span
                          aria-hidden
                          className={cn("size-2 rounded-full", w.bar)}
                        />
                        {w.label}
                      </dt>
                      <dd className="font-display text-2xl font-semibold tabular-nums">
                        {w.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {!workTotal && (
                  <p className="text-sm text-muted-foreground">
                    No open tasks. Accepted client requests become tasks here.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No work summary available.
              </p>
            )}
          </section>

          <section className={cn(card, "grid gap-3 p-5")}>
            <CardTitle>Agreed value</CardTitle>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Original price</dt>
                <dd className="tabular-nums">
                  {money(p.original_amount_cents)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Approved additions</dt>
                <dd className="tabular-nums">
                  {additions ? `+ ${money(additions)}` : money(0)}
                </dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-sidebar-border pt-3">
                <dt className="font-medium">Approved total</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">
                  {money(p.original_amount_cents + additions)}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Only recorded client approvals are added. Pending proposals don’t
              change this total. This is agreed work value, not an invoice or
              payment.
            </p>
          </section>
        </div>

        <div className="grid gap-5">
          <section className={cn(card, "grid gap-4 p-5")}>
            <CardTitle
              action={
                <Link className={chip} href={`${root}/scope`}>
                  Details
                </Link>
              }
            >
              {rounds ? "Feedback rounds" : "Included revisions"}
            </CardTitle>
            {included || used ? (
              <RevisionMeter
                included={included}
                used={used}
                unit={rounds ? "rounds" : "requests"}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No revision allowance in the confirmed agreement.
              </p>
            )}
            {accounting && accounting.requestRefunds > 0 && (
              <p className="text-xs text-muted-foreground">
                {accounting.requestRefunds}{" "}
                {accounting.requestRefunds === 1 ? "request" : "requests"}{" "}
                refunded
              </p>
            )}
          </section>

          <section className={cn(card, "grid gap-3 p-5")}>
            <CardTitle>iMessage connection</CardTitle>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-full",
                  p.people
                    ? bundle.binding?.test_state === "sent"
                      ? "bg-ok"
                      : "bg-warn"
                    : "bg-neutral-400",
                )}
              />
              <p className="font-medium">
                {p.people
                  ? `Linked to ${p.people.client_name}`
                  : "No client linked yet"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {p.people
                ? `Introduction ${bundle.binding?.test_state === "sent" ? "sent" : bundle.binding?.test_state || "not sent"}.`
                : "Connect the client in setup so Bridgify can join the chat."}
            </p>
            <Link
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
              href={
                p.activation_cutoff
                  ? `${root}/automation`
                  : `${root}/setup?step=3`
              }
            >
              Manage client connection
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </section>

          <section className={cn(card, "p-5")}>
            <CardTitle>Project details</CardTitle>
            <dl className="mt-2 text-sm">
              <Detail label="Client">{p.client_name}</Detail>
              <Detail label="Owner">{owner || "Workspace owner"}</Detail>
              <Detail label="Agreed launch">
                {due ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays
                      aria-hidden
                      className="size-3.5 text-muted-foreground"
                    />
                    {due}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No date agreed</span>
                )}
              </Detail>
              <Detail label="Timezone">{p.timezone}</Detail>
              <Detail label="Scope">
                {p.scope_version ? (
                  <Link
                    className="text-primary hover:underline"
                    href={`${root}/scope/history`}
                  >
                    v{p.scope_version} baseline
                  </Link>
                ) : (
                  "Not confirmed"
                )}
              </Detail>
            </dl>
          </section>
        </div>
      </div>

      <details className={cn(card, "group p-5")}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
          Project lifecycle controls
          <span className="text-sm font-normal text-muted-foreground group-open:hidden">
            Pause, review-only, complete or delete
          </span>
        </summary>
        <div className="mt-4 grid gap-5">
          <LifecycleControls
            id={p.id}
            version={p.version}
            status={p.status}
            mode={p.policy?.mode || "review_only"}
          />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-crit-soft/60 p-4">
            <div>
              <h2 className="font-medium">Delete project</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently remove this project and its saved records.
              </p>
            </div>
            <DeleteProject id={p.id} name={p.name} />
          </div>
        </div>
      </details>
    </main>
  );
}
