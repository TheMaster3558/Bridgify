import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
let db: PGlite;
const owner = crypto.randomUUID(),
  other = crypto.randomUUID(),
  org = crypto.randomUUID(),
  otherOrg = crypto.randomUUID();
const fix = "202610170013_project_deletion_automation.sql";
async function admin() {
  await db.exec("reset role");
}
async function user(id = owner) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function seed(organization = org, actor = owner) {
  await admin();
  const p = crypto.randomUUID(),
    doc = crypto.randomUUID(),
    event = crypto.randomUUID(),
    message = crypto.randomUUID(),
    job = crypto.randomUUID(),
    request = crypto.randomUUID(),
    task = crypto.randomUUID(),
    decision = crypto.randomUUID();
  await db.query(
    `insert into projects(id,organization_id,owner_id,name,client_name,original_amount_cents,timezone,status,scope_version,policy_version,people,policy,activation_cutoff) values($1,$2,$3,'Website','Client',50000,'UTC','active',1,1,'{}','{"mode":"enabled"}',now())`,
    [p, organization, actor],
  );
  await db.query(
    "insert into documents(id,project_id,kind,storage_path,status) values($1,$2,'pdf',$3,'ready')",
    [doc, p, `${p}/agreement.pdf`],
  );
  await db.query(
    "update projects set current_agreement_document_id=$1 where id=$2",
    [doc, p],
  );
  await db.query(
    "insert into document_spans values(gen_random_uuid(),$1,1,0,10,'Agreement')",
    [doc],
  );
  await db.query(
    "insert into scope_versions(project_id,version,document_id,terms,confirmed_by) values($1,1,$2,'[]',$3)",
    [p, doc, actor],
  );
  await db.query(
    "insert into policy_versions(project_id,version,policy,confirmed_by) values($1,1,'{}',$2)",
    [p, actor],
  );
  await db.query("insert into jobs(document_id) values($1)", [doc]);
  await db.query(
    "insert into audit_events(project_id,actor_id,action) values($1,$2,'lifecycle:active')",
    [p, actor],
  );
  await db.query(
    "insert into automation_events(id,project_id,instance_id,event_key,fingerprint,event,disposition) values($1,$2,'instance',$3,'fingerprint','{}','queued')",
    [event, p, event],
  );
  await db.query(
    "insert into automation_messages(id,project_id,event_id,provider_guid,role,text,occurred_at) values($1,$2,$3,$4,'requester','Please update the heading',now())",
    [message, p, event, message],
  );
  await db.query(
    "insert into automation_jobs(id,project_id,event_id,message_id) values($1,$2,$3,$4)",
    [job, p, event, message],
  );
  await db.query(
    "insert into project_tasks(id,project_id,task_code,title,origin) values($1,$2,'T-1','Update heading','auto')",
    [task, p],
  );
  await db.query(
    "insert into owner_decisions(id,project_id,decision_code,request_code,reason,title,source_job_id) values($1,$2,'D-1','R-1','scope_addition','Review request',$3)",
    [decision, p, job],
  );
  await db.query(
    "insert into automation_requests(id,project_id,job_id,ordinal,state,summary,intent,source_ids,task_id,decision_id) values($1,$2,$3,1,'accepted','Update heading','{}','[]',$4,$5)",
    [request, p, job, task, decision],
  );
  await db.query(
    "update owner_decisions set automation_request_id=$1 where id=$2",
    [request, decision],
  );
  await db.query(
    "insert into automation_revision_uses(request_id,project_id,policy_version,scope_version) values($1,$2,1,1)",
    [request, p],
  );
  await db.query(
    "insert into automation_outbox(project_id,job_id,instance_id,chat_guid,address,text) values($1,$2,'instance','chat','+14155550100','Accepted')",
    [p, job],
  );
  await db.query(
    "insert into command_receipts values($1,$2,'fingerprint',$3)",
    [
      actor,
      `review-${p}`,
      JSON.stringify({ decisionId: decision, taskId: task, action: "approve" }),
    ],
  );
  return { p, doc, job };
}
const projectTables = [
  "projects",
  "documents",
  "scope_versions",
  "policy_versions",
  "audit_events",
  "project_tasks",
  "owner_decisions",
  "automation_events",
  "automation_messages",
  "automation_jobs",
  "automation_requests",
  "automation_revision_uses",
  "automation_outbox",
];
async function rows(table: string, p: string) {
  return (
    await db.query(
      `select * from ${table} where ${table === "projects" ? "id" : "project_id"}=$1`,
      [p],
    )
  ).rows;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;`,
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql") && n !== fix)
    .sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query(
    "insert into auth.users values($1,'owner@example.test',now()),($2,'other@example.test',now())",
    [owner, other],
  );
  await db.query(
    "insert into organizations(id,name) values($1,'Workspace'),($2,'Other workspace')",
    [org, otherOrg],
  );
  await db.query(
    "insert into organization_members values($1,$2,'owner'),($3,$4,'owner')",
    [org, owner, otherOrg, other],
  );
});
afterAll(async () => {
  await db?.close();
});

async function draftConnection(
  name: string,
  address: string,
  actor = owner,
  organization = org,
  instance = "reconnect-instance",
) {
  await admin();
  const id = crypto.randomUUID();
  await db.query(
    `insert into projects(id,organization_id,owner_id,name,client_name,original_amount_cents,timezone,people)
    values($1,$2,$3,$4,'Client',1000,'UTC',$5)`,
    [
      id,
      organization,
      actor,
      name,
      JSON.stringify({
        channel: "photon_shared",
        instance_id: instance,
        chat_guid: `any;-;${address}`,
        client_sender_id: address,
      }),
    ],
  );
  await user(actor);
  return id;
}
async function beginIntroduction(id: string, address: string) {
  return db.query("select begin_chat_test($1,1,$2::jsonb,'hash')", [
    id,
    JSON.stringify([address]),
  ]);
}

describe("active-project deletion with the full deployed automation schema", () => {
  it("reproduces the old FK failure and upgrades deletion without replaying migrations or losing other projects", async () => {
    const target = await seed(),
      untouched = await seed(otherOrg, other);
    await user();
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).rejects.toMatchObject({ code: "23503" });
    await admin();
    for (const table of projectTables)
      expect(await rows(table, target.p)).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from project_deletion_cleanup where project_id=$1",
          [target.p],
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(await readFile(`supabase/migrations/${fix}`, "utf8"));
    await user(other);
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).rejects.toMatchObject({ code: "42501" });
    await user();
    await expect(
      db.query("select delete_project($1,'Wrong name')", [target.p]),
    ).rejects.toThrow(/exact project name/);
    const deleted = await db.query<{ result: { deleted: boolean } }>(
      "select delete_project($1,'Website') result",
      [target.p],
    );
    expect(deleted.rows[0].result.deleted).toBe(true);
    await admin();
    for (const table of projectTables) {
      expect(await rows(table, target.p)).toHaveLength(0);
      expect(await rows(table, untouched.p)).toHaveLength(1);
    }
    expect(
      (
        await db.query("select * from document_spans where document_id=$1", [
          target.doc,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from jobs where document_id=$1", [target.doc]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from command_receipts where key=$1", [
          `review-${target.p}`,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ storage_paths: string[] }>(
          "select * from project_deletion_cleanup where project_id=$1",
          [target.p],
        )
      ).rows[0].storage_paths,
    ).toEqual([`${target.p}/agreement.pdf`]);
    await user();
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).resolves.toBeDefined();
  });
  it("blocks deletion during an automation send and permits removal when the send is no longer in flight", async () => {
    const target = await seed();
    await db.query(
      "update automation_outbox set state='sending' where project_id=$1",
      [target.p],
    );
    await user();
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).rejects.toThrow(/send is still in progress/);
    await admin();
    for (const table of projectTables)
      expect(await rows(table, target.p)).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from project_deletion_cleanup where project_id=$1",
          [target.p],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query(
      "update automation_outbox set state='unknown' where project_id=$1",
      [target.p],
    );
    await user();
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).resolves.toBeDefined();
  });
  it("rolls back all deletions and the cleanup receipt if an unexpected dependency still blocks the project", async () => {
    const target = await seed();
    await db.exec(
      "create table deletion_test_blocker(project_id uuid references projects)",
    );
    await db.query("insert into deletion_test_blocker values($1)", [target.p]);
    await user();
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).rejects.toMatchObject({ code: "23503" });
    await admin();
    for (const table of projectTables)
      expect(await rows(table, target.p)).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from project_deletion_cleanup where project_id=$1",
          [target.p],
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec("drop table deletion_test_blocker");
    await user();
    await expect(
      db.query("select delete_project($1,'Website')", [target.p]),
    ).resolves.toBeDefined();
  });
});

describe("reconnecting a client after project deletion", () => {
  it("identifies an owner's existing draft and retains its in-flight reservation", async () => {
    const address = "+12065550601";
    const first = await draftConnection("Existing draft", address);
    await beginIntroduction(first, address);
    const second = await draftConnection("New draft", address);
    await expect(beginIntroduction(second, address)).rejects.toMatchObject({
      code: "23505",
      hint: "chat_binding_reserved",
      message: expect.stringContaining(
        '"Existing draft" (draft; introduction sending)',
      ),
    });
    await admin();
    expect(
      (
        await db.query(
          "select project_id,test_state from chat_bindings where instance_id='reconnect-instance' and chat_guid=$1",
          [`any;-;${address}`],
        )
      ).rows,
    ).toEqual([{ project_id: first, test_state: "sending" }]);
    await user();
    await expect(
      db.query("select delete_project($1,'Existing draft')", [first]),
    ).rejects.toThrow(/send is still in progress/);
  });

  it("does not disclose another workspace's project details or release its binding", async () => {
    const address = "+12065550602";
    const first = await draftConnection(
      "Private project name",
      address,
      other,
      otherOrg,
    );
    await beginIntroduction(first, address);
    const second = await draftConnection("New project", address);
    const error = await beginIntroduction(second, address).catch(
      (error: Error & { code: string }) => error,
    );
    expect(error).toMatchObject({
      code: "23505",
      hint: "chat_binding_reserved",
    });
    expect((error as Error).message).not.toContain("Private project name");
    await expect(
      db.query("select delete_project($1,'Private project name')", [first]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("keeps unrelated unique violations distinct from conversation conflicts", async () => {
    const instance = "unrelated-index-instance";
    await admin();
    await db.exec(
      "create unique index test_binding_hash on chat_bindings(membership_hash) where instance_id='unrelated-index-instance'",
    );
    const first = await draftConnection(
      "First",
      "+12065550603",
      owner,
      org,
      instance,
    );
    await beginIntroduction(first, "+12065550603");
    const second = await draftConnection(
      "Second",
      "+12065550604",
      owner,
      org,
      instance,
    );
    await expect(
      beginIntroduction(second, "+12065550604"),
    ).rejects.toMatchObject({ code: "23505", constraint: "test_binding_hash" });
    await admin();
    await db.exec("drop index test_binding_hash");
  });

  it("allows the same exact instance/chat to be connected after deletion even while file cleanup is pending", async () => {
    // Install the deletion fix here too so this test is independent of ordering
    // within the legacy-before-upgrade regression suite below.
    await admin();
    await db.exec(await readFile(`supabase/migrations/${fix}`, "utf8"));
    const address = "+12065550605";
    const old = await draftConnection("Deleted project", address);
    await beginIntroduction(old, address);
    await admin();
    await db.query(
      "update chat_bindings set test_state='sent',test_message_guid='original-intro' where project_id=$1",
      [old],
    );
    await user();
    await db.query("select delete_project($1,'Deleted project')", [old]);
    expect(
      (
        await db.query(
          "select status from project_deletion_cleanup where project_id=$1",
          [old],
        )
      ).rows,
    ).toEqual([{ status: "pending" }]);
    const next = await draftConnection("Replacement project", address);
    await beginIntroduction(next, address);
    await admin();
    expect(
      (
        await db.query(
          "select project_id,test_state from chat_bindings where instance_id='reconnect-instance' and chat_guid=$1",
          [`any;-;${address}`],
        )
      ).rows,
    ).toEqual([{ project_id: next, test_state: "sending" }]);
  });
});
