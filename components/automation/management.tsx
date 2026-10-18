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
      <section className="p-5" role="status">
        {error || "Loading automation records…"}
      </section>
    );
  const disabled = busy || reason.trim().length < 3;
  const accepted = data.automation_requests.filter(
    (r) =>
      r.task_id &&
      !["correction", "cancellation"].includes(r.intent?.intent ?? ""),
  );
  const health = data.automation_runtime_health[0];
  return (
    <div className="grid gap-5">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="grid gap-3 rounded border p-4">
        <h2 className="font-semibold">Revision accounting</h2>
        <p>
          {data.accounting.requestsUsed} individual requests used ·{" "}
          {data.accounting.roundsUsed} rounds used ·{" "}
          {data.project.policy?.allowance ?? 0} included{" "}
          {data.project.policy?.allowance_mode === "manual_rounds"
            ? "rounds"
            : "requests"}
        </p>
        <p className="text-sm">
          Cancellation preserves usage. Refunds are separate owner decisions
          with an audit reason. Closing a feedback round consumes one round.
        </p>
      </section>
      <label className="grid gap-1">
        Reason for your next action (private)
        <input
          className="rounded border p-2"
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Required for edits, retries, refunds and amendments"
        />
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(search).catch((e) => setError(e.message));
        }}
        className="flex gap-2"
      >
        <input
          aria-label="Search tasks and requests"
          className="rounded border p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find an existing task"
        />
        <Button type="submit" variant="outline">
          Search tasks
        </Button>
      </form>
      {data.project.policy?.allowance_mode === "manual_rounds" && (
        <section className="grid gap-3 rounded border p-4">
          <h3 className="font-semibold">Feedback rounds</h3>
          <Button
            disabled={
              disabled || data.automation_rounds.some((r) => r.state === "open")
            }
            onClick={() => act("round_open", {})}
          >
            Open feedback round
          </Button>
          {data.automation_rounds.map((round) => (
            <div key={round.id} className="grid gap-2 border-t pt-3">
              <p>
                {round.title} · {round.state} ·{" "}
                {
                  data.automation_round_members.filter(
                    (m) => m.round_id === round.id,
                  ).length
                }{" "}
                requests
                {data.automation_round_refunds.some(
                  (f) => f.round_id === round.id,
                )
                  ? " · refunded"
                  : ""}
              </p>
              {round.state === "open" ? (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const requestId = new FormData(e.currentTarget).get(
                        "requestId",
                      );
                      act("round_add", { id: round.id, requestId });
                    }}
                  >
                    <select
                      name="requestId"
                      aria-label="Request for round"
                      className="rounded border p-2"
                      required
                    >
                      {accepted
                        .filter(
                          (r) =>
                            !data.automation_round_members.some(
                              (m) => m.request_id === r.id,
                            ),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.summary}
                          </option>
                        ))}
                    </select>
                    <Button
                      disabled={disabled || !accepted.length}
                      type="submit"
                    >
                      Add request to round
                    </Button>
                  </form>
                  <Button
                    disabled={disabled}
                    onClick={() => act("round_close", { id: round.id })}
                  >
                    Close and consume round
                  </Button>
                </>
              ) : (
                <Button
                  disabled={
                    disabled ||
                    data.automation_round_refunds.some(
                      (f) => f.round_id === round.id,
                    )
                  }
                  onClick={() => act("round_refund", { id: round.id })}
                >
                  Refund round
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
      {data.project.policy?.allowance_mode === "per_request" && (
        <section className="grid gap-2 rounded border p-4">
          <h3 className="font-semibold">Explicit request refunds</h3>
          {accepted.length ? (
            accepted.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t py-2"
              >
                <span>{r.summary}</span>
                <Button
                  variant="outline"
                  disabled={
                    disabled ||
                    data.automation_revision_refunds.some(
                      (f) => f.request_id === r.id,
                    )
                  }
                  onClick={() => act("refund_request", { id: r.id })}
                >
                  {data.automation_revision_refunds.some(
                    (f) => f.request_id === r.id,
                  )
                    ? "Refunded"
                    : "Refund included request"}
                </Button>
              </div>
            ))
          ) : (
            <p>No accepted requests in this page of history.</p>
          )}
        </section>
      )}
      {!accountingOnly && (
        <>
          <section className="grid gap-2 rounded border p-4">
            <h2 className="font-semibold">Automation health</h2>
            <p>
              Inbound messages use signed Photon webhooks. Normal replies do not
              wait for a scheduler.
            </p>
            <p>
              {health
                ? `Last processing run: ${new Date(health.started_at).toLocaleString()} · ${health.error_code ? processingErrorLabel(health.error_code) : health.finished_at ? "finished" : "in progress or interrupted"}`
                : "No processing run recorded yet. Verify the deployed webhook setup."}
            </p>
            <p>
              {data.accounting.queued} queued replies ·{" "}
              {data.accounting.failedJobs} failed analyses
            </p>
            {data.accounting.queued > 0 &&
              (!health ||
                Date.parse(data.fetchedAt) - Date.parse(health.started_at) >
                  180000) && (
                <p role="alert">
                  Queued work has not run recently. Check webhook and recovery
                  scheduling.
                </p>
              )}
            <Button
              variant="outline"
              onClick={() =>
                void load(search).catch((e) => setError(e.message))
              }
            >
              Refresh automation records
            </Button>
          </section>
          <details className="rounded border p-4">
            <summary className="cursor-pointer font-semibold">
              Amend saved automation policy · version{" "}
              {data.project.policy_version}
            </summary>
            <p className="my-3 text-sm">
              Your reason and a new policy version are saved. Existing usage
              carries forward; accounting mode cannot change after work is
              accepted.
            </p>
            <AutomationSetup
              key={data.project.version}
              project={data.project}
              bundle={{ scope: data.scope }}
              locked={
                busy ||
                data.project.status === "draft" ||
                reason.trim().length < 3
              }
              saveLabel="Save policy amendment"
              onSave={(policy) =>
                command("amend_policy", {
                  expectedVersion: data.project.version,
                  policy,
                })
              }
            />
          </details>
          <section className="grid gap-3 rounded border p-4">
            <h2 className="font-semibold">
              Client corrections and cancellations
            </h2>
            {data.automation_requests
              .filter(
                (r) =>
                  r.state === "owner_review" &&
                  ["correction", "cancellation"].includes(
                    r.intent?.intent ?? "",
                  ),
              )
              .map((r) => (
                <TaskChange
                  key={r.id}
                  request={r}
                  tasks={data.tasks}
                  disabled={disabled}
                  command={act}
                />
              ))}
            <p className="text-xs">
              Select the existing task and verify the requested change. Applying
              it creates no second task or revision charge.
            </p>
          </section>
          <section className="grid gap-3 rounded border p-4">
            <h2 className="font-semibold">Recent processing</h2>
            {data.automation_jobs.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap justify-between gap-2 border-t py-2"
              >
                <span>
                  {j.state} · {j.attempts} attempts{" "}
                  {j.error_code
                    ? `· ${processingErrorLabel(j.error_code)}`
                    : ""}
                </span>
                {j.state === "failed" && (
                  <Button
                    variant="outline"
                    disabled={disabled || (j.owner_retries ?? 0) >= 3}
                    onClick={() => act("retry_analysis", { id: j.id })}
                  >
                    Retry failed analysis
                  </Button>
                )}
              </div>
            ))}
          </section>
          <section className="grid gap-3 rounded border p-4">
            <h2 className="font-semibold">Reply outbox</h2>
            <p className="text-sm">
              Edit or cancel queued replies. For an uncertain send, check the
              conversation before explicitly retrying. Use a provider message ID
              from conversation details to reconcile an actual successful
              receipt.
            </p>
            {data.automation_outbox.map((o) => (
              <ReplyControls
                key={`${o.id}:${o.updated_at}`}
                row={o}
                disabled={disabled}
                busy={busy}
                command={act}
              />
            ))}
            {!data.automation_outbox.length && <p>No replies queued yet.</p>}
          </section>
        </>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={busy || !(data.page ?? 0)}
          onClick={() =>
            void load(search, (data.page ?? 0) - 1).catch((e) =>
              setError(e.message),
            )
          }
        >
          Newer history
        </Button>
        <span>Page {(data.page ?? 0) + 1}</span>
        <Button
          variant="outline"
          disabled={
            busy ||
            ![
              data.automation_jobs,
              data.automation_requests,
              data.automation_outbox,
            ].some((rows) => rows.length === 100)
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
      <p className="text-xs text-muted-foreground">
        Showing up to 100 records per history page. Task search returns up to 50
        matches. Accounting totals include all project history.
      </p>
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
  return (
    <div className="grid gap-2 border-t py-3">
      <p>
        {row.state} · {new Date(row.created_at).toLocaleString()}
      </p>
      {row.state === "queued" ? (
        <>
          <textarea
            aria-label="Queued reply text"
            className="rounded border p-2"
            maxLength={8000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={disabled || !text.trim()}
              onClick={() => command("outbox_edit", { ...payload, text })}
            >
              Save reply
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => command("outbox_cancel", payload)}
            >
              Cancel queued reply
            </Button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap">{row.text}</p>
      )}
      {["unknown", "failed"].includes(row.state) && (
        <>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I checked with the client and confirmed this reply was not delivered
          </label>
          <Button
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
          <div className="flex gap-2">
            <input
              aria-label="Provider message ID"
              className="rounded border p-2"
              placeholder="Actual provider message ID"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
            <Button
              variant="outline"
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
  return (
    <div className="grid gap-2 border-t py-3">
      <p>{request.summary}</p>
      <select
        aria-label="Existing task to change"
        className="rounded border p-2"
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
        <>
          <label>
            Corrected task title
            <input
              className="block rounded border p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            Updated text or color (leave blank to keep the current value)
            <input
              className="block rounded border p-2"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={4000}
            />
          </label>
        </>
      )}
      <Button
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
