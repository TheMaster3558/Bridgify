import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Database, Sql } from "../db/postgres";
import {
  normalizedEventSchema,
  type DecisionReason,
  type NormalizedEvent,
} from "./contracts";
import { IntakeError } from "./intake-error";
import type { InboxWriter } from "./intake";
import { peopleSchema, policySchema } from "../schemas/onboarding";
import {
  validateInterpretation,
  type Interpretation,
  type InterpretationContext,
} from "../ai/interpret-messages";
import type { PhotonSendResult } from "../photon/spectrum";

type Job = {
  id: string;
  project_id: string;
  event_id: string;
  message_id: string | null;
  review_reason: DecisionReason | null;
  attempts: number;
  lease_token: string;
};
type Intent = Interpretation["intents"][number];
type Request = {
  id: string;
  revision: number;
  summary: string;
  intent: Intent;
  source_ids: string[];
  clarification_turns: number;
};
type Project = {
  id: string;
  version: number;
  status: string;
  scope_version: number;
  policy_version: number;
  policy: unknown;
  people: unknown;
  activation_cutoff: string | null;
  disclosure_at: string | null;
  agreed_due_date: string | null;
  hold_reason: string | null;
  instance_id: string;
  chat_guid: string;
  verified_at: string | null;
  test_state: string;
  disclosed_message_guid: string | null;
};
type Snapshot = {
  project: Project;
  context: InterpretationContext;
  pending: Request[];
  watermark: string;
};
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const code = (prefix: string, id: string) =>
  `${prefix}-${id.replaceAll("-", "").slice(0, 12)}`;
const isOpen = (p: Project) => {
  const people = peopleSchema.safeParse(p.people);
  return (
    people.success &&
    people.data.instance_id === p.instance_id &&
    people.data.chat_guid === p.chat_guid &&
    ["active", "review_only"].includes(p.status) &&
    !!p.activation_cutoff &&
    !!p.disclosure_at &&
    !!p.verified_at &&
    p.test_state === "sent" &&
    !!p.disclosed_message_guid &&
    !p.hold_reason
  );
};

