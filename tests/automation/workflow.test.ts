import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { before, after, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Database } from "../../lib/db/postgres";
import {
  createAutomationDelivery,
  createAutomationProcessor,
  createProjectAutomationInbox,
} from "../../lib/assistant/automation";
import type {
  Interpretation,
  InterpretationContext,
} from "../../lib/ai/interpret-messages";
import {
  processingErrorCode,
  processingErrorLabel,
} from "../../lib/assistant/processing-errors";

// Synthetic test conversations exercise the real migrations and transactions.
// Production code never imports these fixtures or fabricates customer data.
const owner = "11111111-1111-4111-8111-111111111111";
const project = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";
const doc = "44444444-4444-4444-8444-444444444444";
const instance = "spectrum-project";
const chat = "any;-;+12065550002";
const people = {
  channel: "photon_shared",
  photon_user_id: "real-shaped-id",
  client_name: "Test Client",
  client_email: null,
  client_sender_id: "+12065550002",
  agent_number: "+12065550100",
  instance_id: instance,
  chat_guid: chat,
};
const policy = {
  mode: "enabled",
  allowance_mode: "per_request",
  allowance: 3,
  operations: ["replace_text", "change_color"],
  targets: ["home.heading"],
  exclusions: "No new pages or integrations",
  max_open_tasks: 3,
  notifications: "dashboard",
};
let pg: PGlite;
let database: Database;
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text); alter table storage.objects enable row level security;`);
  // Every deployable migration must compose with project creation on a clean DB.
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  database = {
    query: (q, p) => pg.query(q, p),
    transaction: (work) =>
      pg.transaction((tx) => work({ query: (q, p) => tx.query(q, p) })),
  };
});
after(async () => {
  await pg?.close();
});
beforeEach(async () => {
  await pg.exec("truncate auth.users,organizations cascade");
  await pg.query(
    "insert into auth.users(id,email) values($1,'owner@example.test')",
    [owner],
  );
  await pg.query(
    "insert into organizations(id,name) values($1,'Test workspace')",
    [org],
  );
  await pg.query("insert into organization_members values($1,$2,'owner')", [
    org,
    owner,
  ]);
  await pg.query(
    `insert into projects(id,organization_id,owner_id,name,client_name,original_amount_cents,timezone,status,
    scope_version,policy_version,people,policy,activation_cutoff,disclosure_at)
    values($1,$2,$3,'Website','Test Client',10000,'America/Los_Angeles','active',1,1,$4,$5,now()-interval '1 hour',now())`,
    [project, org, owner, JSON.stringify(people), JSON.stringify(policy)],
  );
  await pg.query(
    "insert into documents(id,project_id,kind,status,original_text) values($1,$2,'text','ready','Heading text and color changes are included.')",
    [doc, project],
  );
  await pg.query(
    `insert into scope_versions(project_id,version,document_id,terms,confirmed_by)
    values($1,1,$2,$3,$4)`,
    [
      project,
      doc,
      JSON.stringify([
        {
          kind: "inclusion",
          text: "Heading text and color changes are included.",
        },
      ]),
      owner,
    ],
  );
  await pg.query(
    `insert into chat_bindings(project_id,instance_id,chat_guid,participants,membership_hash,verified_at,test_state,disclosed_message_guid)
    values($1,$2,$3,'[]','verified',now(),'sent','intro-guid')`,
    [project, instance, chat],
  );
});
async function message(text = "Make the heading green", extra = {}) {
  return createProjectAutomationInbox(database).persistVerifiedEvent({
    instanceId: instance,
    chatGuid: chat,
    eventKey: randomUUID(),
    messageGuid: randomUUID(),
    senderId: people.client_sender_id,
    kind: "message",
    text,
    occurredAt: new Date().toISOString(),
    direction: "inbound",
    fromBot: false,
    ...extra,
  });
}
function intent(
  c: InterpretationContext,
  patch: Partial<Interpretation["intents"][number]> = {},
): Interpretation["intents"][number] {
  const m = c.messages.at(-1)!;
  return {
    intent: "new_request",
    summary: "Change heading color",
    existingRequestId: null,
    taskId: null,
    operation: "change_color",
    targetId: "home.heading",
    payload: { color: "green", locator: null, replacementText: null },
    sources: [{ revisionId: m.revisionId, quote: m.text }],
    scopeEvidence: [{ scopeItemId: "scope-0", quote: "color changes" }],
    missingFields: [],
    ambiguous: false,
    conflicting: false,
    requestsNewDeadline: false,
    scopeAssessment: "included",
    violatesPolicyExclusions: false,
    ...patch,
  };
}
function processor(
  output: (
    c: InterpretationContext,
  ) => Interpretation | Promise<Interpretation> = (c) => ({
    intents: [intent(c)],
  }),
) {
  return createAutomationProcessor(database, {
    async interpret(c) {
      return {
        interpretation: await output(c),
        model: "test-model",
        promptVersion: "test-v2",
      };
    },
  });
}
async function count(table: string, condition = "true") {
  return (
    await pg.query<{ n: number }>(
      `select count(*)::int n from ${table} where ${condition}`,
    )
  ).rows[0].n;
}
async function changePolicy(patch: object) {
  await pg.query("update projects set policy=policy||$2::jsonb where id=$1", [
    project,
    JSON.stringify(patch),
  ]);
}

test("owner-only schema revokes invitation, client proposal and legacy command access", async () => {
  await asOwner(async () => {
    await assert.rejects(pg.query("select accept_invitation('retired')"), /permission denied/);
    await assert.rejects(pg.query("select shared_proposal($1,1)", [project]), /permission denied/);
    await assert.rejects(pg.query("select onboarding_command($1,1,'invite','{}',$2)", [project,randomUUID()]), /iMessage/);
    const exposed = await pg.query<{n:number}>(`select count(*)::int n from pg_proc where pronamespace='public'::regnamespace
      and proname like 'onboarding_command_before%' and has_function_privilege('authenticated',oid,'execute')`);
    assert.equal(exposed.rows[0].n,0);
  });
});
test("allowed request atomically populates task, revision ledger, evidence, audit, analysis and confirmation", async () => {
  await message();
  await processor().once();
  assert.equal(await count("project_tasks"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
  assert.equal(await count("automation_outbox"), 1);
  const task = (
    await pg.query<{
      status: string;
      target_id: string;
      value: string;
      authorized_by: string;
    }>("select * from project_tasks")
  ).rows[0];
  assert.equal(task.status, "ready");
  assert.equal(task.target_id, "home.heading");
  assert.equal(task.value, "green");
  assert.match(task.authorized_by, /policy v1; scope v1/);
  assert.equal(
    await count("automation_jobs", "state='done' and model='test-model'"),
    1,
  );
  assert.equal(await count("audit_events", "action='automation:accepted'"), 1);
  assert.equal(await processor().once(), false);
});
test("provider replay and authenticated history import deduplicate at message identity", async () => {
  const values = {
    eventKey: "same-event",
    messageGuid: "same-message",
    occurredAt: new Date().toISOString(),
  };
  await message("Make the heading green", values);
  assert.equal(
    (await message("Make the heading green", values)).duplicate,
    true,
  );
  assert.equal(
    (
      await message("Make the heading green", {
        ...values,
        eventKey: "history-event",
      })
    ).duplicate,
    true,
  );
  assert.equal(await count("automation_jobs"), 1);
  await assert.rejects(message("different text", values), /identity_conflict/);
});
test("standalone thanks stay in history without model calls, tasks, reviews or replies", async () => {
  for (const text of ["thanks", "Thanks!", "Thank you so much 🙏", "Great, thanks for the update!", "👍"]) {
    await message(text);
  }
  assert.equal(await count("automation_messages"), 5);
  assert.equal(await count("automation_events", "disposition='courtesy_context'"), 5);
  assert.equal(await processor(() => { throw new Error("Must not call Gemini"); }).once(), false);
  assert.equal(await count("project_tasks"), 0);
  assert.equal(await count("owner_decisions"), 0);
  assert.equal(await count("automation_outbox"), 0);
});
test("courtesy jobs queued before deployment finish silently even if Gemini is unavailable", async () => {
  await message("Thanks!");
  await pg.exec(`insert into automation_jobs(project_id,event_id,message_id)
    select project_id,event_id,id from automation_messages`);
  assert.equal(await processor(() => { throw new Error("Must not call Gemini"); }).once(), true);
  assert.equal(await count("automation_jobs", "state='done' and prompt_version='courtesy-v1'"), 1);
  assert.equal(await count("automation_outbox"), 0);
  assert.equal(await count("owner_decisions"), 0);
});
test("thanks with a request still creates one task and sends exactly one workflow update across replay", async () => {
  const identity = {messageGuid: randomUUID(), occurredAt: new Date().toISOString()};
  await message("Thanks, can you make the heading green?", identity);
  await processor().once();
  await message("Thanks, can you make the heading green?", identity);
  assert.equal(await processor().once(), false);
  let sends = 0;
  const delivery = createAutomationDelivery(database, async () => {
    sends++;
    return {state: "sent", messageId: "one-workflow-confirmation"};
  }, instance);
  assert.equal(await delivery.once(), true);
  assert.equal(await delivery.once(), false);
  assert.equal(sends, 1);
  assert.equal(await count("project_tasks"), 1);
  assert.equal(await count("automation_outbox", "state='sent' and text like '%Accepted%'"), 1);
});
test("clarification is connected to its existing request and consumes allowance only on acceptance", async () => {
  await message("Change the heading color");
  await processor((c) => ({
    intents: [
      intent(c, {
        payload: { color: null, locator: null, replacementText: null },
        missingFields: ["color"],
      }),
    ],
  })).once();
  assert.equal(await count("project_tasks"), 0);
  assert.equal(await count("automation_revision_uses"), 0);
  await message("Use green");
  await processor((c) => {
    assert.equal(c.unresolvedRequests.length, 1);
    return {
      intents: [
        intent(c, {
          intent: "clarification_answer",
          existingRequestId: c.unresolvedRequests[0].id,
        }),
      ],
    };
  }).once();
  assert.equal(await count("automation_requests"), 1);
  assert.equal(await count("project_tasks"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
  assert.equal(
    await count(
      "automation_requests",
      "revision=2 and clarification_turns=1 and state='accepted'",
    ),
    1,
  );
});
test("manual approval creates a real owner review with acknowledgment, no task or revision use", async () => {
  await changePolicy({ mode: "review_only", targets: [] });
  await pg.query("update projects set status='review_only' where id=$1", [
    project,
  ]);
  await message();
  await processor((c) => ({
    intents: [intent(c, { targetId: null, operation: null })],
  })).once();
  assert.equal(await count("owner_decisions", "reason='policy_denied'"), 1);
  assert.equal(await count("automation_outbox"), 1);
  assert.equal(await count("project_tasks"), 0);
});
test("exhausted allowance, capacity, scope additions, excluded policy and deadlines go to Needs Attention", async () => {
  await changePolicy({ allowance: 1 });
  await message();
  await processor().once();
  await message("Make the heading blue");
  await processor().once();
  assert.equal(
    await count("owner_decisions", "reason='exhausted_allowance'"),
    1,
  );
  await changePolicy({ allowance: 10, max_open_tasks: 1 });
  await message("Make the heading orange");
  await processor().once();
  assert.equal(await count("owner_decisions", "reason='policy_denied'"), 1);
  await message("Add a payments page");
  await processor((c) => ({
    intents: [
      intent(c, {
        scopeAssessment: "excluded",
        operation: null,
        targetId: null,
      }),
    ],
  })).once();
  assert.equal(await count("owner_decisions", "reason='scope_addition'"), 1);
  await message("Need it tomorrow");
  await processor((c) => ({
    intents: [intent(c, { requestsNewDeadline: true })],
  })).once();
  assert.equal(await count("owner_decisions", "reason='deadline_change'"), 1);
  assert.equal(await count("project_tasks"), 1);
});
test("mixed intents produce one clear reply; status comes from real tasks; casual conversation is silent", async () => {
  await message(
    "Make the heading green. Is it done? Also add a payments page.",
  );
  await processor((c) => ({
    intents: [
      intent(c),
      intent(c, { intent: "status_question", operation: null, targetId: null }),
      intent(c, {
        summary: "Add payments page",
        scopeAssessment: "excluded",
        operation: null,
        targetId: null,
      }),
    ],
  })).once();
  assert.equal(await count("automation_outbox"), 1);
  const reply = (
    await pg.query<{ text: string }>("select text from automation_outbox")
  ).rows[0].text;
  assert.match(reply, /Accepted/);
  assert.match(reply, /review queue/);
  assert.match(reply, /Which request or task/);
  await pg.exec("update project_tasks set status='done'");
  await message("Is the heading finished?");
  await processor((c) => ({
    intents: [intent(c, { intent: "status_question", taskId: c.tasks[0].id })],
  })).once();
  assert.equal(await count("automation_outbox", "text like '%completed%'"), 1);
  await message("Thanks!");
  await processor((c) => ({
    intents: [intent(c, { intent: "casual" })],
  })).once();
  assert.equal(await count("automation_outbox"), 2);
});
test("project reply controls disable optional sends and route missing details to review", async () => {
  await changePolicy({
    replies: {
      status_questions: false,
      clarifications: false,
      review_acknowledgments: false,
    },
  });
  await message("What color should the heading be?");
  await processor((c) => ({
    intents: [
      intent(c, {
        payload: { color: null, locator: null, replacementText: null },
        missingFields: ["color"],
      }),
    ],
  })).once();
  assert.equal(await count("owner_decisions"), 1);
  assert.equal(await count("automation_outbox"), 0);
  await message("Is it finished?");
  await processor((c) => ({
    intents: [intent(c, { intent: "status_question" })],
  })).once();
  assert.equal(await count("automation_outbox"), 0);
});
test("two clarification turns then owner review, no repeated question loop", async () => {
  for (let i = 0; i < 3; i++) {
    await message(i ? "I am not sure" : "Change the color");
    await processor((c) => ({
      intents: [
        intent(c, {
          intent: i ? "clarification_answer" : "new_request",
          existingRequestId: c.unresolvedRequests[0]?.id ?? null,
          payload: { color: null, locator: null, replacementText: null },
          missingFields: ["color"],
        }),
      ],
    })).once();
  }
  assert.equal(await count("automation_requests"), 1);
  assert.equal(await count("owner_decisions"), 1);
  assert.equal(await count("automation_revision_uses"), 0);
});
test("source mutations invalidate queued authorization and generate a review item", async () => {
  await message("Make heading green", { messageGuid: "mutable-message" });
  await message("Make heading blue", {
    messageGuid: "mutable-message",
    kind: "edit",
  });
  await processor().once();
  assert.equal(await count("project_tasks"), 0);
  assert.equal(
    await count("automation_jobs", "error_code='source_changed'"),
    1,
  );
  assert.equal(
    await count("owner_decisions", "reason='conflicting_request'"),
    1,
  );
});
test("unknown, unsupported, paused, owner echoes and preactivation never authorize work", async () => {
  await message("Old request", {
    occurredAt: new Date(Date.now() - 7200000).toISOString(),
  });
  await message("Owner text", { direction: "outbound" });
  await message("Unknown sender", { senderId: "unknown" });
  await processor().once();
  await message("Attachment", { contentType: "image" });
  await processor().once();
  await pg.query("update projects set status='paused' where id=$1", [project]);
  await message();
  await processor().once();
  assert.equal(await count("project_tasks"), 0);
  assert.equal(await count("owner_decisions"), 3);
  assert.equal(await count("automation_outbox"), 0);
});
test("versions changing during Gemini analysis reject stale commitments", async () => {
  await message();
  await processor(async (c) => {
    await pg.exec("update projects set version=version+1,status='paused'");
    return { intents: [intent(c)] };
  }).once();
  assert.equal(await count("project_tasks"), 0);
  assert.equal(await count("automation_outbox"), 0);
  assert.equal(
    await count(
      "automation_jobs",
      "state='queued' and error_code='stale_snapshot'",
    ),
    1,
  );
});

test("a recovered processing attempt clears the prior error and commits once", async () => {
  await message();
  await processor(async () => {
    throw new Error("transient_provider_failure");
  }).once();
  assert.equal(
    await count(
      "automation_jobs",
      "state='queued' and error_code='processing_failed'",
    ),
    1,
  );
  await pg.exec("update automation_jobs set available_at=now()");
  await processor().once();
  assert.equal(
    await count(
      "automation_jobs",
      "state='done' and error_code is null and attempts=2",
    ),
    1,
  );
  assert.equal(await count("project_tasks"), 1);
});
test("transaction failures roll back task, ledger and reply together; bounded failures escalate", async () => {
  await pg.exec(`create function fail_outbox() returns trigger language plpgsql as $$begin raise exception 'injected failure'; end$$;
    create trigger fail_outbox before insert on automation_outbox for each row execute function fail_outbox();`);
  try {
    await message();
    for (let i = 0; i < 3; i++) {
      await pg.exec("update automation_jobs set available_at=now()");
      await processor().once();
    }
    assert.equal(await count("project_tasks"), 0);
    assert.equal(await count("automation_revision_uses"), 0);
    assert.equal(
      await count("owner_decisions", "reason='failed_processing'"),
      1,
    );
  } finally {
    await pg.exec(
      "drop trigger fail_outbox on automation_outbox; drop function fail_outbox()",
    );
  }
});
test("delivery submits once, records real returned message ID, and uncertain sends become review items", async () => {
  await message();
  await processor().once();
  let sends = 0;
  const delivery = createAutomationDelivery(
    database,
    async (address, text) => {
      sends++;
      assert.equal(address, people.client_sender_id);
      assert.match(text, /Accepted/);
      return { state: "sent", messageId: "provider-reply" };
    },
    instance,
  );
  assert.equal(await delivery.once(), true);
  assert.equal(await delivery.once(), false);
  assert.equal(sends, 1);
  assert.equal(
    await count(
      "automation_outbox",
      "state='sent' and provider_guid='provider-reply'",
    ),
    1,
  );
  await message();
  await processor().once();
  const unknown = createAutomationDelivery(
    database,
    async () => ({ state: "unknown" }),
    instance,
  );
  assert.equal(await unknown.once(), true);
  assert.equal(await unknown.once(), false);
  assert.equal(await count("owner_decisions", "reason='delivery_unknown'"), 1);
});
test("interrupted sending is never automatically resent, and paused projects hold queued replies", async () => {
  await message();
  await processor().once();
  await pg.exec(
    "update automation_outbox set state='sending',lease_until=now()-interval '1 second'",
  );
  let sends = 0;
  const delivery = createAutomationDelivery(
    database,
    async () => {
      sends++;
      return { state: "unknown" };
    },
    instance,
  );
  await delivery.once();
  assert.equal(sends, 0);
  assert.equal(await count("automation_outbox", "state='unknown'"), 1);
  await message();
  await processor().once();
  await pg.exec("update projects set status='paused'");
  await delivery.once();
  assert.equal(sends, 0);
});
test("browser RLS cannot read another owner's automation or write acceptance records", async () => {
  await message();
  await processor().once();
  await pg.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      randomUUID(),
    ]);
    await tx.exec("set local role authenticated");
    assert.equal(
      (await tx.query("select * from automation_requests")).rows.length,
      0,
    );
    assert.equal(
      (await tx.query("select * from automation_outbox")).rows.length,
      0,
    );
  });
  await assert.rejects(
    pg.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.exec("delete from automation_revision_uses");
    }),
    /permission denied/,
  );
});

async function asOwner<T>(run: () => Promise<T>) {
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  await pg.exec("set role authenticated");
  try {
    return await run();
  } finally {
    await pg.exec("reset role");
  }
}
test("owner resolves review once, authorizes a task and queues a separate resolution reply", async () => {
  await changePolicy({ mode: "review_only" });
  await message();
  await processor().once();
  const decision = (
    await pg.query<{ id: string }>("select id from owner_decisions")
  ).rows[0].id;
  const key = randomUUID();
  await asOwner(async () => {
    const args = [
      decision,
      "approve",
      "Extra revision approved by owner",
      "I have approved this change.",
      key,
    ];
    const command = () =>
      pg.query("select automation_review_command($1,$2,$3,$4,$5) result", args);
    const result = await command();
    assert.deepEqual(await command(), result);
    await assert.rejects(
      pg.query(
        "select automation_review_command($1,'approve','Another note','',$2)",
        [decision, randomUUID()],
      ),
      /already resolved/,
    );
  });
  assert.equal(await count("project_tasks"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
  assert.equal(await count("automation_outbox"), 2);
  assert.equal(await count("owner_decisions", "status='resolved'"), 1);
});
test("approval without a private note commits the task, revision, audit and one idempotent confirmation", async () => {
  await changePolicy({ mode: "review_only" });
  await message();
  await processor().once();
  const decision = (await pg.query<{ id: string }>("select id from owner_decisions")).rows[0].id;
  const key = randomUUID();
  await asOwner(async () => {
    const run = () => pg.query("select resolve_automation_review($1,'approve','','',$2,null) result", [decision, key]);
    const first = await run();
    assert.deepEqual(await run(), first);
  });
  assert.equal(await count("project_tasks", "authorized_by='Owner approval: Accepted by owner'"), 1);
  assert.equal(await count("automation_requests", "state='accepted' and task_id is not null"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
  assert.equal(await count("owner_decisions", "status='resolved' and internal_note='Accepted by owner'"), 1);
  assert.equal(await count("audit_events", "action='automation:review:approve' and details->>'note'='Accepted by owner'"), 1);
  assert.equal(await count("automation_outbox", "purpose like 'resolution:%' and text like '%approved and added%'"), 1);
});
test("owner can decline without revision usage; another account cannot resolve a decision", async () => {
  await changePolicy({ mode: "review_only" });
  await message();
  await processor().once();
  const decision = (
    await pg.query<{ id: string }>("select id from owner_decisions")
  ).rows[0].id;
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
    randomUUID(),
  ]);
  await pg.exec("set role authenticated");
  try {
    await assert.rejects(
      pg.query(
        "select automation_review_command($1,'approve','Approve work','',$2)",
        [decision, randomUUID()],
      ),
    );
  } finally {
    await pg.exec("reset role");
  }
  await asOwner(() =>
    pg.query(
      "select automation_review_command($1,'decline','Outside the agreed scope','',$2)",
      [decision, randomUUID()],
    ),
  );
  assert.equal(await count("project_tasks"), 0);
  assert.equal(await count("automation_revision_uses"), 0);
  assert.equal(await count("automation_requests", "state='closed'"), 1);
});
test("owner task status updates drive answers and reject stale edits without refunding revisions", async () => {
  await message();
  await processor().once();
  const task = (
    await pg.query<{ id: string; updated_at: Date }>(
      "select id,updated_at from project_tasks",
    )
  ).rows[0];
  await asOwner(async () => {
    await pg.query(
      "select automation_task_status($1,'done',$2,'Updated the heading color')",
      [task.id, task.updated_at],
    );
    await assert.rejects(
      pg.query(
        "select automation_task_status($1,'cancelled',$2,'Cancel old version')",
        [task.id, task.updated_at],
      ),
      /changed/,
    );
  });
  await message("Is the heading finished?");
  await processor((c) => ({
    intents: [intent(c, { intent: "status_question", taskId: task.id })],
  })).once();
  assert.equal(await count("automation_outbox", "text like '%completed%'"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
});

test("failed AI interpretation retains an approvable request and precise safe diagnostics", async () => {
  await message("Please change the heading to blue");
  const failed = processor(async () => {
    throw new Error("interpretation_requires_owner_review");
  });
  for (let i = 0; i < 3; i++) {
    await pg.exec("update automation_jobs set available_at=now()");
    await failed.once();
  }
  assert.equal(
    await count(
      "automation_jobs",
      "state='failed' and error_code='interpretation_invalid'",
    ),
    1,
  );
  const decision = (
    await pg.query<{
      id: string;
      automation_request_id: string;
      source_job_id: string;
    }>("select * from owner_decisions")
  ).rows[0];
  assert.ok(decision.automation_request_id);
  assert.ok(decision.source_job_id);
  await pg.query(
    "select ensure_failed_request_review($1,'interpretation_invalid')",
    [decision.source_job_id],
  );
  assert.equal(await count("automation_requests"), 1);
  await asOwner(() =>
    pg.query(
      "select resolve_automation_review($1,'approve','I reviewed the source and authorize this change','',$2,'Change heading to blue')",
      [decision.id, randomUUID()],
    ),
  );
  assert.equal(
    await count("project_tasks", "title='Change heading to blue'"),
    1,
  );
  assert.equal(
    await count(
      "automation_outbox",
      "purpose like 'resolution:%' and text like '%has been approved%'",
    ),
    1,
  );
});

test("delete removes the review without erasing its source or authorizing a task", async () => {
  await changePolicy({ mode: "review_only" });
  await message();
  await processor().once();
  const decision = (
    await pg.query<{ id: string }>("select id from owner_decisions")
  ).rows[0].id;
  const key = randomUUID();
  await asOwner(async () => {
    const args = [decision, key];
    const first = await pg.query(
      "select resolve_automation_review($1,'delete','','',$2,null) result",
      args,
    );
    assert.deepEqual(
      await pg.query(
        "select resolve_automation_review($1,'delete','','',$2,null) result",
        args,
      ),
      first,
    );
  });
  assert.equal(
    await count(
      "owner_decisions",
      "deleted_at is not null and status='dismissed'",
    ),
    1,
  );
  assert.equal(await count("automation_requests", "state='closed'"), 1);
  assert.equal(await count("automation_messages"), 1);
  assert.equal(await count("project_tasks"), 0);
  assert.equal(
    await count("audit_events", "action='automation:review:delete'"),
    1,
  );
});

test("manual review-only policy still understands color requests with empty permissions", async () => {
  await changePolicy({ mode: "review_only", operations: [] });
  await message();
  await processor((c) => ({
    intents: [
      intent(c, {
        payload: { color: "blue", locator: "heading", replacementText: null },
      }),
    ],
  })).once();
  assert.equal(await count("automation_jobs", "state='done'"), 1);
  assert.equal(await count("owner_decisions", "reason='policy_denied'"), 1);
  assert.equal(await count("project_tasks"), 0);
  await message("What is happening with the heading?");
  await processor((c) => ({
    intents: [
      intent(c, {
        intent: "status_question",
        operation: null,
        targetId: null,
        statusRequestId: c.requestStatuses![0].id,
      }),
    ],
  })).once();
  assert.equal(
    await count(
      "automation_outbox",
      "text like '%awaiting the project owner%'",
    ),
    1,
  );
});

test("diagnostics distinguish provider setup from invalid AI output without leaking content", () => {
  assert.equal(
    processingErrorCode({ status: 401, message: "SECRET" }),
    "gemini_authentication_failed",
  );
  assert.equal(
    processingErrorCode({ status: 429, message: "SECRET" }),
    "gemini_rate_limited",
  );
  assert.equal(
    processingErrorCode(new Error("interpretation_requires_owner_review")),
    "interpretation_invalid",
  );
  assert.ok(!processingErrorLabel("SECRET").includes("SECRET"));
});

async function ownerCommand(action:string,payload:Record<string,unknown>,key=randomUUID()) {
 return asOwner(()=>pg.query<{result:{id:string}}>("select automation_owner_command($1,$2,$3,$4) result",[project,action,JSON.stringify({reason:"Owner checked the project",...payload}),key]));
}
test("progress updates are transactional, optional and never contain private status notes",async()=>{
 await changePolicy({replies:{status_questions:true,clarifications:true,review_acknowledgments:true,progress_updates:true}});
 await message();await processor().once();
 const t=(await pg.query<{id:string;updated_at:Date}>("select id,updated_at from project_tasks")).rows[0];
 await asOwner(()=>pg.query("select automation_task_status($1,'blocked',$2,'PRIVATE missing credentials')",[t.id,t.updated_at]));
 assert.equal(await count("automation_outbox","purpose like 'progress:%'"),1);
 assert.equal(await count("automation_outbox","text like '%PRIVATE%'"),0);
 await assert.rejects(asOwner(()=>pg.query("select automation_task_status($1,'done',$2,'')",[t.id,t.updated_at])),/changed/);
});
test("queued reply controls reject stale edits and uncertainty requires explicit non-delivery confirmation",async()=>{
 await message();await processor().once();
 let o=(await pg.query<{id:string;updated_at:Date}>("select id,updated_at from automation_outbox")).rows[0];
 await ownerCommand('outbox_edit',{id:o.id,expectedUpdatedAt:o.updated_at,text:'Owner reviewed confirmation'});
 await assert.rejects(ownerCommand('outbox_cancel',{id:o.id,expectedUpdatedAt:o.updated_at}),/changed/);
 const delivery=createAutomationDelivery(database,async()=>({state:'unknown'}),instance);await delivery.once();
 o=(await pg.query<{id:string;updated_at:Date}>("select id,updated_at from automation_outbox")).rows[0];
 await assert.rejects(ownerCommand('outbox_retry',{id:o.id,expectedUpdatedAt:o.updated_at}),/confirm non-delivery/);
 await ownerCommand('outbox_retry',{id:o.id,expectedUpdatedAt:o.updated_at,confirmedNotDelivered:true});
 assert.equal(await count('automation_outbox',"state='queued' and retry_of is not null"),1);
 assert.equal(await count('automation_outbox',"state='cancelled'"),1);
});
test("receipt reconciliation is service-only and rejects an old or mismatched receipt",async()=>{
 await message();await processor().once();await createAutomationDelivery(database,async()=>({state:'unknown'}),instance).once();
 const o=(await pg.query<{id:string;text:string;attempt_started_at:Date}>('select * from automation_outbox')).rows[0];
 await assert.rejects(asOwner(()=>pg.query("select reconcile_automation_reply($1,'receipt',$2,$3,$4,$5)",[o.id,o.text,o.attempt_started_at,instance,chat])),/permission denied/);
 await assert.rejects(pg.query("select reconcile_automation_reply($1,'receipt','different',$2,$3,$4)",[o.id,o.attempt_started_at,instance,chat]),/does not match/);
 await pg.query("select reconcile_automation_reply($1,'receipt',$2,$3,$4,$5)",[o.id,o.text,o.attempt_started_at,instance,chat]);
 assert.equal(await count('automation_outbox',"state='sent' and provider_guid='receipt'"),1);
});
test("owner retry archives failed analysis and cannot duplicate committed work",async()=>{
 await message();const broken=processor(()=>{throw new Error('unavailable');});
 for(let i=0;i<3;i++){await pg.exec("update automation_jobs set available_at=now()");await broken.once();}
 const job=(await pg.query<{id:string}>('select id from automation_jobs')).rows[0];
 const key=randomUUID();await ownerCommand('retry_analysis',{id:job.id},key);await processor().once();
 await ownerCommand('retry_analysis',{id:job.id},key);
 await assert.rejects(ownerCommand('retry_analysis',{id:job.id}),/Only unresolved/);
 assert.equal(await count('project_tasks'),1);assert.equal(await count('automation_revision_uses'),1);
 assert.equal(await count('audit_events',"action='automation:analysis_archive'"),1);
});
test("client cancellation changes the existing task without another task or silent refund",async()=>{
 await message();await processor().once();
 const t=(await pg.query<{id:string;updated_at:Date}>('select id,updated_at from project_tasks')).rows[0];
 await message('Cancel the heading change');await processor(c=>({intents:[intent(c,{intent:'cancellation',taskId:t.id})]})).once();
 const r=(await pg.query<{id:string;decision_id:string}>("select id,decision_id from automation_requests where state='owner_review'")).rows[0];
 await assert.rejects(asOwner(()=>pg.query("select resolve_automation_review($1,'approve','','',$2,null)",[r.decision_id,randomUUID()])),/existing task/);
 await ownerCommand('apply_task_change',{requestId:r.id,taskId:t.id,expectedUpdatedAt:t.updated_at});
 assert.equal(await count('project_tasks'),1);assert.equal(await count('project_tasks',"status='cancelled'"),1);assert.equal(await count('automation_revision_uses'),1);
 const original=(await pg.query<{request_id:string}>('select request_id from automation_revision_uses')).rows[0];
 await ownerCommand('refund_request',{id:original.request_id});
 assert.equal(await count('automation_revision_refunds'),1);
});
test("feedback rounds are explicit batches with idempotent membership, consumption and separate refunds",async()=>{
 await changePolicy({mode:'review_only',allowance_mode:'manual_rounds'});await message();await processor().once();
 const r=(await pg.query<{id:string;decision_id:string}>('select id,decision_id from automation_requests')).rows[0];
 await asOwner(()=>pg.query("select resolve_automation_review($1,'approve','','',$2,null)",[r.decision_id,randomUUID()]));
 const round=(await ownerCommand('round_open',{})).rows[0].result.id;
 await assert.rejects(ownerCommand('round_open',{}),/unique/);
 const key=randomUUID();await ownerCommand('round_add',{id:round,requestId:r.id},key);await ownerCommand('round_add',{id:round,requestId:r.id},key);
 await ownerCommand('round_close',{id:round});await ownerCommand('round_refund',{id:round});
 assert.equal(await count('automation_round_members'),1);assert.equal(await count('automation_rounds',"state='closed'"),1);assert.equal(await count('automation_round_refunds'),1);assert.equal(await count('automation_revision_uses'),0);
});
test("policy amendments are versioned and preserve usage while refunds explicitly restore allowance",async()=>{
 await message();await processor().once();
 await ownerCommand('amend_policy',{expectedVersion:1,policy:{...policy,mode:'review_only'}});
 assert.equal(await count('policy_versions','version=2'),1);assert.equal(await count('automation_revision_uses'),1);
 await assert.rejects(ownerCommand('amend_policy',{expectedVersion:1,policy}),/changed/);
 await assert.rejects(ownerCommand('amend_policy',{expectedVersion:2,policy:{...policy,mode:'review_only',allowance_mode:'manual_rounds'}}),/Accounting mode/);
});
test("status lookup retrieves an older matching task outside the last twenty updated tasks",async()=>{
 await message('Change the unique albatross heading');await processor(c=>({intents:[intent(c,{summary:'Unique albatross heading'})]})).once();
 await pg.exec("update project_tasks set status='done',updated_at=now()-interval '1 year'");
 for(let i=0;i<25;i++) await pg.query("insert into project_tasks(project_id,task_code,title,origin) values($1,$2,$3,'manual')",[project,`OTHER-${i}`,`Recent unrelated job ${i}`]);
 await message('Is the albatross heading finished?');
 await processor(c=>{const t=c.tasks.find(t=>t.title==='Unique albatross heading');assert.ok(t);return {intents:[intent(c,{intent:'status_question',taskId:t.id})]};}).once();
 assert.equal(await count('automation_outbox',"text like '%albatross%completed%'"),1);
});

test("a signed Photon event triggers processing and one reply immediately without a history poll",async()=>{
 const {createHmac}=await import('node:crypto');
 const {createSpectrumWebhookDecoder}=await import('../../lib/photon/webhook');
 const {createWebhookHandler}=await import('../../lib/assistant/webhook-handler');
 const secret='test-signing-secret';const timestamp=String(Math.floor(Date.now()/1000));
 const text='Make the heading green';const body=JSON.stringify({event:'messages',space:{id:chat},message:{id:'pushed-provider-message',sender:{id:people.client_sender_id},direction:'inbound',timestamp:new Date().toISOString(),content:{type:'text',text}}});
 const signature='v0='+createHmac('sha256',secret).update(`v0:${timestamp}:`).update(body).digest('hex');
 let sends=0;const scheduled:Promise<unknown>[]=[];
 const handler=createWebhookHandler(()=>({decoder:createSpectrumWebhookDecoder({signingSecret:secret,instanceId:instance}),inbox:createProjectAutomationInbox(database),onCommitted:()=>{
  scheduled.push((async()=>{await processor().once(project);await createAutomationDelivery(database,async()=>{sends++;return {state:'sent',messageId:'push-response'};},instance).once(project);})());
 }}));
 const request=()=>new Request('https://owner.test/api/webhook',{method:'POST',headers:{'x-spectrum-timestamp':timestamp,'x-spectrum-signature':signature},body});
 assert.equal((await handler(request())).status,200);await Promise.all(scheduled);
 assert.equal(sends,1);assert.equal(await count('project_tasks'),1);
 assert.equal((await handler(request())).status,200);await Promise.all(scheduled);assert.equal(sends,1);
 assert.equal((await handler(new Request('https://owner.test/api/webhook',{method:'POST',body}))).status,401);
 assert.equal(scheduled.length,2);
});
test("SDK intake shares task/reply deduplication with signed webhooks and history during cutover", async () => {
  const { normalizeSpectrumSdkMessage } = await import("../../lib/photon/sdk-listener");
  const { createSpectrumWebhookDecoder } = await import("../../lib/photon/webhook");
  const { createHmac } = await import("node:crypto");
  const space = { id: chat, __platform: "imessage" };
  const at = new Date();
  const payload = { id: "shared-provider-guid", platform: "imessage", space,
    sender: { id: people.client_sender_id }, direction: "inbound", timestamp: at,
    content: { type: "text", text: "Make the heading green" } };
  const inbox = createProjectAutomationInbox(database);
  await inbox.persistVerifiedEvent(normalizeSpectrumSdkMessage(instance, space, payload)!);
  await processor().once(project);
  let sends = 0;
  const delivery = createAutomationDelivery(database, async () => {
    sends++; return { state: "sent", messageId: "sdk-reply-guid" };
  }, instance);
  await delivery.once(project);
  assert.equal(await count("project_tasks"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
  assert.equal(sends, 1);
  assert.equal(await count("chat_bindings", "webhook_verified_at is not null"), 0);

  const body = JSON.stringify({ event: "messages", space: { id: chat }, message: { ...payload, timestamp: at.toISOString() } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = "test-secret";
  const headers = new Headers({ "x-spectrum-timestamp": timestamp,
    "x-spectrum-signature": "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:`).update(body).digest("hex") });
  const webhook = await createSpectrumWebhookDecoder({ instanceId: instance, signingSecret: secret }).verifyAndNormalize(new TextEncoder().encode(body), headers);
  assert.equal((await inbox.persistVerifiedEvent(webhook)).duplicate, true);
  assert.equal((await message(payload.content.text, { messageGuid: payload.id, eventKey: "history:cutover", occurredAt: at.toISOString() })).duplicate, true);
  assert.equal(await processor().once(project), false);
  assert.equal(await delivery.once(project), false);
  assert.equal(await count("project_tasks"), 1);
  assert.equal(await count("automation_revision_uses"), 1);
  assert.equal(await count("automation_outbox"), 1);
  assert.equal(sends, 1);
  assert.equal(await count("chat_bindings", "webhook_verified_at is not null"), 1);
});

