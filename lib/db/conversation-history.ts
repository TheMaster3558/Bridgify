import "server-only";
import { z } from "zod";
import { IntakeError } from "../assistant/intake-error";
import type { Database } from "./postgres";

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() }).strict();
type HistoryMessage = {
  id: string; providerMessageGuid: string; senderId: string | null;
  senderRole: string; direction: string; receivedAt: string;
  revisions: Array<{
    id: string; revision: number; kind: string; text: string | null; deleted: boolean;
    providerOccurredAt: string | null; receivedAt: string; processingState: string; sourceEventId: string;
    senderId: string | null; senderRole: string;
  }>;
};
const iso = (value: Date | string) => new Date(value).toISOString();

export async function getConversationHistory(database: Database, input: {
  userId: string; projectId: string; cursor?: string;
}): Promise<{ projectName: string; messages: HistoryMessage[]; nextCursor: string | null }> {
  if (!z.uuid().safeParse(input.userId).success || !z.uuid().safeParse(input.projectId).success) {
    throw new IntakeError("project_not_found", 404);
  }
  let before: z.infer<typeof cursorSchema> | undefined;
  if (input.cursor) {
    try {
      if (input.cursor.length > 512) throw new Error();
      before = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")));
    } catch { throw new IntakeError("invalid_history_cursor", 400); }
  }
  return database.transaction(async sql => {
    // Explicit checks are required even with an elevated server connection.
    const project = await sql.query<{ name: string; organization_id: string }>(`select p.name,p.organization_id
      from projects p join organization_members om on om.organization_id=p.organization_id
      where p.id=$1 and om.user_id=$2 and (om.role='owner' or exists(
        select 1 from project_members pm where pm.project_id=p.id and pm.organization_id=p.organization_id
          and pm.user_id=$2 and pm.role in ('owner','teammate')))`, [input.projectId, input.userId]);
    if (!project.rows.length) throw new IntakeError("project_not_found", 404);
    const rows = await sql.query<{
      id: string; provider_message_guid: string; provider_sender_id: string | null;
      sender_role: string; direction: string; created_at: Date | string;
    }>(`select m.id,m.provider_message_guid,m.provider_sender_id,m.sender_role,m.direction,m.created_at
      from messages m join conversations c on c.id=m.conversation_id
      where m.project_id=$1 and m.organization_id=$2 and c.type='client_group'
        and ($3::timestamptz is null or (m.created_at,m.id)<($3::timestamptz,$4::uuid))
      order by m.created_at desc,m.id desc limit 26`,
    [input.projectId, project.rows[0].organization_id, before?.at ?? null, before?.id ?? null]);
    const visible = rows.rows.slice(0, 25);
    const revisions = visible.length ? await sql.query<{
      id: string; message_id: string; revision: number; kind: string; text: string | null; deleted: boolean;
      provider_occurred_at: Date | string | null; received_at: Date | string; processing_state: string; source_event_id: string;
      provider_sender_id: string | null; sender_role: string;
    }>(`select id,message_id,revision,kind,text,deleted,provider_occurred_at,received_at,processing_state,source_event_id,provider_sender_id,sender_role
      from message_revisions where project_id=$1 and organization_id=$2 and message_id=any($3::uuid[])
      order by revision`, [input.projectId, project.rows[0].organization_id, visible.map(m => m.id)]) : { rows: [] };
    const last = visible.at(-1);
    return {
      projectName: project.rows[0].name,
      messages: visible.map(m => ({
        id: m.id, providerMessageGuid: m.provider_message_guid, senderId: m.provider_sender_id,
        senderRole: m.sender_role, direction: m.direction, receivedAt: iso(m.created_at),
        revisions: revisions.rows.filter(r => r.message_id === m.id).map(r => ({
          id: r.id, revision: r.revision, kind: r.kind, text: r.text, deleted: r.deleted,
          providerOccurredAt: r.provider_occurred_at ? iso(r.provider_occurred_at) : null,
          receivedAt: iso(r.received_at), processingState: r.processing_state, sourceEventId: r.source_event_id,
          senderId: r.provider_sender_id, senderRole: r.sender_role,
        })),
      })),
      nextCursor: rows.rows.length > 25 && last ? Buffer.from(JSON.stringify({ at: iso(last.created_at), id: last.id })).toString("base64url") : null,
    };
  });
}