/** The same schema and binding created by the owner wizard authorize intake. */
export function createProjectAutomationInbox(database: Database): InboxWriter {
  return {
    async persistVerifiedEvent(input: NormalizedEvent) {
      const event = normalizedEventSchema.parse(input);
      return database.transaction(async (sql) => {
        await sql.query(
          "select pg_advisory_xact_lock(hashtextextended($1,0))",
          [JSON.stringify([event.instanceId, event.chatGuid])],
        );
        const fingerprint = hash({ ...event, eventKey: undefined });
        const prior = (
          await sql.query<{ id: string; fingerprint: string }>(
            "select id,fingerprint from automation_events where instance_id=$1 and event_key=$2",
            [event.instanceId, event.eventKey],
          )
        ).rows[0];
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new IntakeError("provider_event_identity_conflict", 409);
          return { inboxEventId: prior.id, duplicate: true };
        }
        const project = (
          await sql.query<Project>(
            `select p.*,b.instance_id,b.chat_guid,b.hold_reason,b.verified_at,b.test_state,b.disclosed_message_guid
        from projects p join chat_bindings b on b.project_id=p.id
        where b.instance_id=$1 and b.chat_guid=$2 for update of p,b`,
            [event.instanceId, event.chatGuid],
          )
        ).rows[0];
        const people = peopleSchema.safeParse(project?.people);
        let disposition = "unlinked_chat";
        let role = "unknown";
        if (project && people.success) {
          role = event.fromBot
            ? "assistant"
            : event.direction === "outbound"
              ? "owner"
              : event.senderId === people.data.client_sender_id
                ? "requester"
                : "unknown";
          const at = event.occurredAt ? Date.parse(event.occurredAt) : NaN;
          if (role === "assistant" || role === "owner")
            disposition = "outbound_context";
          else if (
            !["active", "review_only", "paused"].includes(project.status)
          )
            disposition = "inactive_project";
          else if (!Number.isFinite(at)) disposition = "missing_timestamp";
          else if (
            !project.activation_cutoff ||
            at < new Date(project.activation_cutoff).getTime()
          )
            disposition = "before_activation";
          else if (at > Date.now() + 300_000) disposition = "future_timestamp";
          else if (event.kind === "membership")
            disposition = "membership_review";
          else if (role === "unknown") disposition = "unknown_participant";
          else if (event.kind !== "message") disposition = "mutation_review";
          else if (
            !event.text?.trim() ||
            (event.contentType && event.contentType !== "text")
          )
            disposition = "unsupported_input";
          else if (!isOpen(project)) disposition = "policy_denied";
          else disposition = "pending_analysis";
        }
        const eventId = randomUUID();
        await sql.query(
          `insert into automation_events(id,project_id,instance_id,event_key,fingerprint,event,disposition)
        values($1,$2,$3,$4,$5,$6,$7)`,
          [
            eventId,
            project?.id ?? null,
            event.instanceId,
            event.eventKey,
            fingerprint,
            JSON.stringify(event),
            disposition,
          ],
        );
        if (!project || disposition === "unlinked_chat")
          return { inboxEventId: eventId, duplicate: false };
        if (event.kind === "membership")
          await sql.query(
            "update chat_bindings set hold_reason='Membership changed; verify client identity before resuming automation.' where project_id=$1",
            [project.id],
          );
        if (disposition === "mutation_review") {
          await sql.query(
            `update automation_jobs set state='failed',error_code='source_changed',lease_token=null,lease_until=null
          where project_id=$1 and message_id in(select id from automation_messages where project_id=$1 and provider_guid=$2)
          and state in ('queued','running')`,
            [project.id, event.messageGuid],
          );
          await sql.query(
            `update automation_outbox set state='cancelled' where state='queued' and job_id in
          (select id from automation_jobs where project_id=$1 and message_id in
            (select id from automation_messages where project_id=$1 and provider_guid=$2))`,
            [project.id, event.messageGuid],
          );
        }
        let messageId: string | null = null;
        if (["pending_analysis", "outbound_context"].includes(disposition)) {
          // Message identity deduplicates webhook delivery and authenticated history sync.
          const saved = await sql.query<{ id: string }>(
            `insert into automation_messages(project_id,event_id,provider_guid,role,text,occurred_at)
          values($1,$2,$3,$4,$5,$6) on conflict(project_id,provider_guid) do nothing returning id`,
            [
              project.id,
              eventId,
              event.messageGuid,
              role,
              event.text ?? "",
              event.occurredAt ?? new Date().toISOString(),
            ],
          );
          messageId = saved.rows[0]?.id ?? null;
          if (!messageId) return { inboxEventId: eventId, duplicate: true };
        }
        const reviewReason: DecisionReason | null =
          disposition === "unknown_participant" ||
          disposition === "membership_review"
            ? "unknown_participant"
            : disposition === "mutation_review"
              ? "conflicting_request"
              : [
                    "missing_timestamp",
                    "future_timestamp",
                    "unsupported_input",
                  ].includes(disposition)
                ? "unsupported_input"
                : disposition === "policy_denied"
                  ? "policy_denied"
                  : null;
        if (disposition === "pending_analysis" || reviewReason)
          await sql.query(
            `insert into automation_jobs(project_id,event_id,message_id,review_reason)
        values($1,$2,$3,$4)`,
            [project.id, eventId, messageId, reviewReason],
          );
        return { inboxEventId: eventId, duplicate: false };
      });
    },
  };
}

