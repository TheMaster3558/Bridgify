"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileSignature, Inbox, ListChecks, Scale } from "lucide-react";
import {
  activityActor,
  activityCategories,
  activityCategory,
  activityFacts,
  activitySentence,
  type ActivityCategory,
} from "@/lib/dashboard/activity-format";
import { filterActive, filterButton, filterIdle } from "@/components/dashboard/table-ui";
import { cn } from "@/lib/utils";

export type ActivityEvent = {
  id: string;
  action: string;
  actor_id: string | null;
  version: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const linkChip =
  "inline-flex h-7 items-center gap-1.5 rounded-full bg-sidebar-accent px-2.5 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";

function dayKey(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function ActivityTimeline({
  projectId,
  events,
  viewerId,
  timezone,
  now,
  toolbar,
}: {
  projectId: string;
  events: ActivityEvent[];
  viewerId: string;
  timezone: string;
  /** Server time, so "Today" matches between server and browser. */
  now: string;
  toolbar: React.ReactNode;
}) {
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const present = useMemo(() => new Set(events.map((e) => activityCategory(e.action))), [events]);
  const visible = events.filter((e) => category === "all" || activityCategory(e.action) === category);
  const today = dayKey(now, timezone);
  const yesterday = dayKey(new Date(new Date(now).getTime() - 86400000).toISOString(), timezone);
  const groups: { key: string; label: string; items: ActivityEvent[] }[] = [];
  for (const event of visible) {
    const key = dayKey(event.created_at, timezone);
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = {
        key,
        label:
          key === today
            ? "Today"
            : key === yesterday
              ? "Yesterday"
              : new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "short", day: "numeric" }).format(
                  new Date(event.created_at),
                ),
        items: [],
      };
      groups.push(group);
    }
    group.items.push(event);
  }
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  const root = `/app/projects/${projectId}`;

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6 [&>*]:max-w-[880px]">
      <header>
        <h1 className="font-display text-2xl font-semibold">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything that changed on this project, newest first. Times are in {timezone.replaceAll("_", " ")}.
        </p>
      </header>

      <div role="group" aria-label="Filter by kind" className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {[{ id: "all" as const, label: "Everything", dot: "" }, ...activityCategories.filter((c) => present.has(c.id))].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(filterButton, "inline-flex items-center gap-2", category === c.id ? filterActive : filterIdle)}
          >
            {c.dot && <span aria-hidden className={cn("size-2 rounded-full", c.dot)} />}
            {c.label}
          </button>
        ))}
      </div>

      {toolbar}

      {groups.length ? (
        <div className="grid gap-8">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h2>
              <ol className="relative grid gap-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-sidebar-border">
                {group.items.map((event) => {
                  const meta = activityCategories.find((c) => c.id === activityCategory(event.action))!;
                  const details = event.details ?? {};
                  const reason = typeof details.reason === "string" ? details.reason : null;
                  const facts = activityFacts(details);
                  const expanded = open === event.id;
                  const links = [
                    typeof details.requestId === "string" && { href: `${root}/requests/${details.requestId}`, label: "Request", icon: Inbox },
                    typeof details.taskId === "string" && { href: `/app/tasks/${details.taskId}`, label: "Task", icon: ListChecks },
                    typeof details.decisionId === "string" && {
                      href: `/app/decisions?status=all&project=${projectId}&decision=${details.decisionId}`,
                      label: "Decision",
                      icon: Scale,
                    },
                    typeof details.proposalId === "string" && { href: `${root}/proposals/${details.proposalId}`, label: "Proposal", icon: FileSignature },
                  ].filter(Boolean) as { href: string; label: string; icon: typeof Inbox }[];
                  return (
                    <li key={event.id} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3">
                      <span aria-hidden className="relative z-10 mt-4 grid size-6 place-items-center rounded-full bg-background">
                        <span className={cn("size-2.5 rounded-full ring-4 ring-background", meta.dot)} />
                      </span>
                      <article className="grid gap-2 rounded-2xl border border-sidebar-border bg-card px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <p className="font-medium">{activitySentence(event.action)}</p>
                          <time dateTime={event.created_at} className="text-sm text-muted-foreground tabular-nums">
                            {clock.format(new Date(event.created_at))}
                          </time>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activityActor(event.actor_id, viewerId)} · {meta.label}
                          {event.version != null && ` · project version ${event.version}`}
                        </p>
                        {reason && (
                          <p className="rounded-xl bg-sidebar-accent/70 px-3 py-2 text-sm">“{reason}”</p>
                        )}
                        {(links.length > 0 || facts.length > 0) && (
                          <div className="flex flex-wrap items-center gap-2">
                            {links.map((l) => (
                              <Link key={l.label} href={l.href} className={linkChip}>
                                <l.icon aria-hidden className="size-3.5" />
                                {l.label}
                              </Link>
                            ))}
                            {facts.length > 0 && (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setOpen(expanded ? null : event.id)}
                                className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                              >
                                Details
                                <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
                              </button>
                            )}
                          </div>
                        )}
                        {expanded && (
                          <dl className="grid gap-1.5 border-t border-sidebar-border pt-2 text-sm">
                            {facts.map(([label, value]) => (
                              <div key={label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="break-words">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <section className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-sidebar-border bg-card/60 px-6 py-14 text-center">
          <p className="font-medium">No activity to show</p>
          <p className="max-w-[48ch] text-sm text-muted-foreground">
            {category === "all"
              ? "Setup changes, accepted requests, replies and proposals are recorded here as they happen."
              : "Nothing of this kind on this page. Choose Everything to see all activity."}
          </p>
        </section>
      )}
    </main>
  );
}
