// Signed synthetic Spectrum deliveries + real Postgres (PGlite), not live Photon.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "../../lib/db/postgres";
import { createInboxWriter } from "../../lib/db/inbox";
import { getConversationHistory } from "../../lib/db/conversation-history";
import { createWebhookHandler } from "../../lib/assistant/webhook-handler";
import { createSpectrumWebhookDecoder, configuredPhotonWebhookDecoder } from "../../lib/photon/webhook";

const org = "10000000-0000-4000-8000-000000000001";
const project = "20000000-0000-4000-8000-000000000001";
const otherProject = "20000000-0000-4000-8000-000000000002";
const conversation = "30000000-0000-4000-8000-000000000001";
const owner = "40000000-0000-4000-8000-000000000001";
const client = "40000000-0000-4000-8000-000000000002";
const outsider = "40000000-0000-4000-8000-000000000003";
const signingSecret = "unit-test-secret-never-used-in-production";
const instance = "test-provider-instance";
const chatGuid = "test-provider-returned-group-guid";
const now = Date.now();
let pg: PGlite;
let directory: string;
let database: Database;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "bridgify-intake-"));
  pg = await PGlite.create(directory);
  await pg.exec("create role anon; create role authenticated; grant usage on schema public to anon,authenticated;");
  await pg.exec(await readFile("supabase/migrations/202610170001_message_intake.sql", "utf8"));
  database = {
    query: (text, params) => pg.query(text, params),
    transaction: work => pg.transaction(tx => work({ query: (text, params) => tx.query(text, params) })),
  };
});
after(async () => { await pg?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
beforeEach(async () => {
  await pg.exec("truncate organizations,inbox_events cascade");
  await pg.query("insert into organizations(id,name) values($1,'Synthetic test organization')", [org]);
  await pg.query("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner')", [org, owner]);
  await pg.query("insert into projects(id,organization_id,name,status,activated_at) values($1,$2,'Linked project','active',$3)", [project, org, new Date(now - 60_000)]);
  await pg.query("insert into projects(id,organization_id,name,status,activated_at) values($1,$2,'Other project','active',$3)", [otherProject, org, new Date(now - 60_000)]);
  await pg.query("insert into project_members(project_id,organization_id,user_id,role) values($1,$2,$3,'owner'),($1,$2,$4,'requester')", [project, org, owner, client]);
  await pg.query(`insert into conversations(id,project_id,organization_id,provider_instance_id,chat_guid,active,verified_at)
    values($1,$2,$3,$4,$5,true,now())`, [conversation, project, org, instance, chatGuid]);
  for (const [sender, user, role] of [["client-sender", client, "requester"], ["owner-sender", owner, "owner"], ["bot-sender", null, "bot"]]) {
    await pg.query(`insert into participant_bindings(conversation_id,project_id,organization_id,provider_sender_id,user_id,authority,verified_at)
      values($1,$2,$3,$4,$5,$6,now())`, [conversation, project, org, sender, user, role]);
  }
});

function payload(options: { id?: string; sender?: string; at?: string; chat?: string; text?: string; direction?: "inbound" | "outbound" } = {}) {
  return { event: "messages", space: { id: options.chat ?? chatGuid, type: "group" }, message: {
    id: options.id ?? "provider-message-1", sender: { id: options.sender ?? "client-sender" },
    direction: options.direction ?? "inbound", timestamp: options.at ?? new Date(now).toISOString(),
    content: { type: "text", text: options.text ?? "Make the homepage heading green" },
  } };
}
function signedRequest(body: unknown, options: { timestamp?: number; secret?: string } = {}) {
  const text = JSON.stringify(body);
  const timestamp = String(options.timestamp ?? Math.floor(now / 1000));
  const signature = `v0=${createHmac("sha256", options.secret ?? signingSecret).update(`v0:${timestamp}:${text}`).digest("hex")}`;
  return new Request("https://bridgify.example/api/v1/integrations/photon/webhook", {
    method: "POST", body: text, headers: { "Content-Type": "application/json", "X-Spectrum-Timestamp": timestamp, "X-Spectrum-Signature": signature },
  });
}
function handler(db = database) {
  return createWebhookHandler(() => ({
    decoder: createSpectrumWebhookDecoder({ signingSecret, instanceId: instance, now: () => now }),
    inbox: createInboxWriter(db),
  }));
}
async function count(table: "messages" | "message_revisions" | "jobs" | "inbox_events", where = "true") {
  return Number((await pg.query<{ n: string }>(`select count(*) as n from ${table} where ${where}`)).rows[0].n);
}

test("verified client delivery is stored in the exact linked project with a durable source/job", async () => {
  const response = await handler()(signedRequest(payload()));
  assert.equal(response.status, 200);
  const history = await getConversationHistory(database, { userId: owner, projectId: project });
  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0].providerMessageGuid, "provider-message-1");
  assert.equal(history.messages[0].senderRole, "requester");
  assert.equal(history.messages[0].revisions[0].text, "Make the homepage heading green");
  assert.equal(history.messages[0].revisions[0].processingState, "pending_analysis");
  const job = (await pg.query<{ project_id: string; source_message_revision_id: string }>("select * from jobs")).rows[0];
  assert.equal(job.project_id, project);
  assert.equal(job.source_message_revision_id, history.messages[0].revisions[0].id);
  assert.equal((await getConversationHistory(database, { userId: owner, projectId: otherProject })).messages.length, 0);
  assert.equal(JSON.stringify(await response.json()).includes(project), false);
});