async function loadSnapshot(sql: Sql, job: Job): Promise<Snapshot> {
  const project = (
    await sql.query<Project>(
      `select p.*,b.instance_id,b.chat_guid,b.hold_reason,b.verified_at,b.test_state,b.disclosed_message_guid
    from projects p join chat_bindings b on b.project_id=p.id where p.id=$1`,
      [job.project_id],
    )
  ).rows[0];
  if (!project) throw new Error("project_unavailable");
  const policy = policySchema.parse(project.policy);
  const scope = (
    await sql.query<{ terms: Array<{ kind: string; text: string }> }>(
      "select terms from scope_versions where project_id=$1 and version=$2",
      [project.id, project.scope_version],
    )
  ).rows[0];
  if (!scope) throw new Error("confirmed_scope_unavailable");
  const messages = (
    await sql.query<{
      id: string;
      text: string;
      role: "requester" | "owner" | "assistant";
    }>(
      `select id,text,role from (
    select id,text,role,created_at from automation_messages where project_id=$1 and role<>'unknown'
      and created_at <= (select created_at from automation_messages where id=$2)
    order by created_at desc,id desc limit 20) m order by created_at,id`,
      [project.id, job.message_id],
    )
  ).rows;
  const pending = (
    await sql.query<Request>(
      `select id,revision,summary,intent,source_ids,clarification_turns from automation_requests
    where project_id=$1 and state='awaiting_details' order by created_at limit 11`,
      [project.id],
    )
  ).rows;
  const tasks = (
    await sql.query<{
      id: string;
      title: string;
      status: InterpretationContext["tasks"][number]["status"];
    }>(
      "select id,title,status from project_tasks where project_id=$1 order by updated_at desc,id limit 20",
      [project.id],
    )
  ).rows;
  const watermark = hash({ project, pending, tasks, scope, messages });
  return {
    project,
    pending,
    watermark,
    context: {
      projectId: project.id,
      scopeVersion: project.scope_version,
      policyVersion: project.policy_version,
      inputWatermark: watermark,
      policyExclusions: policy.exclusions,
      messages: messages.map((m) => ({
        revisionId: m.id,
        text: m.text,
        role: m.role,
      })),
      scope: scope.terms.flatMap((t, i) =>
        t.kind === "inclusion" || t.kind === "exclusion"
          ? [{ id: `scope-${i}`, kind: t.kind, text: t.text }]
          : [],
      ),
      targets: policy.targets.map((id) => ({
        id,
        description: id,
        operations: policy.operations,
      })),
      unresolvedRequests: pending.slice(0, 10).map((r) => ({
        id: r.id,
        revision: r.revision,
        summary: JSON.stringify({
          summary: r.summary,
          operation: r.intent.operation,
          targetId: r.intent.targetId,
          payload: r.intent.payload,
          missingFields: r.intent.missingFields,
        }).slice(0, 1000),
      })),
      tasks,
    },
  };
}

async function createDecision(
  sql: Sql,
  input: {
    projectId: string;
    id: string;
    summary: string;
    reason: DecisionReason;
    source: string;
    evidence?: string;
    missing?: string[];
    reply?: string;
  },
) {
  const id = randomUUID();
  await sql.query(
    `insert into owner_decisions(id,project_id,decision_code,request_code,reason,title,source_text,
    source_meta,evidence,evidence_source,explanation,missing_details,suggested_options,reply_preview,history)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,'Confirmed project agreement',$10,$11,$12,$13,$14)
    on conflict(project_id,decision_code) do update set updated_at=now() returning id`,
    [
      id,
      input.projectId,
      code("DEC", input.id),
      code("REQ", input.id),
      input.reason,
      input.summary.slice(0, 500),
      input.source,
      `Request ${code("REQ", input.id)}`,
      input.evidence ?? "",
      `Owner review required: ${input.reason.replaceAll("_", " ")}.`,
      JSON.stringify(input.missing ?? []),
      JSON.stringify([
        {
          title: "Review request",
          description:
            "Check the agreement and source before authorizing work.",
        },
      ]),
      input.reply ?? "",
      JSON.stringify(["Queued automatically for owner review."]),
    ],
  );
  return (
    await sql.query<{ id: string }>(
      "select id from owner_decisions where project_id=$1 and decision_code=$2",
      [input.projectId, code("DEC", input.id)],
    )
  ).rows[0].id;
}

