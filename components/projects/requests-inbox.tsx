"use client";

import Link from "next/link";
import { ChevronRight, CircleHelp, ListChecks, Scale } from "lucide-react";
import {
  clientQuote,
  intentLabel,
  relativeTime,
  requestStateMeta,
  requestStates,
  scopeLabel,
} from "@/lib/dashboard/request-labels";
import { filterActive, filterButton, filterIdle } from "@/components/dashboard/table-ui";
import { cn } from "@/lib/utils";

export type InboxRequest = {
  id: string;
  summary: string;
  state: string;
  intent: unknown;
  clarification_turns: number;
  task_id: string | null;
  decision_id: string | null;
  created_at: string;
  updated_at: string;
};

export function RequestsInbox({
  projectId,
  clientName,
  requests,
  counts,
  status,
  query,
  toolbar,
}: {
  projectId: string;
  clientName: string;
  requests: InboxRequest[];
  counts: Record<string, number>;
  status: string;
  query: string;
  toolbar: React.ReactNode;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const tabs = [...requestStates.map((s) => ({ id: s.id as string, label: s.label, count: counts[s.id] ?? 0 })), { id: "all", label: "All", count: total }];
  const href = (id: string) => {
    const params = new URLSearchParams();
    if (id !== "all") params.set("status", id);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  };
  const empty =
    status === "all"
      ? query
        ? "No requests match your search."
        : `No requests yet. When ${clientName} asks for a change in the chat, it appears here with Bridgify’s assessment.`
      : query
        ? "No requests in this view match your search."
        : requestStateMeta(status).empty;

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What {clientName} asked for in the chat, and where each request stands.
        </p>
      </header>

      <nav aria-label="Request status" className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const current = status === tab.id;
          const attention = tab.id === "owner_review" && tab.count > 0 && !current;
          return (
            <Link
              key={tab.id}
              href={href(tab.id)}
              aria-current={current ? "page" : undefined}
              className={cn(filterButton, "inline-flex items-center gap-2", current ? filterActive : filterIdle)}
            >
              {tab.label}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                  current ? "bg-white/20" : attention ? "bg-warn text-white" : "bg-card",
                )}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {toolbar}

      {requests.length ? (
        <ul className="grid gap-3" aria-label="Requests">
          {requests.map((r) => {
            const state = requestStateMeta(r.state);
            const intent = (r.intent ?? {}) as Record<string, unknown>;
            const quote = clientQuote(r.intent);
            const kind = intentLabel(intent.intent);
            const scope = scopeLabel(intent.scopeAssessment);
            return (
              <li key={r.id}>
                <Link
                  href={`/app/projects/${projectId}/requests/${r.id}`}
                  className="group grid grid-cols-[4px_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-sidebar-border bg-card outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                >
                  <span aria-hidden className={state.tone} />
                  <div className="grid min-w-0 gap-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className={cn("rounded-md px-2 py-0.5", state.chip)}>{state.label}</span>
                      {kind && <span className="rounded-md bg-sidebar-accent px-2 py-0.5 text-muted-foreground">{kind}</span>}
                      {scope && <span className={cn("rounded-md px-2 py-0.5", scope.chip)}>{scope.label}</span>}
                      <span className="text-muted-foreground">
                        <time dateTime={r.created_at} suppressHydrationWarning>
                          Asked {relativeTime(r.created_at)}
                        </time>
                      </span>
                    </div>
                    {quote ? (
                      <div className="grid gap-1.5">
                        <p className="w-fit max-w-[60ch] rounded-2xl rounded-bl-md bg-sidebar-accent px-4 py-2.5 font-display text-lg leading-snug break-words">
                          “{quote}”
                        </p>
                        <p className="text-sm text-muted-foreground">{r.summary}</p>
                      </div>
                    ) : (
                      <p className="max-w-[70ch] font-display text-lg leading-snug break-words">{r.summary}</p>
                    )}
                    {(r.clarification_turns > 0 || r.task_id || r.decision_id) && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {r.clarification_turns > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <CircleHelp aria-hidden className="size-3.5" />
                            {r.clarification_turns} {r.clarification_turns === 1 ? "question asked" : "questions asked"}
                          </span>
                        )}
                        {r.task_id && (
                          <span className="inline-flex items-center gap-1">
                            <ListChecks aria-hidden className="size-3.5" />
                            Task created
                          </span>
                        )}
                        {r.decision_id && (
                          <span className="inline-flex items-center gap-1">
                            <Scale aria-hidden className="size-3.5" />
                            Decision recorded
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="grid place-items-center pr-4 text-muted-foreground transition-transform group-hover:translate-x-0.5">
                    <ChevronRight aria-hidden className="size-5" />
                    <span className="sr-only">Open request</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-sidebar-border bg-card/60 px-6 py-14 text-center">
          <p className="font-medium">{status === "owner_review" && !query ? "You’re all caught up" : "No requests to show"}</p>
          <p className="max-w-[52ch] text-sm text-muted-foreground">{empty}</p>
          <Link className="mt-2 text-sm font-medium text-primary hover:underline" href={`/app/projects/${projectId}/conversation`}>
            Open the conversation
          </Link>
        </section>
      )}
    </main>
  );
}
