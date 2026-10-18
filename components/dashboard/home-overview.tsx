"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CircleAlert,
  FileSignature,
  ListChecks,
  Sparkles,
} from "lucide-react";
import {
  DotChip,
  Pill,
  headCell,
  tableHead,
  tableRow,
  type PillTone,
} from "@/components/dashboard/table-ui";
import { settingsButton } from "@/components/settings/settings-ui";
import type { HomeOverview as Overview } from "@/lib/dashboard/home";
import { cn } from "@/lib/utils";

type Decision = Overview["decisions"]["items"][number];
type Handled = Overview["handled"][number];
type Work = Overview["work"][number];

const reasonTone: Record<string, PillTone> = {
  delivery_unknown: "red",
  failed_processing: "red",
  policy_denied: "red",
  conflicting_request: "red",
  ambiguous_request: "yellow",
  exhausted_allowance: "yellow",
  unknown_participant: "yellow",
  scope_addition: "cyan",
  deadline_change: "blue",
  unsupported_input: "gray",
};

const severityBar: Record<Decision["severity"], string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-400",
  info: "bg-blue-500",
};

const handledState: Record<
  Handled["state"],
  { label: string; tone: PillTone; dot: string }
> = {
  accepted: { label: "Accepted", tone: "green", dot: "bg-lime-500" },
  awaiting_details: {
    label: "Clarifying",
    tone: "yellow",
    dot: "bg-yellow-500",
  },
  closed: { label: "Closed", tone: "gray", dot: "bg-neutral-400" },
};

const taskStatus: Record<Work["status"], { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-blue-500" },
  in_progress: { label: "In progress", dot: "bg-violet-500" },
};

const priorityTone: Record<Work["priority"], PillTone> = {
  high: "red",
  normal: "blue",
  low: "gray",
};

const originTone: Record<Work["origin"], PillTone> = {
  auto: "cyan",
  agreement: "green",
  proposal: "blue",
  manual: "gray",
};

function label(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// Relative to the server's render time so server and client agree.
function ago(value: string, now: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.parse(now) - Date.parse(value)) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

// Long form for the "oldest decision" summary, e.g. "3 days".
function age(value: string, now: string) {
  const hours = Math.max(0, (Date.parse(now) - Date.parse(value)) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 24) return plural(Math.round(hours), "hour");
  return plural(Math.round(hours / 24), "day");
}

function shortDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function agreedDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );
}