async function queueReply(sql: Sql, job: Job, p: Project, parts: string[]) {
  if (!parts.length || !isOpen(p)) return;
  const people = peopleSchema.parse(p.people);
  await sql.query(
    `insert into automation_outbox(project_id,job_id,instance_id,chat_guid,address,text)
    values($1,$2,$3,$4,$5,$6) on conflict(job_id,purpose) do nothing`,
    [
      p.id,
      job.id,
      p.instance_id,
      p.chat_guid,
      people.client_sender_id,
      parts.join("\n\n"),
    ],
  );
}

const fields = {
  target: "the page or element to change",
  replacement_text: "the exact replacement text",
  locator: "the existing text to replace",
  color: "the requested color",
};

async function applyAnalysis(
  sql: Sql,
  job: Job,
  snapshot: Snapshot,
  analysis: Interpretation,
) {
  const p = snapshot.project;
  const policy = policySchema.parse(p.policy);
  const replies: string[] = [];
  // Independent intents may not consume the same clarification request twice.
  const linked = new Set<string>();
  for (const [ordinal, intent] of analysis.intents.entries()) {
    if (intent.intent === "casual") continue;
    if (!intent.sources.some((s) => s.revisionId === job.message_id))
      throw new Error("latest_source_required");
    if (
      intent.intent === "status_question" &&
      !intent.ambiguous &&
      !intent.conflicting &&
      !intent.requestsNewDeadline
    ) {
      if (policy.replies.status_questions) {
        const task = snapshot.context.tasks.find((t) => t.id === intent.taskId);
        const statuses = {
          ready: "queued",
          in_progress: "in progress",
          blocked: "blocked",
          done: "completed",
          cancelled: "cancelled",
        };
        replies.push(
          task
            ? `${task.title.slice(0, 160)}: ${statuses[task.status]}.`
            : "I couldn't identify a matching task. Which task are you asking about?",
        );
      }
      continue;
    }
    const previous =
      intent.intent === "clarification_answer" &&
      !linked.has(intent.existingRequestId ?? "")
        ? snapshot.pending.find((r) => r.id === intent.existingRequestId)
        : undefined;
    const id = previous?.id ?? randomUUID();
    let reason: DecisionReason | null = null;
    if (
      intent.ambiguous ||
      (intent.intent === "clarification_answer" &&
        (!previous || snapshot.pending.length > 10 || linked.has(id)))
    )
      reason = "ambiguous_request";
    if (previous) linked.add(id);
    const sourceIds = [
      ...new Set([
        ...(previous?.source_ids ?? []),
        ...intent.sources.map((s) => s.revisionId),
      ]),
    ];
    if (previous) {
      await sql.query(
        `update automation_requests set revision=revision+1,summary=$2,intent=$3,source_ids=$4,updated_at=now() where id=$1`,
        [id, intent.summary, JSON.stringify(intent), JSON.stringify(sourceIds)],
      );
    } else
      await sql.query(
        `insert into automation_requests(id,project_id,job_id,ordinal,state,summary,intent,source_ids)
      values($1,$2,$3,$4,'owner_review',$5,$6,$7)`,
        [
          id,
          p.id,
          job.id,
          ordinal,
          intent.summary,
          JSON.stringify(intent),
          JSON.stringify(sourceIds),
        ],
      );
    if (!isOpen(p)) reason = "policy_denied";
    else if (intent.requestsNewDeadline) reason = "deadline_change";
    else if (
      intent.conflicting ||
      ["correction", "cancellation", "dispute"].includes(intent.intent)
    )
      reason = "conflicting_request";
    else if (intent.intent === "unsupported") reason = "unsupported_input";
    else if (!reason && intent.scopeAssessment === "excluded")
      reason = "scope_addition";
    else if (!reason && intent.violatesPolicyExclusions !== false)
      reason = "policy_denied";
    else if (!reason && intent.scopeAssessment !== "included")
      reason = "scope_addition";
    else if (
      !reason &&
      intent.scopeEvidence.some(
        (e) =>
          snapshot.context.scope.find((s) => s.id === e.scopeItemId)?.kind ===
          "exclusion",
      )
    )
      reason = "scope_addition";
    else if (
      !reason &&
      !intent.scopeEvidence.some(
        (e) =>
          snapshot.context.scope.find((s) => s.id === e.scopeItemId)?.kind ===
          "inclusion",
      )
    )
      reason = "scope_addition";
    if (!reason && intent.missingFields.length) {
      if (
        !policy.replies.clarifications ||
        (previous?.clarification_turns ?? 0) >= 2
      )
        reason = "ambiguous_request";
      else {
        await sql.query(
          `update automation_requests set state='awaiting_details',clarification_turns=clarification_turns+1 where id=$1`,
          [id],
        );
        replies.push(
          `For “${intent.summary.slice(0, 160)}”, please provide ${intent.missingFields.map((f) => fields[f]).join(" and ")}.`,
        );
        continue;
      }
    }
    if (
      !reason &&
      (p.status !== "active" ||
        policy.mode !== "enabled" ||
        policy.allowance_mode !== "per_request" ||
        !intent.operation ||
        !policy.operations.includes(intent.operation) ||
        !intent.targetId ||
        !policy.targets.includes(intent.targetId))
    )
      reason = "policy_denied";
    if (!reason) {
      const used = (
        await sql.query<{ n: number }>(
          "select count(*)::int n from automation_revision_uses where project_id=$1",
          [p.id],
        )
      ).rows[0].n;
      const open = (
        await sql.query<{ n: number }>(
          "select count(*)::int n from project_tasks where project_id=$1 and origin='auto' and status in ('ready','in_progress','blocked')",
          [p.id],
        )
      ).rows[0].n;
      if (used >= policy.allowance) reason = "exhausted_allowance";
      else if (open >= policy.max_open_tasks) reason = "policy_denied";
    }
    const source = intent.sources.map((s) => s.quote).join("\n");
    if (reason) {
      const acknowledgment = `I've put “${intent.summary.slice(0, 160)}” in the owner's review queue. It hasn't been accepted yet.`;
      const decision = await createDecision(sql, {
        projectId: p.id,
        id,
        summary: intent.summary,
        reason,
        source,
        evidence: intent.scopeEvidence.map((e) => e.quote).join("\n"),
        missing: intent.missingFields,
        reply: acknowledgment,
      });
      await sql.query(
        "update owner_decisions set automation_request_id=$2 where id=$1",
        [decision, id],
      );
      await sql.query(
        "update automation_requests set state='owner_review',decision_id=$2 where id=$1",
        [id, decision],
      );
      if (policy.replies.review_acknowledgments) replies.push(acknowledgment);
    } else {
      const taskId = randomUUID();
      await sql.query(
        `insert into project_tasks(id,project_id,task_code,title,origin,origin_text,request_code,operation,target_id,value,
        acceptance_criteria,source_text,source_meta,authorized_by,revision_unit,agreed_due_date,history)
        values($1,$2,$3,$4,'auto','Accepted under confirmed automation policy',$5,$6,$7,$8,$9,$10,$11,$12,'One individual request',$13,$14)`,
        [
          taskId,
          p.id,
          code("TASK", taskId),
          intent.summary.slice(0, 500),
          code("REQ", id),
          intent.operation,
          intent.targetId,
          intent.payload.replacementText ?? intent.payload.color,
          JSON.stringify(intent.payload),
          source,
          sourceIds.join(", "),
          `Automation policy v${p.policy_version}; scope v${p.scope_version}`,
          p.agreed_due_date,
          JSON.stringify([
            "Accepted automatically; queued for the owner to carry out.",
          ]),
        ],
      );
      await sql.query(
        "insert into automation_revision_uses(request_id,project_id,policy_version,scope_version) values($1,$2,$3,$4)",
        [id, p.id, p.policy_version, p.scope_version],
      );
      await sql.query(
        "update automation_requests set state='accepted',task_id=$2 where id=$1",
        [id, taskId],
      );
      replies.push(
        `Accepted “${intent.summary.slice(0, 160)}” as ${code("TASK", taskId)} for the owner to carry out. This uses one included change request.`,
      );
    }
    await sql.query(
      "insert into audit_events(project_id,action,version,details) values($1,$2,$3,$4)",
      [
        p.id,
        reason ? "automation:owner_review" : "automation:accepted",
        p.version,
        JSON.stringify({
          requestId: id,
          reason,
          scopeVersion: p.scope_version,
          policyVersion: p.policy_version,
        }),
      ],
    );
  }
  await queueReply(sql, job, p, replies);
}

