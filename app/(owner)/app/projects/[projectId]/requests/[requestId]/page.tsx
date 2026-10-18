import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  FileSignature,
  ListChecks,
  MessagesSquare,
  Scale,
} from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { requestDetail } from "@/lib/requests/detail";
import { activitySentence } from "@/lib/dashboard/activity-format";
import {
  intentLabel,
  relativeTime,
  requestStateMeta,
  scopeLabel,
} from "@/lib/dashboard/request-labels";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-sidebar-border bg-card";
const linkChip =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-sidebar-accent px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";

function plainValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value).replaceAll("_", " ");
  if (Array.isArray(value)) return value.length ? value.map((v) => plainValue(v) ?? "").filter(Boolean).join(", ") : null;
  return null;
}

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; requestId: string }>;
}) {
  const { client } = await requireOwner();
  const { projectId, requestId } = await params;
  const [d, projectResult] = await Promise.all([
    requestDetail(client, projectId, requestId),
    client.from("projects").select("client_name,timezone,people").eq("id", projectId).maybeSingle(),
  ]);
  const project = checked(projectResult) as {
    client_name: string;
    timezone: string;
    people: { client_name?: string } | null;
  } | null;
  const timezone = project?.timezone || "UTC";
  const clientName = project?.people?.client_name || project?.client_name || "Client";
  const time = (value: string) =>
    new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  const root = `/app/projects/${projectId}`;
  const state = requestStateMeta(d.request.state);
  const intent = (d.request.intent ?? {}) as Record<string, unknown>;
  const scope = scopeLabel(intent.scopeAssessment);
  const payload = (intent.payload ?? {}) as Record<string, unknown>;
  const facts: [string, string][] = [];
  for (const [label, value] of [
    ["What kind of message", intentLabel(intent.intent)],
    ["Change", plainValue(intent.operation)],
    ["Where", plainValue(payload.targetDescription) ?? plainValue(payload.locator)],
    ["New text", plainValue(payload.replacementText)],
    ["Colour", plainValue(payload.color)],
    ["Instructions", plainValue(payload.instructions)],
    ["Still missing", plainValue(intent.missingFields)],
    ["Asks for a new deadline", intent.requestsNewDeadline ? "Yes" : null],
    ["Conflicting instructions", intent.conflicting ? "Yes" : null],
    ["Ambiguous", intent.ambiguous ? "Yes" : null],
    ["Your rules", plainValue(intent.policyAssessment)],
  ] as [string, string | null][])
    if (value) facts.push([label, value]);
  const messages = d.messages ?? [];

  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header className="grid gap-3">
        <Link href={`${root}/requests`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
          All requests
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className={cn("rounded-md px-2 py-0.5", state.chip)}>{state.label}</span>
          {scope && <span className={cn("rounded-md px-2 py-0.5", scope.chip)}>{scope.label}</span>}
          <span className="text-muted-foreground">
            Asked {relativeTime(d.request.created_at)} · {d.request.clarification_turns}{" "}
            {d.request.clarification_turns === 1 ? "question" : "questions"} asked
          </span>
        </div>
        <h1 className="max-w-[40ch] font-display text-2xl leading-tight font-semibold">{d.request.summary}</h1>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <section className={cn(card, "grid gap-4 p-5")} aria-label="Source messages">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">What was said</h2>
            <Link className={linkChip} href={`${root}/conversation`}>
              <MessagesSquare aria-hidden className="size-4" />
              Full conversation
            </Link>
          </div>
          {messages.length ? (
            <ol className="grid gap-3">
              {messages.map((m) => {
                const fromClient = m.role === "requester" || m.role === "unknown";
                return (
                  <li key={m.id} className={cn("grid max-w-[85%] gap-1", fromClient ? "justify-self-start" : "justify-self-end text-right")}>
                    <span className="px-1 text-xs text-muted-foreground">
                      {m.role === "requester" ? clientName : m.role === "owner" ? "You" : m.role === "assistant" ? "Bridgify" : "Unknown sender"} ·{" "}
                      <time dateTime={m.occurred_at}>{time(m.occurred_at)}</time>
                    </span>
                    <p
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-left whitespace-pre-wrap break-words",
                        fromClient ? "rounded-bl-md bg-sidebar-accent" : "rounded-br-md bg-primary text-primary-foreground",
                      )}
                    >
                      {m.text}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No source messages are linked to this request.</p>
          )}
        </section>

        <aside className="grid gap-5">
          <section className={cn(card, "grid gap-4 p-5")} aria-label="How Bridgify decided">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bot aria-hidden className="size-4" />
              How Bridgify decided
            </h2>
            {facts.length ? (
              <dl className="grid gap-2 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words first-letter:uppercase">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No assessment details were recorded.</p>
            )}
            <div className="grid gap-2 rounded-xl bg-sidebar-accent/70 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Revision: </span>
                {d.usage
                  ? `Used one under scope v${d.usage.scope_version}, policy v${d.usage.policy_version}${d.refund ? ", then refunded" : ""}`
                  : "None used"}
              </p>
              <p className="text-xs text-muted-foreground">
                Model {d.job?.model ?? "not recorded"} · prompt {d.job?.prompt_version ?? "not recorded"}
              </p>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Stored assessment record</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-sidebar-accent/60 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(d.request.intent, null, 2)}
              </pre>
            </details>
          </section>

          {!!d.appliedRules?.length && (
            <section className={cn(card, "grid gap-3 p-5")} aria-label="Applied rules">
              <h2 className="text-sm font-medium text-muted-foreground">What happened</h2>
              <ol className="grid gap-3 border-l border-sidebar-border pl-4">
                {d.appliedRules.map((a, i) => (
                  <li key={i} className="relative text-sm">
                    <span aria-hidden className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                    <p>{activitySentence(a.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {time(a.created_at)}
                      {a.details?.scopeVersion != null && ` · scope v${a.details.scopeVersion}, policy v${a.details.policyVersion ?? "—"}`}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className={cn(card, "grid gap-2 p-5")} aria-label="Related records">
            <h2 className="text-sm font-medium text-muted-foreground">Related</h2>
            <div className="flex flex-wrap gap-2">
              {d.request.task_id && (
                <Link className={linkChip} href={`/app/tasks/${d.request.task_id}`}>
                  <ListChecks aria-hidden className="size-4" />
                  Task
                </Link>
              )}
              {d.decision && (
                <Link
                  className={linkChip}
                  href={`/app/decisions?status=${d.decision.status === "reviewing" ? "open" : d.decision.status}&project=${projectId}&decision=${d.decision.id}`}
                >
                  <Scale aria-hidden className="size-4" />
                  Decision
                </Link>
              )}
              {d.proposals?.map((p) => (
                <Link
                  key={`${p.proposal_id}-${p.revision}`}
                  className={linkChip}
                  href={`${root}/proposals/${p.proposal_id}?revision=${p.revision}`}
                >
                  <FileSignature aria-hidden className="size-4" />
                  Proposal r{p.revision} · {p.status.replaceAll("_", " ")}
                </Link>
              ))}
              <Link className={linkChip} href={`${root}/scope/history`}>
                Scope history
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            {!!d.decision?.history?.length && (
              <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                {d.decision.history.map((h: string, i: number) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