function money(cents: number | null, currency: string) {
  if (cents === null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const card =
  "min-w-0 overflow-hidden rounded-2xl border border-sidebar-border bg-card";

function StatCard({
  href,
  icon: Icon,
  value,
  title,
  detail,
  accent,
}: {
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  value: number;
  title: string;
  detail: string;
  accent: "blue" | "amber" | "violet" | "rose";
}) {
  const tones = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300",
    amber:
      "text-amber-600 bg-amber-50 dark:bg-amber-400/15 dark:text-amber-300",
    violet:
      "text-violet-600 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300",
  };
  const valueTone = {
    blue: "text-foreground",
    amber: "text-amber-600 dark:text-amber-300",
    violet: "text-foreground",
    rose: "text-rose-600 dark:text-rose-300",
  };
  const active = value > 0;
  return (
    <Link
      href={href}
      className={cn(
        card,
        "group grid gap-1 p-4 outline-none transition-[box-shadow,border-color] hover:border-neutral-300 hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:hover:border-neutral-600",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "font-display text-[32px] leading-none font-semibold tabular-nums",
            active
              ? valueTone[accent]
              : "text-neutral-400 dark:text-neutral-500",
          )}
        >
          {value}
        </span>
        <span
          aria-hidden
          className={cn(
            "grid size-8 place-items-center rounded-lg",
            active
              ? tones[accent]
              : "bg-sidebar-accent text-neutral-400 dark:text-neutral-500",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-[15px] font-medium text-foreground">{title}</p>
      <p className="flex items-center gap-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
        <span className="truncate">{detail}</span>
        <ArrowRight
          aria-hidden
          className="size-3.5 shrink-0 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
        />
      </p>
    </Link>
  );
}

function PanelCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = `home-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(card, "flex flex-col", className)}
    >
      <header className="flex items-start justify-between gap-4 border-b border-sidebar-border px-5 pt-4 pb-3.5">
        <div className="grid min-w-0 gap-0.5">
          <h2 id={id} className="text-[17px] font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="grid flex-1 place-items-center px-5 py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
      {children}
    </p>
  );
}

function Meta({ children }: { children: ReactNode[] }) {
  const parts = children.filter(Boolean);
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {part}
        </span>
      ))}
    </p>
  );
}

function DecisionRow({ decision, now }: { decision: Decision; now: string }) {
  const href = `/app/decisions?decision=${decision.id}`;
  return (
    <li className="relative flex items-center gap-3 border-b border-sidebar-border py-3 pr-4 pl-5 transition-colors last:border-b-0 hover:bg-sidebar">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-[3px] rounded-r-full",
          severityBar[decision.severity],
        )}
      />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Link
          href={href}
          className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {decision.title}
        </Link>
        <Meta>
          {[
            <Pill key="r" tone={reasonTone[decision.reason] ?? "gray"}>
              {label(decision.reason)}
            </Pill>,
            decision.project.name,
            <span key="c" className="font-mono text-xs">
              {decision.requestCode}
            </span>,
            ago(decision.createdAt, now),
          ]}
        </Meta>
      </div>
      <span
        aria-hidden
        className={cn(
          settingsButton,
          "pointer-events-none relative hidden sm:inline-flex",
        )}
      >
        Open
      </span>
    </li>
  );
}

function HandledRow({ item, now }: { item: Handled; now: string }) {
  const state = handledState[item.state];
  return (
    <li className="relative flex items-start gap-3 border-b border-sidebar-border px-5 py-3 transition-colors last:border-b-0 hover:bg-sidebar">
      <div className="grid min-w-0 flex-1 gap-1">
        <Link
          href={`/app/projects/${item.projectId}/requests/${item.id}`}
          className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {item.summary}
        </Link>
        <Meta>
          {[
            item.project.name,
            item.taskCode && (
              <span key="t" className="inline-flex items-center gap-1">
                <ArrowRight aria-hidden className="size-3" />
                <span className="font-mono text-xs">{item.taskCode}</span>
              </span>
            ),
            item.state === "awaiting_details" &&
              `asked ${plural(item.clarificationTurns, "time")}`,
          ]}
        </Meta>
      </div>
      <div className="grid shrink-0 justify-items-end gap-1.5">
        <Pill tone={state.tone}>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", state.dot)}
            />
            {state.label}
          </span>
        </Pill>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {ago(item.updatedAt, now)}
        </span>
      </div>
    </li>
  );
}

function WorkTable({ work }: { work: Work[] }) {
  const router = useRouter();
  return (
    <div className="@container overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={cn(tableHead, "border-t-0")}>
          <tr>
            <th className={cn(headCell, "pl-5")}>Task</th>
            <th className={headCell}>Status</th>
            <th className={cn(headCell, "hidden @2xl:table-cell")}>Priority</th>
            <th className={cn(headCell, "hidden @4xl:table-cell")}>Assignee</th>
            <th className={cn(headCell, "hidden @3xl:table-cell")}>
              Agreed date
            </th>
            <th className={cn(headCell, "hidden @5xl:table-cell")}>
              Accepted via
            </th>
            <th className={cn(headCell, "hidden pr-5 @xl:table-cell")}>
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {work.map((task) => (
            <tr
              key={task.id}
              className={tableRow}
              onClick={() => router.push(`/app/tasks/${task.id}`)}
            >
              <td className="max-w-0 py-2.5 pr-3 pl-5 @2xl:w-[38%]">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="hidden shrink-0 font-mono text-xs text-neutral-500 @md:inline dark:text-neutral-400">
                    {task.code}
                  </span>
                  <Link
                    href={`/app/tasks/${task.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate font-medium outline-none focus-visible:underline"
                  >
                    {task.title}
                  </Link>
                </div>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {task.project.name}
                </p>
              </td>
              <td className="px-3 py-2.5">
                <DotChip dot={taskStatus[task.status].dot}>
                  {taskStatus[task.status].label}
                </DotChip>
              </td>
              <td className="hidden px-3 py-2.5 @2xl:table-cell">
                <Pill tone={priorityTone[task.priority]}>
                  <span className="capitalize">{task.priority}</span>
                </Pill>
              </td>
              <td className="hidden px-3 py-2.5 whitespace-nowrap @4xl:table-cell">
                {task.assignee}
              </td>
              <td className="hidden px-3 py-2.5 whitespace-nowrap @3xl:table-cell">
                {agreedDate(task.agreedDueDate) ?? (
                  <span className="text-neutral-400 dark:text-neutral-500">
                    No date agreed
                  </span>
                )}
              </td>
              <td className="hidden max-w-48 px-3 py-2.5 @5xl:table-cell">
                <span className="block truncate">
                  <Pill tone={originTone[task.origin]}>
                    {task.originText || label(task.origin)}
                  </Pill>
                </span>
              </td>
              <td className="hidden py-2.5 pr-5 pl-3 whitespace-nowrap text-neutral-500 @xl:table-cell dark:text-neutral-400">
                {shortDate(task.updatedAt, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HomeOverview({
  data,
  greeting,
  today,
  refreshedAt,
}: {
  data: Overview;
  greeting: string;
  today: string;
  refreshedAt: string;
}) {
  const { tasks, decisions, proposals, issues, now } = data;
  const deliveryProblems = issues.deliveryUnknown + issues.deliveryFailed;
  const issueCount = deliveryProblems + issues.failedJobs;
  const latest = proposals.latest;
  const proposalDetail = latest
    ? [
        latest.title,
        latest.revision > 1 && `r${latest.revision}`,
        money(latest.cents, latest.currency),
        latest.sentAt && `sent ${ago(latest.sentAt, now)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Nothing waiting on clients";
  const issueDetail =
    [
      issues.deliveryUnknown && `${issues.deliveryUnknown} delivery unknown`,
      issues.deliveryFailed && `${issues.deliveryFailed} failed to send`,
      issues.failedJobs && `${plural(issues.failedJobs, "processing failure")}`,
    ]
      .filter(Boolean)
      .join(" · ") || "Messaging and automation healthy";

  return (
    <main className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(0,1fr)] gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight">
            {greeting}
          </h1>
          <p className="text-[15px] text-neutral-500 dark:text-neutral-400">
            {today} ·{" "}
            {decisions.count
              ? `${plural(decisions.count, "decision")} ${decisions.count === 1 ? "needs" : "need"} you.`
              : "Nothing needs your decision."}{" "}
            The assistant handled {plural(data.handledThisWeek, "message")} this
            week without you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <span>Updated {refreshedAt}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
              deliveryProblems
                ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : "bg-lime-50 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                deliveryProblems ? "bg-rose-500" : "bg-lime-500",
              )}
            />
            {deliveryProblems ? "Delivery needs a look" : "Messaging healthy"}
          </span>
        </div>
      </header>

      {issues.latest && (
        <div
          role="alert"
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertTriangle aria-hidden className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">
              {issues.latest.state === "unknown"
                ? `${plural(issues.deliveryUnknown, "message")} may not have reached the client.`
                : `${plural(issues.deliveryFailed, "message")} failed to send.`}
            </strong>{" "}
            <span className="text-rose-800/80 dark:text-rose-200/80">
              Latest: “
              {issues.latest.text.length > 90
                ? `${issues.latest.text.slice(0, 90).trimEnd()}…`
                : issues.latest.text}
              ” It has not been resent.
            </span>
          </p>
          <Link
            href={`/app/projects/${issues.latest.projectId}/automation`}
            className={settingsButton}
          >
            Inspect delivery
          </Link>
        </div>
      )}

      <section
        aria-label="Summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          href="/app/tasks?status=ready"
          icon={ListChecks}
          accent="blue"
          value={tasks.ready}
          title="Ready tasks"
          detail={`${tasks.inProgress} in progress · ${tasks.blocked} blocked`}
        />
        <StatCard
          href="/app/decisions"
          icon={CircleAlert}
          accent="amber"
          value={decisions.count}
          title="Decisions needed"
          detail={
            decisions.oldestAt
              ? `Oldest: ${age(decisions.oldestAt, now)}`
              : "You're all caught up"
          }
        />
        <StatCard
          href="/app/proposals?status=awaiting_client"
          icon={FileSignature}
          accent="violet"
          value={proposals.count}
          title="Awaiting client approval"
          detail={proposalDetail}
        />
        <StatCard
          href={
            issues.latest
              ? `/app/projects/${issues.latest.projectId}/automation`
              : "/app/decisions"
          }
          icon={Bot}
          accent="rose"
          value={issueCount}
          title="Automation issues"
          detail={issueDetail}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <PanelCard
          title="Needs your decision"
          description="Exceptions only. Routine accepted work goes to Actionable Tasks."
          action={
            <Link href="/app/decisions" className={settingsButton}>
              Open all
            </Link>
          }
        >
          {decisions.items.length ? (
            <ul>
              {decisions.items.map((d) => (
                <DecisionRow key={d.id} decision={d} now={now} />
              ))}
            </ul>
          ) : (
            <Empty>No open decisions. New exceptions will show up here.</Empty>
          )}
        </PanelCard>

        <PanelCard
          title="Handled automatically"
          description="No response needed. Open any item to inspect or correct it."
          action={
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
            >
              <Sparkles className="size-4" />
            </span>
          }
        >
          {data.handled.length ? (
            <ul>
              {data.handled.map((item) => (
                <HandledRow key={item.id} item={item} now={now} />
              ))}
            </ul>
          ) : (
            <Empty>
              Client requests the assistant handles on its own will appear here.
            </Empty>
          )}
        </PanelCard>
      </div>

      <PanelCard
        title="Work next"
        description="Ready and in-progress tasks across projects."
        action={
          <Link href="/app/tasks" className={settingsButton}>
            Open tasks
          </Link>
        }
      >
        {data.work.length ? (
          <WorkTable work={data.work} />
        ) : (
          <Empty>No ready or in-progress tasks right now.</Empty>
        )}
      </PanelCard>
    </main>
  );
}