export function createAutomationProcessor(
  database: Database,
  interpreter: {
    interpret(context: InterpretationContext): Promise<{
      interpretation: Interpretation;
      model: string;
      promptVersion: string;
    }>;
  },
) {
  return {
    async once() {
      const job = await database.transaction(async (sql) => {
        const row = (
          await sql.query<Job>(`select j.* from automation_jobs j where
        ((j.state='queued' and j.available_at<=now()) or (j.state='running' and j.lease_until<now()))
        and not exists(select 1 from automation_jobs earlier where earlier.project_id=j.project_id
          and earlier.state in ('queued','running') and (earlier.created_at,earlier.id)<(j.created_at,j.id))
        order by j.created_at,j.id for update skip locked limit 1`)
        ).rows[0];
        if (!row) return null;
        row.lease_token = randomUUID();
        row.attempts++;
        await sql.query(
          "update automation_jobs set state='running',attempts=$2,lease_token=$3,lease_until=now()+interval '90 seconds' where id=$1",
          [row.id, row.attempts, row.lease_token],
        );
        return row;
      });
      if (!job) return false;
      try {
        if (job.review_reason || job.attempts > 3)
          throw new Error("owner_review_required");
        const snapshot = await loadSnapshot(database, job);
        const result = await interpreter.interpret(snapshot.context);
        const analysis = validateInterpretation(
          result.interpretation,
          snapshot.context,
        );
        if (!analysis.intents.length) throw new Error("empty_interpretation");
        await database.transaction(async (sql) => {
          await sql.query("select id from projects where id=$1 for update", [
            job.project_id,
          ]);
          const live = (
            await sql.query<{ id: string }>(
              "select id from automation_jobs where id=$1 and state='running' and lease_token=$2 and lease_until>now() for update",
              [job.id, job.lease_token],
            )
          ).rows[0];
          if (!live) return;
          const current = await loadSnapshot(sql, job);
          if (current.watermark !== snapshot.watermark)
            throw new Error("stale_snapshot");
          await applyAnalysis(sql, job, current, analysis);
          await sql.query(
            "update automation_jobs set state='done',lease_until=null,error_code=null,analysis=$3,model=$4,prompt_version=$5 where id=$1 and lease_token=$2",
            [
              job.id,
              job.lease_token,
              JSON.stringify(analysis),
              result.model,
              result.promptVersion,
            ],
          );
        });
      } catch (error) {
        await database.transaction(async (sql) => {
          await sql.query("select id from projects where id=$1 for update", [
            job.project_id,
          ]);
          const live = (
            await sql.query<{ id: string }>(
              "select id from automation_jobs where id=$1 and state='running' and lease_token=$2 for update",
              [job.id, job.lease_token],
            )
          ).rows[0];
          if (!live) return;
          const code =
            error instanceof Error && error.message === "stale_snapshot"
              ? "stale_snapshot"
              : "processing_failed";
          if (!job.review_reason && job.attempts < 3) {
            await sql.query(
              "update automation_jobs set state='queued',lease_until=null,error_code=$2,available_at=now()+interval '10 seconds' where id=$1",
              [job.id, code],
            );
          } else {
            const event = (
              await sql.query<{ event: NormalizedEvent }>(
                "select event from automation_events where id=$1",
                [job.event_id],
              )
            ).rows[0].event;
            await createDecision(sql, {
              projectId: job.project_id,
              id: job.id,
              summary: "Message requires owner review",
              reason: job.review_reason ?? "failed_processing",
              source: event.text ?? "Non-text or membership event",
            });
            await sql.query(
              "update automation_jobs set state='failed',lease_until=null,error_code=$2 where id=$1",
              [job.id, code],
            );
          }
        });
      }
      return true;
    },
  };
}