test("simultaneous duplicate delivery produces one message, revision and logical processing job", async () => {
  const post = handler();
  const responses = await Promise.all([post(signedRequest(payload())), post(signedRequest(payload())), post(signedRequest(payload()))]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(await count("messages"), 1);
  assert.equal(await count("message_revisions"), 1);
  assert.equal(await count("jobs", "type='analyze_conversation'"), 1);
  assert.equal(await count("inbox_events"), 1);
  assert.equal((await Promise.all(responses.map(r => r.json()))).filter(r => r.data.duplicate).length, 2);
});

test("bot echoes and owner messages remain history without client processing jobs", async () => {
  assert.equal((await handler()(signedRequest(payload({ id: "bot", sender: "bot-sender", direction: "outbound" })))).status, 200);
  assert.equal((await handler()(signedRequest(payload({ id: "owner", sender: "owner-sender" })))).status, 200);
  assert.equal(await count("messages"), 2);
  assert.equal(await count("jobs"), 0);
  const states = (await pg.query<{ processing_state: string }>("select processing_state from message_revisions")).rows.map(r => r.processing_state).sort();
  assert.deepEqual(states, ["bot_echo", "owner_context"]);
});

test("unknown or revoked participants can only create a private review, never authorized analysis", async () => {
  await handler()(signedRequest(payload({ sender: "unknown-sender", id: "unknown" })));
  await pg.query("update participant_bindings set revoked_at=now() where provider_sender_id='client-sender'");
  await handler()(signedRequest(payload({ id: "revoked" })));
  assert.equal(await count("jobs", "type='analyze_conversation'"), 0);
  assert.equal(await count("jobs", "type='review_unknown_participant'"), 2);
  await assert.rejects(getConversationHistory(database, { userId: client, projectId: project }), /project_not_found/);
  await assert.rejects(getConversationHistory(database, { userId: outsider, projectId: project }), /project_not_found/);
});

test("a job-insert failure rolls back inbox and history and returns failure, then retry commits once", async () => {
  await pg.exec(`create function fail_test_job() returns trigger language plpgsql as $$
    begin raise exception 'injected storage failure'; end $$;
    create trigger fail_test_job before insert on jobs for each row execute function fail_test_job();`);
  try {
    const response = await handler()(signedRequest(payload()));
    assert.equal(response.status, 503);
    assert.equal(await count("inbox_events"), 0);
    assert.equal(await count("messages"), 0);
    assert.equal(await count("message_revisions"), 0);
  } finally { await pg.exec("drop trigger fail_test_job on jobs; drop function fail_test_job()"); }
  assert.equal((await handler()(signedRequest(payload()))).status, 200);
  assert.equal(await count("messages"), 1);
  assert.equal(await count("jobs"), 1);
});

test("unsigned, invalid, expired and unconfigured verification never persist or acknowledge", async () => {
  const post = handler();
  assert.equal((await post(new Request("https://bridgify.example/hook", { method: "POST", body: JSON.stringify(payload()) }))).status, 401);
  assert.equal((await post(signedRequest(payload(), { secret: "wrong-secret" }))).status, 401);
  assert.equal((await post(signedRequest(payload(), { timestamp: Math.floor(now / 1000) - 301 }))).status, 401);
  const unconfigured = createWebhookHandler(() => ({ decoder: configuredPhotonWebhookDecoder({ NODE_ENV: "test" }), inbox: createInboxWriter(database) }));
  assert.equal((await unconfigured(signedRequest(payload()))).status, 503);
  assert.equal(await count("inbox_events"), 0);
});

test("verification uses exact UTF-8 bytes, rejects body tampering and bounds streamed bodies", async () => {
  const text = JSON.stringify(payload({ text: "Please change the café heading ☕" }), null, 2);
  const timestamp = String(Math.floor(now / 1000));
  const signature = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${text}`).digest("hex")}`;
  const headers = { "X-Spectrum-Timestamp": timestamp, "X-Spectrum-Signature": signature };
  const post = handler();
  assert.equal((await post(new Request("https://bridgify.example/hook", { method: "POST", headers, body: text + " " }))).status, 401);
  assert.equal((await post(new Request("https://bridgify.example/hook", { method: "POST", headers, body: text }))).status, 200);
  assert.equal((await post(new Request("https://bridgify.example/hook", { method: "POST", headers, body: "x".repeat(256_001) }))).status, 413);
  assert.equal(await count("messages"), 1);
});

test("unlinked instance/chat is held durably without project history or jobs", async () => {
  assert.equal((await handler()(signedRequest(payload({ chat: "another-group" })))).status, 200);
  assert.equal(await count("inbox_events", "state='unlinked_chat'"), 1);
  assert.equal(await count("messages"), 0);
  assert.equal(await count("jobs"), 0);
  const anotherInstance = createWebhookHandler(() => ({ decoder: createSpectrumWebhookDecoder({ signingSecret, instanceId: "another-instance", now: () => now }), inbox: createInboxWriter(database) }));
  await anotherInstance(signedRequest(payload()));
  assert.equal(await count("messages"), 0);
});

test("preactivation, missing timestamps, paused and completed projects do not authorize analysis", async () => {
  await handler()(signedRequest(payload({ id: "old", at: new Date(now - 120_000).toISOString() })));
  const missingTime = payload({ id: "no-time" });
  await handler()(signedRequest({ ...missingTime, message: { ...missingTime.message, timestamp: undefined } }));
  await pg.query("update projects set status='paused' where id=$1", [project]);
  await handler()(signedRequest(payload({ id: "paused" })));
  await pg.query("update projects set status='completed' where id=$1", [project]);
  await handler()(signedRequest(payload({ id: "completed" })));
  assert.equal(await count("messages"), 4);
  assert.equal(await count("jobs", "type='analyze_conversation'"), 0);
  const states = (await pg.query<{ processing_state: string }>("select processing_state from message_revisions")).rows.map(r => r.processing_state).sort();
  assert.deepEqual(states, ["before_activation", "inactive_project", "missing_activation_or_timestamp", "review_only"]);
});

test("outbound requester events and inconsistent memberships cannot authorize analysis", async () => {
  await handler()(signedRequest(payload({ id: "outbound", direction: "outbound" })));
  await pg.query("delete from project_members where user_id=$1 and role='requester'", [client]);
  await handler()(signedRequest(payload({ id: "missing-membership" })));
  assert.equal(await count("jobs", "type='analyze_conversation'"), 0);
  assert.equal(await count("jobs", "type='review_unknown_participant'"), 1);
});

test("source edits/deletions append immutable revisions and private review, never fresh client work", async () => {
  await handler()(signedRequest(payload()));
  // Internal normalized contract fixtures, NOT invented Spectrum mutation frames.
  const writer = createInboxWriter(database);
  for (const kind of ["edit", "delete"] as const) {
    await writer.persistVerifiedEvent({
      instanceId: instance, eventKey: `test-normalized-${kind}`, chatGuid, messageGuid: "provider-message-1",
      senderId: "client-sender", kind, text: kind === "edit" ? "Make it blue instead" : undefined,
      occurredAt: new Date(now + (kind === "edit" ? 1000 : 2000)).toISOString(), fromBot: false,
    });
  }
  const history = await getConversationHistory(database, { userId: owner, projectId: project });
  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0].revisions.length, 3);
  assert.equal(history.messages[0].revisions[0].text, "Make the homepage heading green");
  assert.equal(history.messages[0].revisions[2].deleted, true);
  assert.equal(await count("jobs", "type='analyze_conversation'"), 1);
  assert.equal(await count("jobs", "type='review_message_change'"), 2);
  assert.equal(await count("jobs", "type='analyze_conversation' and state='queued'"), 0);
  assert.equal(await count("jobs", "error_code='source_changed'"), 1);
  await assert.rejects(pg.query("update message_revisions set text='overwrite' where revision=1"), /immutable/);
});