test("SDK thanks stays silent and unknown participants still require owner review", async () => {
  const { normalizeSpectrumSdkMessage } = await import("../../lib/photon/sdk-listener");
  const space = { id: chat, __platform: "imessage" };
  const base = { id: "sdk-thanks", platform: "imessage", space, direction: "inbound",
    timestamp: new Date(), sender: { id: people.client_sender_id }, content: { type: "text", text: "Thanks!" } };
  const inbox = createProjectAutomationInbox(database);
  await inbox.persistVerifiedEvent(normalizeSpectrumSdkMessage(instance, space, base)!);
  assert.equal(await processor().once(), false);
  assert.equal(await count("automation_outbox"), 0);
  await inbox.persistVerifiedEvent(normalizeSpectrumSdkMessage(instance, space, {
    ...base, id: "sdk-unknown", sender: undefined, content: { type: "text", text: "Make the heading green" },
  })!);
  await processor().once();
  assert.equal(await count("project_tasks"), 0);
  assert.equal(await count("owner_decisions", "reason='unknown_participant'"), 1);
});

test("an owner retry that fails again re-opens its preserved review",async()=>{
 await message();const broken=processor(()=>{throw new Error('failure');});
 for(let i=0;i<3;i++){await pg.exec("update automation_jobs set available_at=now()");await broken.once();}
 await createAutomationDelivery(database,async()=>({state:'sent',messageId:'initial-review-ack'}),instance).once();
 const j=(await pg.query<{id:string}>('select id from automation_jobs')).rows[0];await ownerCommand('retry_analysis',{id:j.id});
 for(let i=0;i<3;i++){await pg.exec("update automation_jobs set available_at=now()");await broken.once();}
 assert.equal(await count('owner_decisions',"status='open' and automation_request_id is not null"),1);
 assert.equal(await count('automation_outbox'),1);
});
test("a reviewed correction updates the existing title and value with stale-write protection",async()=>{
 await message();await processor().once();const t=(await pg.query<{id:string;updated_at:Date}>('select id,updated_at from project_tasks')).rows[0];
 await message('Use blue instead of green');await processor(c=>({intents:[intent(c,{intent:'correction',taskId:t.id,payload:{color:'blue',locator:null,replacementText:null}})]})).once();
 const r=(await pg.query<{id:string}>("select id from automation_requests where state='owner_review'")).rows[0];
 await ownerCommand('apply_task_change',{requestId:r.id,taskId:t.id,expectedUpdatedAt:t.updated_at,title:'Make heading blue',value:'blue'});
 assert.equal(await count('project_tasks'),1);assert.equal(await count('project_tasks',"value='blue' and title='Make heading blue'"),1);assert.equal(await count('automation_revision_uses'),1);
 await assert.rejects(ownerCommand('apply_task_change',{requestId:r.id,taskId:t.id,expectedUpdatedAt:t.updated_at,title:'Stale',value:'red'}),/unavailable/);
});
test("explicit refunds restore automatic allowance without deleting ledger history",async()=>{
 await changePolicy({allowance:1});await message();await processor().once();
 const r=(await pg.query<{request_id:string}>('select request_id from automation_revision_uses')).rows[0];
 await ownerCommand('refund_request',{id:r.request_id});await message('Make the heading blue');await processor().once();
 assert.equal(await count('project_tasks'),2);assert.equal(await count('automation_revision_uses'),2);assert.equal(await count('automation_revision_refunds'),1);
});
test("new owner commands and accounting records remain private to the project owner",async()=>{
 await message();await processor().once();
 await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[randomUUID()]);await pg.exec('set role authenticated');
 try {await assert.rejects(pg.query("select automation_owner_command($1,'round_open',$2,$3)",[project,JSON.stringify({reason:'Unauthorized account'}),randomUUID()]));
 assert.equal(await count('automation_runtime_health'),0);assert.equal(await count('automation_revision_refunds'),0);
 await assert.rejects(pg.query('select automation_accounting($1)',[project]));
 }finally{await pg.exec('reset role');}
});
const guidancePolicy = { ...policy, permission_mode: "guidance", acceptance_guidance: "Accept small layout and spacing changes covered by the agreement.", operations: [], targets: [] };
async function layoutScope() {
  await pg.query("update scope_versions set terms=$2 where project_id=$1", [project,JSON.stringify([{kind:"inclusion",text:"Spacing and layout adjustments are included."}])]);
}
function layoutIntent(c: InterpretationContext, patch: Partial<Interpretation["intents"][number]> = {}) {
  return intent(c,{operation:"project_change",targetId:null,summary:"Increase homepage heading spacing to 24px",policyAssessment:"allowed",
    payload:{color:null,locator:null,replacementText:null,targetDescription:"Homepage heading",instructions:"Increase homepage heading spacing to 24px"},
    scopeEvidence:[{scopeItemId:"scope-0",quote:"layout adjustments"}],...patch});
}
test("guidance policy saves with no operation selection or targets and activates only after disclosure", async () => {
  await pg.exec("update projects set status='draft',activation_cutoff=null,policy_version=0,policy=null;delete from policy_versions;");
  const key=randomUUID();
  const save=()=>asOwner(()=>pg.query<{result:{project:{version:number}}}>("select onboarding_command($1,1,'policy',$2,$3) result",[project,JSON.stringify(guidancePolicy),key]));
  const first=await save();assert.equal((await save()).rows[0].result.project.version,first.rows[0].result.project.version);
  const version=first.rows[0].result.project.version;
  await assert.rejects(asOwner(()=>pg.query("select onboarding_command($1,$2,'lifecycle',$3,$4)",[project,version,JSON.stringify({status:"active",reason:"Reviewed setup",disclosed:false}),randomUUID()])),/agreed/);
  await asOwner(()=>pg.query("select onboarding_command($1,$2,'lifecycle',$3,$4)",[project,version,JSON.stringify({status:"active",reason:"Reviewed setup",disclosed:true}),randomUUID()]));
  assert.equal(await count("projects","status='active' and policy->>'permission_mode'='guidance'"),1);
  assert.equal(await count("policy_versions"),1);
});
test("guidance creates a real general-change task without invented target identifiers", async () => {
  await changePolicy(guidancePolicy);await layoutScope();await message("Increase homepage heading spacing to 24px");
  await processor(c=>{
    assert.equal(c.permissionMode,"guidance");assert.equal(c.acceptanceGuidance,guidancePolicy.acceptance_guidance);assert.equal(c.targets.length,0);
    return {intents:[layoutIntent(c)]};
  }).once();
  assert.equal(await count("project_tasks","operation='project_change' and target_id='Homepage heading' and value='Increase homepage heading spacing to 24px'"),1);
  assert.equal(await count("automation_revision_uses"),1);assert.equal(await count("automation_outbox"),1);
});
test("uncertain guidance and excluded scope still require review even with automatic acceptance enabled", async () => {
  await changePolicy(guidancePolicy);await layoutScope();await message("Increase homepage heading spacing to 24px");
  await processor(c=>({intents:[layoutIntent(c,{policyAssessment:"uncertain"})]})).once();
  assert.equal(await count("owner_decisions","reason='policy_denied'"),1);
  await message("Add a new payments page");
  await processor(c=>({intents:[layoutIntent(c,{scopeAssessment:"excluded",policyAssessment:"allowed"})]})).once();
  assert.equal(await count("owner_decisions","reason='scope_addition'"),1);assert.equal(await count("project_tasks"),0);assert.equal(await count("automation_revision_uses"),0);
});
test("guidance does not remove revision or manual-review safeguards", async () => {
  await changePolicy({...guidancePolicy,allowance:1});await layoutScope();
  await message("Increase homepage heading spacing to 24px");await processor(c=>({intents:[layoutIntent(c)]})).once();
  await message("Increase homepage heading spacing to 32px");await processor(c=>({intents:[layoutIntent(c)]})).once();
  assert.equal(await count("project_tasks"),1);assert.equal(await count("owner_decisions","reason='exhausted_allowance'"),1);
  await changePolicy({mode:"review_only"});await message("Increase homepage heading spacing to 40px");await processor(c=>({intents:[layoutIntent(c)]})).once();
  assert.equal(await count("project_tasks"),1);
});
test("activated policy amendments support guidance while preserving accounting", async () => {
  await message();await processor().once();
  await ownerCommand("amend_policy",{expectedVersion:1,policy:guidancePolicy});
  assert.equal(await count("policy_versions","version=2 and policy->>'permission_mode'='guidance'"),1);
  assert.equal(await count("automation_revision_uses"),1);
  await assert.rejects(ownerCommand("amend_policy",{expectedVersion:2,policy:{...guidancePolicy,acceptance_guidance:""}}),/guidance/);
});
test("owner approval of a general request preserves instructions and its descriptive target", async () => {
  await changePolicy({...guidancePolicy,mode:"review_only"});await layoutScope();await message("Increase homepage heading spacing to 24px");
  await processor(c=>({intents:[layoutIntent(c)]})).once();
  const d=(await pg.query<{decision_id:string}>("select decision_id from automation_requests")).rows[0];
  await asOwner(()=>pg.query("select resolve_automation_review($1,'approve','','',$2,null)",[d.decision_id,randomUUID()]));
  assert.equal(await count("project_tasks","operation='project_change' and target_id='Homepage heading' and value='Increase homepage heading spacing to 24px'"),1);
});
test("project deletion cascades new round accounting and runtime records",async()=>{
 await changePolicy({mode:'review_only',allowance_mode:'manual_rounds'});await message();await processor().once();
 const r=(await pg.query<{id:string;decision_id:string}>('select id,decision_id from automation_requests')).rows[0];
 await asOwner(()=>pg.query("select resolve_automation_review($1,'approve','','',$2,null)",[r.decision_id,randomUUID()]));
 const round=(await ownerCommand('round_open',{})).rows[0].result.id;await ownerCommand('round_add',{id:round,requestId:r.id});await ownerCommand('round_close',{id:round});await ownerCommand('round_refund',{id:round});
 await pg.query('insert into automation_runtime_health(project_id) values($1)',[project]);
 await asOwner(()=>pg.query("select delete_project($1,'Website')",[project]));
 for(const table of ['projects','automation_requests','automation_outbox','automation_rounds','automation_round_members','automation_round_refunds','automation_runtime_health'])assert.equal(await count(table),0);
});