/** Persist sending before network I/O. An expired submission is unknown, never retried. */
export function createAutomationDelivery(
  database: Database,
  send: (address: string, text: string) => Promise<PhotonSendResult>,
  instanceId: string,
) {
  return {
    async once() {
      const outbox = await database.transaction(async (sql) => {
        const expired = (
          await sql.query<{
            id: string;
            project_id: string;
          }>(`update automation_outbox set state='unknown',error_code='submission_interrupted',updated_at=now()
        where state='sending' and lease_until<now() returning id,project_id`)
        ).rows;
        for (const row of expired)
          await createDecision(sql, {
            projectId: row.project_id,
            id: row.id,
            summary: "Automatic reply delivery is uncertain",
            reason: "delivery_unknown",
            source:
              "Check the client conversation before sending another reply.",
          });
        const row = (
          await sql.query<{
            id: string;
            project_id: string;
            address: string;
            text: string;
            lease_token: string;
          }>(
            `select o.* from automation_outbox o
        join projects p on p.id=o.project_id join chat_bindings b on b.project_id=p.id
        where o.state='queued' and o.instance_id=$1 and p.status in ('active','review_only')
        and b.hold_reason is null and b.test_state='sent' and b.verified_at is not null and b.disclosed_message_guid is not null
        and b.instance_id=o.instance_id and b.chat_guid=o.chat_guid and p.people->>'client_sender_id'=o.address
        and not exists(select 1 from automation_outbox prior where prior.project_id=o.project_id
          and prior.state in ('queued','sending') and (prior.created_at,prior.id)<(o.created_at,o.id))
        order by o.created_at,o.id for update of o,p,b skip locked limit 1`,
            [instanceId],
          )
        ).rows[0];
        if (!row) return null;
        row.lease_token = randomUUID();
        await sql.query(
          "update automation_outbox set state='sending',lease_token=$2,lease_until=now()+interval '90 seconds',updated_at=now() where id=$1",
          [row.id, row.lease_token],
        );
        return row;
      });
      if (!outbox) return false;
      let result: PhotonSendResult;
      try {
        result = await send(outbox.address, outbox.text);
      } catch {
        result = { state: "unknown" };
      }
      await database.transaction(async (sql) => {
        const saved = await sql.query<{ id: string }>(
          `update automation_outbox set state=$3,provider_guid=$4,
        error_code=$5,lease_until=null,updated_at=now() where id=$1 and lease_token=$2 and state='sending' returning id`,
          [
            outbox.id,
            outbox.lease_token,
            result.state,
            result.state === "sent" ? result.messageId : null,
            result.state === "sent"
              ? null
              : "provider_submission_failed_or_uncertain",
          ],
        );
        if (!saved.rows.length) return;
        if (result.state !== "sent")
          await createDecision(sql, {
            projectId: outbox.project_id,
            id: outbox.id,
            summary: `Automatic reply ${result.state === "unknown" ? "delivery is uncertain" : "was not sent"}`,
            reason: "delivery_unknown",
            source: outbox.text,
          });
        else
          await sql.query(
            `insert into automation_messages(project_id,provider_guid,role,text,occurred_at)
        values($1,$2,'assistant',$3,now()) on conflict(project_id,provider_guid) do nothing`,
            [outbox.project_id, result.messageId, outbox.text],
          );
      });
      return true;
    },
  };
}