test("unsupported provider events and content are explicit and never analyzed as text", async () => {
  const post = handler();
  assert.equal((await post(signedRequest({ event: "made-up-edit" }))).status, 422);
  const body = payload();
  assert.equal((await post(signedRequest({ ...body, message: { ...body.message, content: { type: "delete" } } }))).status, 422);
  assert.equal(await count("messages"), 0);
  await post(signedRequest({ ...body, message: { ...body.message, content: { type: "voice", name: "voice-note" } } }));
  assert.equal(await count("messages"), 1);
  assert.equal(await count("jobs", "type='analyze_conversation'"), 0);
});

test("membership changes hold subsequent requester intake for owner verification", async () => {
  const body = payload({ id: "member-change" });
  await handler()(signedRequest({ ...body, message: { ...body.message, content: { type: "addMember" } } }));
  await handler()(signedRequest(payload()));
  assert.equal(await count("jobs", "type='review_membership'"), 1);
  assert.equal(await count("jobs", "type='analyze_conversation'"), 0);
  assert.equal((await pg.query<{ identity_hold: boolean }>("select identity_hold from conversations")).rows[0].identity_hold, true);
});

test("changed content under the same provider identity is not silently overwritten", async () => {
  await handler()(signedRequest(payload()));
  const response = await handler()(signedRequest(payload({ text: "Actually change it to blue" })));
  assert.equal(response.status, 409);
  assert.equal(await count("message_revisions"), 1);
});

