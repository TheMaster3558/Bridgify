import "server-only";
import { createHash } from "node:crypto";
import { normalizedEventSchema, type NormalizedEvent } from "../assistant/contracts";
import type { InboxWriter } from "../assistant/intake";
import { IntakeError } from "../assistant/intake-error";
import type { Database, Sql } from "./postgres";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Binding = {
  id: string; project_id: string; organization_id: string; identity_hold: boolean;
  status: string; activated_at: Date | string | null;
};

async function enqueue(sql: Sql, binding: Binding, inboxId: string, revisionId: string | null, type: string) {
  await sql.query(`insert into jobs(project_id,organization_id,type,inbox_event_id,source_message_revision_id)
    values($1,$2,$3,$4,$5) on conflict do nothing`,
  [binding.project_id, binding.organization_id, type, inboxId, revisionId]);
}

export function createInboxWriter(database: Database): InboxWriter {
  return {
    async persistVerifiedEvent(input: NormalizedEvent) {
      const event = normalizedEventSchema.parse(input);
      return database.transaction(async sql => {
        // Serialize intake for one instance/chat, even before a message row exists.
        // Binding/lifecycle changes also lock the actual conversation/project below.
        await sql.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([event.instanceId, event.chatGuid])]);
        const fingerprint = hash({ ...event, eventKey: undefined });
        const inserted = await sql.query<{ id: string }>(`insert into inbox_events
          (provider_instance_id,event_key,fingerprint,kind,chat_guid,provider_message_guid,provider_sender_id,provider_occurred_at)
          values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(provider_instance_id,event_key) do nothing returning id`,
        [event.instanceId, event.eventKey, fingerprint, event.kind, event.chatGuid, event.messageGuid ?? null,
          event.senderId ?? null, event.occurredAt ?? null]);
        if (!inserted.rows.length) {
          const previous = await sql.query<{ id: string; fingerprint: string }>(
            "select id,fingerprint from inbox_events where provider_instance_id=$1 and event_key=$2",
            [event.instanceId, event.eventKey]);
          if (previous.rows[0]?.fingerprint !== fingerprint) throw new IntakeError("provider_event_identity_conflict", 409);
          return { inboxEventId: previous.rows[0].id, duplicate: true };
        }
        const inboxId = inserted.rows[0].id;
        const match = await sql.query<Binding & Record<string, unknown>>(`select c.id,c.project_id,c.organization_id,c.identity_hold,p.status,p.activated_at
          from conversations c join projects p on p.id=c.project_id and p.organization_id=c.organization_id
          where c.provider_instance_id=$1 and c.chat_guid=$2 and c.active and c.verified_at is not null
            and c.type='client_group' for update of c,p`, [event.instanceId, event.chatGuid]);
        const binding = match.rows[0];
        if (!binding) {
          await sql.query("update inbox_events set state='unlinked_chat' where id=$1", [inboxId]);
          return { inboxEventId: inboxId, duplicate: false };
        }
        await sql.query("update inbox_events set conversation_id=$2,project_id=$3,organization_id=$4 where id=$1",
          [inboxId, binding.id, binding.project_id, binding.organization_id]);
        await sql.query("update conversations set input_version=input_version+1 where id=$1", [binding.id]);
        if (event.kind === "membership") {
          await sql.query("update conversations set identity_hold=true where id=$1", [binding.id]);
          await enqueue(sql, binding, inboxId, null, "review_membership");
          await sql.query("update inbox_events set state='membership_review' where id=$1", [inboxId]);
          return { inboxEventId: inboxId, duplicate: false };
        }
        if (event.kind === "delivery") {
          await sql.query("update inbox_events set state='delivery_context' where id=$1", [inboxId]);
          return { inboxEventId: inboxId, duplicate: false };
        }
        const participant = await sql.query<{ authority: string }>(`select b.authority from participant_bindings b
          where b.conversation_id=$1 and b.provider_sender_id=$2 and b.revoked_at is null and b.verified_at is not null
            and (b.authority in ('bot','viewer') or exists(select 1 from project_members pm
              where pm.project_id=b.project_id and pm.organization_id=b.organization_id and pm.user_id=b.user_id
                and pm.role=case when b.authority='owner' then 'owner' else 'requester' end))
          for share of b`, [binding.id, event.senderId ?? null]);
        const role = event.fromBot ? "bot" : participant.rows[0]?.authority ?? "unknown";
        const message = await sql.query<{ id: string; provider_sender_id: string | null }>(`insert into messages
          (conversation_id,project_id,organization_id,provider_message_guid,provider_sender_id,sender_role,direction)
          values($1,$2,$3,$4,$5,$6,$7) on conflict(conversation_id,provider_message_guid) do nothing
          returning id,provider_sender_id`,
        [binding.id, binding.project_id, binding.organization_id, event.messageGuid, event.senderId ?? null, role,
          event.direction ?? (role === "bot" ? "outbound" : "inbound")]);
        const existing = message.rows[0] ?? (await sql.query<{ id: string; provider_sender_id: string | null }>(
          "select id,provider_sender_id from messages where conversation_id=$1 and provider_message_guid=$2 for update",
          [binding.id, event.messageGuid])).rows[0];
        // A second delivery ID for the same semantic revision has no new effect.
        const repeated = await sql.query<{ id: string }>("select id from message_revisions where message_id=$1 and fingerprint=$2", [existing.id, fingerprint]);
        if (repeated.rows.length) {
          await sql.query("update inbox_events set state='duplicate_message' where id=$1", [inboxId]);
          return { inboxEventId: inboxId, duplicate: true };
        }
        const ordinal = await sql.query<{ revision: number }>(
          "select coalesce(max(revision),0)::int+1 as revision from message_revisions where message_id=$1", [existing.id]);
        const revision = ordinal.rows[0].revision;
        if (event.kind !== "message" || revision > 1) {
          // Prevent a queued original from being analyzed after its source changed.
          // Running consumers must additionally recheck input_version at commit.
          await sql.query(`update jobs set state='failed',error_code='source_changed',lease_until=null
            where type='analyze_conversation' and state in ('queued','running') and source_message_revision_id in
              (select id from message_revisions where message_id=$1)`, [existing.id]);
        }
        const eventTime = event.occurredAt ? new Date(event.occurredAt).getTime() : null;
        const cutoff = binding.activated_at ? new Date(binding.activated_at).getTime() : null;
        let state: string;
        if (role === "bot") state = "bot_echo";
        else if (role === "owner") state = "owner_context";
        else if (role === "unknown" || role === "viewer") state = "unverified_sender";
        else if (event.direction === "outbound") state = "outbound_context";
        else if (existing.provider_sender_id !== (event.senderId ?? null)) state = "sender_conflict";
        else if (event.kind !== "message" || revision > 1) state = "mutation_review";
        else if (cutoff === null || eventTime === null) state = "missing_activation_or_timestamp";
        else if (eventTime < cutoff) state = "before_activation";
        else if (eventTime > Date.now() + 300_000) state = "future_timestamp";
        else if (binding.status === "completed" || binding.status === "archived" || binding.status === "draft") state = "inactive_project";
        else if (binding.identity_hold) state = "identity_hold";
        else if (binding.status !== "active") state = "review_only";
        else if (event.contentType && event.contentType !== "text") state = "unsupported_input";
        else if (!event.text?.trim()) state = "unsupported_input";
        else state = "pending_analysis";
        const source = await sql.query<{ id: string }>(`insert into message_revisions
          (message_id,project_id,organization_id,source_event_id,revision,fingerprint,kind,text,deleted,provider_occurred_at,provider_sender_id,sender_role,processing_state)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [existing.id, binding.project_id, binding.organization_id, inboxId, revision, fingerprint,
          event.kind, event.kind === "delete" ? null : event.text ?? null, event.kind === "delete", event.occurredAt ?? null,
          event.senderId ?? null, role, state]);
        let job: string | undefined;
        if (state === "pending_analysis") job = "analyze_conversation";
        else if (state === "unverified_sender") job = "review_unknown_participant";
        else if (["mutation_review", "sender_conflict"].includes(state)) job = "review_message_change";
        else if (["review_only", "identity_hold", "unsupported_input", "future_timestamp", "missing_activation_or_timestamp"].includes(state)) job = "review_unprocessed_message";
        if (job) await enqueue(sql, binding, inboxId, source.rows[0].id, job);
        await sql.query("update inbox_events set state=$2 where id=$1", [inboxId, state]);
        return { inboxEventId: inboxId, duplicate: false };
      });
    },
  };
}
