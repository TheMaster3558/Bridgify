"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AutomationSetup } from "@/components/setup/automation-setup";
import type { Bundle, Project } from "@/lib/domain/types";
import { processingErrorLabel } from "@/lib/assistant/processing-errors";
type Row = {
  id: string;
  state: string;
  text?: string;
  summary?: string;
  title?: string;
  updated_at: string;
  created_at: string;
  error_code?: string;
  attempts?: number;
  owner_retries?: number;
  task_id?: string;
  intent?: {
    intent: string;
    taskId?: string;
    payload?: { color?: string; replacementText?: string };
  };
};
type Task = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  value: string | null;
};
type Data = {
  page?: number;
  scope: Bundle["scope"];
  fetchedAt: string;
  project: Project;
  tasks: Task[];
  accounting: {
    requestsUsed: number;
    roundsUsed: number;
    queued: number;
    failedJobs: number;
  };
  automation_outbox: Row[];
  automation_jobs: Row[];
  automation_requests: Row[];
  automation_rounds: Row[];
  roundCounts?:Record<string,number>;
  automation_round_members: { request_id: string; round_id: string }[];
  automation_revision_refunds: { request_id: string }[];
  automation_round_refunds: { round_id: string }[];
  automation_runtime_health: {
    started_at: string;
    finished_at: string | null;
    error_code: string | null;
  }[];
};
type Command = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<void>;
export function AutomationManagement({
  projectId,
  accountingOnly = false,
}: {
  projectId: string;
  accountingOnly?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const load = useCallback(
    async (q = "", page = 0) => {
      const r = await fetch(
        `/api/v1/projects/${projectId}/automation?q=${encodeURIComponent(q)}&page=${page}`,
        { cache: "no-store" },
      );
      const v = await r.json();
      if (!r.ok)
        throw new Error(v.error?.message ?? "Automation records unavailable");
      setData(v.data);
    },
    [projectId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/v1/projects/${projectId}/automation`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const v = await r.json();
        if (!r.ok)
          throw new Error(v.error?.message ?? "Automation records unavailable");
        return v.data as Data;
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [projectId]);
  const command: Command = async (action, payload) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/automation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          action,
          payload:
            action === "outbox_reconcile" ? payload : { ...payload, reason },
        }),
      });
      const v = await r.json();
      if (!r.ok)
        throw new Error(v.error?.message ?? "Action could not be saved");
      await load(search, data?.page ?? 0);
      setNotice(
        "Saved to the project. Any queued reply is submitted through Photon.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const act = (action: string, payload: Record<string, unknown>) => {
    void command(action, payload).catch(() => {});
  };
  if (!data)
    return (
      <section
        className="grid gap-3 rounded-2xl border border-sidebar-border bg-card p-5"
        role="status"
      >
        {error ? (
          <p className="text-sm text-crit">{error}</p>
        ) : (
          <>
            <span className="sr-only">Loading automation records…</span>
            <span aria-hidden className="h-4 w-40 animate-pulse rounded-full bg-sidebar-accent motion-reduce:animate-none" />
            <span aria-hidden className="h-3 w-72 animate-pulse rounded-full bg-sidebar-accent motion-reduce:animate-none" />
          </>
        )}
      </section>
    );
  const disabled = busy || reason.trim().length < 3;
  const accepted = data.automation_requests.filter(
    (r) =>
      r.task_id &&
      !["correction", "cancellation"].includes(r.intent?.intent ?? ""),
  );
  const health = data.automation_runtime_health[0];
  const changes = data.automation_requests.filter(
    (r) =>
      r.state === "owner_review" &&
      ["correction", "cancellation"].includes(r.intent?.intent ?? ""),
  );
  const failedJobs = data.automation_jobs.filter((j) => j.state === "failed");
  const stale =
    data.accounting.queued > 0 &&
    (!health ||
      Date.parse(data.fetchedAt) - Date.parse(health.started_at) > 180000);
  const p = data.project;
  const mode =
    p.status === "paused"
      ? { label: "Automation is paused", note: "Messages are logged, but nothing is accepted or sent automatically.", dot: "bg-warn", tone: "bg-warn-soft text-warn" }
      : p.policy?.mode === "review_only" || p.status === "review_only"
        ? { label: "Review-only mode", note: "Bridgify reads every message and sends each request to you before anything is accepted.", dot: "bg-info", tone: "bg-info-soft text-info" }
        : p.status === "active" && p.policy?.mode === "enabled"
          ? { label: "Automation is on", note: "Routine requests within your rules are accepted and answered in the chat.", dot: "bg-ok", tone: "bg-ok-soft text-ok" }
          : { label: "Automation is not active", note: "Finish setup and activate the project to start processing messages.", dot: "bg-neutral-400", tone: "bg-sidebar-accent text-muted-foreground" };
  const card = "rounded-2xl border border-sidebar-border bg-card";
  const field =
    "rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
  const sectionTitle = "flex items-center justify-between gap-3 text-sm font-medium text-muted-foreground";
  const refresh = () => void load(search).catch((e) => setError(e.message));

  const reasonBar = (
    <section className={`${card} grid gap-2 p-4`}>
      <label className="grid gap-1.5 text-sm font-medium">
        Reason for your next action (private)
        <input
          className={field}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Required for edits, retries, refunds and amendments"
        />
      </label>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden className={`size-2 rounded-full ${reason.trim().length >= 3 ? "bg-ok" : "bg-neutral-400"}`} />
        {reason.trim().length >= 3
          ? "Actions are unlocked. Your reason is saved with each change and never shown to the client."
          : "Write a short reason (3+ characters) to unlock the actions below."}
      </p>
    </section>
  );
  const taskSearch = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        refresh();
      }}
      className="flex flex-wrap gap-2"
    >
      <input
        aria-label="Search tasks and requests"
        className={`${field} w-64`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find an existing task"
      />
      <Button type="submit" variant="outline" className="rounded-full">
        Search tasks
      </Button>
    </form>
  );
  const pager = (
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <p>
        Showing up to 100 records per history page. Task search returns up to 50
        matches. Accounting totals include all project history.
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={busy || !(data.page ?? 0)}
          onClick={() =>
            void load(search, (data.page ?? 0) - 1).catch((e) =>
              setError(e.message),
            )
          }
        >
          Newer history
        </Button>
        <span className="tabular-nums">Page {(data.page ?? 0) + 1}</span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={
            busy ||
            ![
              data.automation_jobs,
              data.automation_requests,
              data.automation_outbox,
              data.automation_rounds,
            ].some((rows) => rows.length >= 100)
          }
          onClick={() =>
            void load(search, (data.page ?? 0) + 1).catch((e) =>
              setError(e.message),
            )
          }
        >
          Older history
        </Button>
      </div>
    </footer>
  );
  const messages = (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-crit-soft px-4 py-3 text-sm text-crit">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      )}
    </>
  );

  if (accountingOnly)
    return (
      <div className="grid gap-4">
        {messages}
        <p className="text-sm text-muted-foreground">
          {data.accounting.requestsUsed} individual requests used ·{" "}
          {data.accounting.roundsUsed} rounds used ·{" "}
          {p.policy?.allowance ?? 0} included{" "}
          {p.policy?.allowance_mode === "manual_rounds" ? "rounds" : "requests"}.
          Cancellation preserves usage. Refunds are separate owner decisions
          with an audit reason. Closing a feedback round consumes one round.
        </p>
        {reasonBar}
        {taskSearch}
        {p.policy?.allowance_mode === "manual_rounds" && (
          <section className={`${card} grid gap-3 p-5`}>
            <div className={sectionTitle}>
              <h3 className="text-base font-semibold text-foreground">Feedback rounds</h3>
              <Button
                className="rounded-full"
                disabled={
                  disabled || data.automation_rounds.some((r) => r.state === "open")
                }
                onClick={() => act("round_open", {})}
              >
                Open feedback round
              </Button>
            </div>
            {!data.automation_rounds.length && (
              <p className="text-sm text-muted-foreground">No feedback rounds yet.</p>
            )}
            {data.automation_rounds.map((round) => {
              const refunded = data.automation_round_refunds.some((f) => f.round_id === round.id);
              return (
                <div key={round.id} className="grid gap-3 rounded-xl bg-sidebar-accent/50 p-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{round.title}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${round.state === "open" ? "bg-ok-soft text-ok" : "bg-card text-muted-foreground"}`}>
                      {round.state}
                    </span>
                    <span className="text-muted-foreground">
                      {data.roundCounts?.[round.id] ??
                        data.automation_round_members.filter((m) => m.round_id === round.id).length}{" "}
                      requests{refunded ? " · refunded" : ""}
                    </span>
                  </p>
                  {round.state === "open" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const requestId = new FormData(e.currentTarget).get("requestId");
                          act("round_add", { id: round.id, requestId });
                        }}
                      >
                        <select name="requestId" aria-label="Request for round" className={field} required>
                          {accepted
                            .filter((r) => !data.automation_round_members.some((m) => m.request_id === r.id))
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.summary}
                              </option>
                            ))}
                        </select>
                        <Button className="rounded-full" disabled={disabled || !accepted.length} type="submit">
                          Add request to round
                        </Button>
                      </form>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        disabled={disabled}
                        onClick={() => act("round_close", { id: round.id })}
                      >
                        Close and consume round
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-fit rounded-full"
                      disabled={disabled || refunded}
                      onClick={() => act("round_refund", { id: round.id })}
                    >
                      Refund round
                    </Button>
                  )}
                </div>
              );
            })}
          </section>
        )}
        {p.policy?.allowance_mode === "per_request" && (
          <section className={`${card} grid gap-1 p-5`}>
            <h3 className="mb-2 text-base font-semibold">Explicit request refunds</h3>
            {accepted.length ? (
              accepted.map((r) => {
                const refunded = data.automation_revision_refunds.some((f) => f.request_id === r.id);
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-border py-3 first:border-t-0"
                  >
                    <span className="text-sm">{r.summary}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={disabled || refunded}
                      onClick={() => act("refund_request", { id: r.id })}
                    >
                      {refunded ? "Refunded" : "Refund included request"}
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No accepted requests in this page of history.</p>
            )}
          </section>
        )}
        {pager}
      </div>
    );

  const needsAction = changes.length + failedJobs.length + data.automation_outbox.length;
  return (
    <div className="grid gap-5">
      {messages}
      <section className={`${card} grid gap-5 p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center`} aria-label="Automation health">
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${mode.tone}`}>
            <span aria-hidden className={`size-3 rounded-full ${mode.dot} ${p.status === "active" && p.policy?.mode === "enabled" ? "animate-pulse motion-reduce:animate-none" : ""}`} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold">{mode.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{mode.note}</p>
            <p className="mt-2 text-sm">
              {health
                ? `Last processing run: ${new Date(health.started_at).toLocaleString()} · ${health.error_code ? processingErrorLabel(health.error_code) : health.finished_at ? "finished" : "in progress or interrupted"}`
                : "No processing run recorded yet. Verify the deployed webhook setup."}
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["Queued replies", data.accounting.queued, data.accounting.queued ? "text-foreground" : "text-muted-foreground"],
              ["Failed analyses", data.accounting.failedJobs, data.accounting.failedJobs ? "text-crit" : "text-muted-foreground"],
              ["Policy", `v${p.policy_version}`, "text-foreground"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-xl bg-sidebar-accent/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={`font-display text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Inbound messages use signed Photon webhooks. Normal replies do not
              wait for a scheduler.
            </p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={refresh}>
              Refresh automation records
            </Button>
          </div>
        </div>
        {stale && (
          <p role="alert" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn md:col-span-2">
            Queued work has not run recently. Check webhook and recovery
            scheduling.
          </p>
        )}
      </section>

      {reasonBar}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="grid gap-5">
          <section className="grid gap-3" aria-label="Needs your action">
            <h2 className={sectionTitle}>
              Needs your action
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${needsAction ? "bg-warn text-white" : "bg-sidebar-accent"}`}>{needsAction}</span>
            </h2>
            {!needsAction && (
              <p className="rounded-2xl border border-dashed border-sidebar-border bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground">
                Nothing to fix. Queued replies, client corrections and failed analyses show up here.
              </p>
            )}
            {changes.length > 0 && (
              <section className={`${card} grid gap-3 p-5`}>
                <h3 className="font-semibold">Client corrections and cancellations</h3>
                {taskSearch}
                {changes.map((r) => (
                  <TaskChange key={r.id} request={r} tasks={data.tasks} disabled={disabled} command={act} />
                ))}
                <p className="text-xs text-muted-foreground">
                  Select the existing task and verify the requested change. Applying
                  it creates no second task or revision charge.
                </p>
              </section>
            )}
            {data.automation_outbox.length > 0 && (
              <section className={`${card} grid gap-3 p-5`}>
                <h3 className="font-semibold">Reply outbox</h3>
                <p className="text-sm text-muted-foreground">
                  Edit or cancel queued replies. For an uncertain send, check the
                  conversation before explicitly retrying. Use a provider message ID
                  from conversation details to reconcile an actual successful
                  receipt.
                </p>
                {data.automation_outbox.map((o) => (
                  <ReplyControls key={`${o.id}:${o.updated_at}`} row={o} disabled={disabled} busy={busy} command={act} />
                ))}
              </section>
            )}
            {failedJobs.length > 0 && (
              <section className={`${card} grid gap-1 p-5`}>
                <h3 className="mb-2 font-semibold">Failed analyses</h3>
                {failedJobs.map((j) => (
                  <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-border py-3 first:border-t-0">
                    <span className="text-sm">
                      {j.error_code ? processingErrorLabel(j.error_code) : "Analysis failed"}
                      <span className="text-muted-foreground"> · {j.attempts} attempts</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={disabled || (j.owner_retries ?? 0) >= 3}
                      onClick={() => act("retry_analysis", { id: j.id })}
                    >
                      Retry failed analysis
                    </Button>
                  </div>
                ))}
              </section>
            )}
          </section>
        </div>

        <div className="grid gap-5">
          <details className={`${card} group p-5`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
              <span>
                Amend saved automation policy · version{" "}
                {p.policy_version}
              </span>
              <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              Your reason and a new policy version are saved. Existing usage
              carries forward; accounting mode cannot change after work is
              accepted.
            </p>
            <AutomationSetup
              key={p.version}
              project={p}
              bundle={{ scope: data.scope }}
              locked={busy || p.status === "draft" || reason.trim().length < 3}
              saveLabel="Save policy amendment"
              onSave={(policy) =>
                command("amend_policy", {
                  expectedVersion: p.version,
                  policy,
                })
              }
            />
          </details>
          <section className={`${card} grid gap-2 p-5`} aria-label="Recent processing">
            <h2 className="font-semibold">Recent processing</h2>
            {data.automation_jobs.length ? (
              <ol className="grid">
                {data.automation_jobs.slice(0, 12).map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 border-t border-sidebar-border py-2 text-sm first:border-t-0">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${j.state === "failed" ? "bg-crit" : j.state === "done" || j.state === "completed" ? "bg-ok" : "bg-info"}`}
                      />
                      <span className="capitalize">{j.state.replaceAll("_", " ")}</span>
                      {j.error_code && <span className="text-muted-foreground">· {processingErrorLabel(j.error_code)}</span>}
                    </span>
                    <time className="text-xs text-muted-foreground tabular-nums" dateTime={j.created_at}>
                      {new Date(j.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No messages processed yet.</p>
            )}
          </section>
        </div>
      </div>
      {pager}
    </div>
  );
}
function ReplyControls({
  row,
  disabled,
  busy,
  command,
}: {
  row: Row;
  disabled: boolean;
  busy: boolean;
  command: (a: string, p: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(row.text ?? ""),
    [receipt, setReceipt] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const payload = { id: row.id, expectedUpdatedAt: row.updated_at };
  const field =
    "rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
  const tone =
    row.state === "queued"
      ? "bg-info-soft text-info"
      : ["unknown", "failed"].includes(row.state)
        ? "bg-crit-soft text-crit"
        : "bg-sidebar-accent text-muted-foreground";
  return (
    <div className="grid gap-3 rounded-xl bg-sidebar-accent/40 p-4">
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-md px-2 py-0.5 font-medium capitalize ${tone}`}>{row.state}</span>
        <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
      </p>
      {row.state === "queued" ? (
        <>
          <textarea
            aria-label="Queued reply text"
            className={`${field} min-h-24`}
            maxLength={8000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={disabled || !text.trim()}
              onClick={() => command("outbox_edit", { ...payload, text })}
            >
              Save reply
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={disabled}
              onClick={() => command("outbox_cancel", payload)}
            >
              Cancel queued reply
            </Button>
          </div>
        </>
      ) : (
        <p className="w-fit max-w-[60ch] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
          {row.text}
        </p>
      )}
      {["unknown", "failed"].includes(row.state) && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I checked with the client and confirmed this reply was not delivered
          </label>
          <Button
            className="w-fit rounded-full"
            disabled={disabled || !confirmed}
            onClick={() =>
              command("outbox_retry", {
                ...payload,
                confirmedNotDelivered: confirmed,
              })
            }
          >
            Queue an explicit retry
          </Button>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Provider message ID"
              className={field}
              placeholder="Actual provider message ID"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
            <Button
              variant="outline"
              className="rounded-full"
              disabled={busy || !receipt.trim()}
              onClick={() =>
                command("outbox_reconcile", {
                  id: row.id,
                  providerMessageId: receipt.trim(),
                })
              }
            >
              Verify provider receipt
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
function TaskChange({
  request,
  tasks,
  disabled,
  command,
}: {
  request: Row;
  tasks: Task[];
  disabled: boolean;
  command: (a: string, p: Record<string, unknown>) => void;
}) {
  const [taskId, setTaskId] = useState(request.intent?.taskId ?? ""),
    [title, setTitle] = useState(request.summary ?? ""),
    [value, setValue] = useState(
      request.intent?.payload?.replacementText ??
        request.intent?.payload?.color ??
        "",
    );
  const target = tasks.find((t) => t.id === taskId);
  const field =
    "rounded-xl border border-sidebar-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
  return (
    <div className="grid gap-3 rounded-xl bg-sidebar-accent/40 p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
          {request.intent?.intent === "cancellation" ? "Cancellation" : "Correction"}
        </span>
        {request.summary}
      </p>
      <select
        aria-label="Existing task to change"
        className={field}
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      >
        <option value="">Choose the existing task</option>
        {tasks
          .filter((t) => !["done", "cancelled"].includes(t.status))
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
      </select>
      {request.intent?.intent === "correction" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Corrected task title
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Updated text or color (leave blank to keep the current value)
            <input
              className={field}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={4000}
            />
          </label>
        </div>
      )}
      <Button
        className="w-fit rounded-full"
        disabled={
          disabled ||
          !target ||
          (request.intent?.intent === "correction" && title.trim().length < 3)
        }
        onClick={() =>
          command("apply_task_change", {
            requestId: request.id,
            taskId,
            expectedUpdatedAt: target?.updated_at,
            title,
            value,
          })
        }
      >
        {request.intent?.intent === "cancellation"
          ? "Cancel existing task"
          : "Apply correction to existing task"}
      </Button>
    </div>
  );
}