test("browser roles cannot write intake or read another project's history", async () => {
  await handler()(signedRequest(payload()));
  await pg.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [client]);
    await tx.exec("set local role authenticated");
    assert.equal((await tx.query("select * from messages")).rows.length, 0);
  });
  await pg.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
    await tx.exec("set local role authenticated");
    assert.equal((await tx.query("select * from messages")).rows.length, 1);
  });
  await assert.rejects(pg.transaction(async tx => {
    await tx.exec("set local role authenticated");
    await tx.query("insert into inbox_events(provider_instance_id,event_key,fingerprint,kind) values('bad','bad','bad','message')");
  }), /permission denied/);
});

test("history paginates without losing source references or including private owner chats", async () => {
  const writer = createInboxWriter(database);
  for (let index = 0; index < 27; index++) {
    await writer.persistVerifiedEvent({ instanceId: instance, eventKey: `page-${index}`, chatGuid,
      messageGuid: randomUUID(), senderId: "owner-sender", kind: "message", text: `Context ${index}`,
      occurredAt: new Date(now).toISOString(), fromBot: false });
  }
  const first = await getConversationHistory(database, { userId: owner, projectId: project });
  assert.equal(first.messages.length, 25);
  assert.ok(first.nextCursor);
  const second = await getConversationHistory(database, { userId: owner, projectId: project, cursor: first.nextCursor });
  assert.equal(second.messages.length, 2);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.messages, ...second.messages].map(m => m.id)).size, 27);
  await pg.query(`insert into conversations(project_id,organization_id,provider_instance_id,chat_guid,type,active,verified_at)
    values($1,$2,$3,'private-chat','owner_private',true,now())`, [project, org, instance]);
  // Private destinations are not accepted through the client-group intake.
  await handler()(signedRequest(payload({ id: "private", chat: "private-chat", text: "Private owner pricing note" })));
  assert.equal(await count("messages"), 27);
  await assert.rejects(getConversationHistory(database, { userId: owner, projectId: project, cursor: "bad-cursor" }), /invalid_history_cursor/);
});

test("history and queued work survive a database restart; replay still deduplicates", async () => {
  await handler()(signedRequest(payload()));
  await pg.close();
  pg = await PGlite.create(directory);
  const history = await getConversationHistory(database, { userId: owner, projectId: project });
  assert.equal(history.messages.length, 1);
  const response = await handler()(signedRequest(payload()));
  assert.equal((await response.json()).data.duplicate, true);
  assert.equal(await count("messages"), 1);
  assert.equal(await count("jobs"), 1);
});
