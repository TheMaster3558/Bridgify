import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  agreementExtractionSchema,
  reviewedAgreementSchema,
} from "../../lib/schemas/agreement";
import { policySchema } from "../../lib/schemas/onboarding";
import { proposalTermsSchema } from "../../lib/proposals/schema";
import { interpretationSchema } from "../../lib/ai/interpret-messages";

vi.mock("server-only", () => ({}));

const workspace = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const existingProject = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let seed: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on function auth.uid() to authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text);
    alter table storage.objects enable row level security;
  `);
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  }
  seed = await readFile("supabase/seeds/demo.sql", "utf8");
  await db.query(
    "insert into auth.users(id,email) values($1,'owner@example.test')",
    [owner],
  );
  await db.query("insert into organizations(id,name) values($1,'Demo test')", [
    workspace,
  ]);
  await db.query("insert into organization_members values($1,$2,'owner')", [
    workspace,
    owner,
  ]);
  await db.query(
    "insert into projects(id,organization_id,owner_id,name,client_name,original_amount_cents,timezone) values($1,$2,$3,'Existing project','Existing client',10000,'UTC')",
    [existingProject, workspace, owner],
  );
});

afterAll(async () => {
  await db?.close();
});

it("requires an explicit workspace, then seeds connected and internally consistent demo records", async () => {
  await expect(db.exec(seed)).rejects.toThrow("Set v_workspace_id");
  await db.exec("rollback");
  await db.query("select set_config('bridgify.demo_workspace_id',$1,false)", [
    workspace,
  ]);
  await db.exec(seed);

  const counts = await db.query<{
    projects: number;
    tasks: number;
    requests: number;
    decisions: number;
    proposals: number;
    open_decisions: number;
  }>(`
    select (select count(*)::int from projects) projects,
      (select count(*)::int from project_tasks) tasks,
      (select count(*)::int from automation_requests) requests,
      (select count(*)::int from owner_decisions) decisions,
      (select count(*)::int from proposal_revisions) proposals,
      (select count(*)::int from owner_decisions where status in ('open','reviewing')) open_decisions
  `);
  expect(counts.rows[0]).toEqual({
    projects: 7,
    tasks: 37,
    requests: 26,
    decisions: 8,
    proposals: 6,
    open_decisions: 6,
  });
  for (const { extraction, review_draft } of (
    await db.query<{ extraction: unknown; review_draft: unknown }>(
      "select extraction,review_draft from documents",
    )
  ).rows) {
    expect(agreementExtractionSchema.safeParse(extraction).success).toBe(true);
    expect(reviewedAgreementSchema.safeParse(review_draft).success).toBe(true);
  }
  for (const { policy } of (
    await db.query<{ policy: unknown }>(
      "select policy from projects where policy is not null",
    )
  ).rows) {
    expect(policySchema.safeParse(policy).success).toBe(true);
  }
  for (const { shared_terms } of (
    await db.query<{ shared_terms: unknown }>(
      "select shared_terms from proposal_revisions",
    )
  ).rows) {
    expect(proposalTermsSchema.safeParse(shared_terms).success).toBe(true);
  }
  for (const { analysis } of (
    await db.query<{ analysis: unknown }>(
      "select analysis from automation_jobs",
    )
  ).rows) {
    expect(interpretationSchema.safeParse(analysis).success).toBe(true);
  }
  // Every request can open its source, analysis, and linked task/decision.
  expect(
    (
      await db.query(`select r.id from automation_requests r
    left join automation_jobs j on j.id=r.job_id and j.project_id=r.project_id
    left join automation_messages m on m.id=(r.source_ids->>0)::uuid and m.project_id=r.project_id
    left join project_tasks t on t.id=r.task_id and t.project_id=r.project_id
    left join owner_decisions d on d.id=r.decision_id and d.automation_request_id=r.id
    where j.id is null or m.id is null or (r.state='accepted' and t.id is null)
      or (r.state='owner_review' and (d.id is null or d.status not in ('open','reviewing')))
  `)
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select s.id from scope_versions s, jsonb_array_elements(s.terms) t where t->>'span_id' is not null and not exists(select 1 from document_spans d where d.id=(t->>'span_id')::uuid and d.document_id=s.document_id and position(t->>'quote' in d.text)>0)",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select id from projects where status='completed' and exists(select 1 from project_tasks where project_id=projects.id and status<>'done')",
      )
    ).rows,
  ).toEqual([]);

  // Approved commercial work changes price/scope exactly once; pending work does not.
  expect(
    (
      await db.query<{ approved_total_cents: number; scope_version: number }>(
        "select approved_total_cents::int,scope_version from projects where name like 'Cascadia%'",
      )
    ).rows[0],
  ).toEqual({ approved_total_cents: 2820000, scope_version: 2 });
  expect(
    (
      await db.query(
        "select id from projects where name like 'Northstar%' and approved_additions_cents<>0",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select id from automation_jobs where state in ('queued','running') union all select id from automation_outbox union all select document_id from jobs",
      )
    ).rows,
  ).toEqual([]);
  expect((await db.query("select project_id from chat_bindings")).rows).toEqual(
    [],
  );

  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  const clinic = (
    await db.query<{ id: string }>(
      "select id from projects where name like 'Evergreen%'",
    )
  ).rows[0].id;
  expect(
    (
      await db.query<{
        accounting: { requestsUsed: number; roundsUsed: number };
      }>("select automation_accounting($1) accounting", [clinic])
    ).rows[0].accounting,
  ).toMatchObject({ requestsUsed: 0, roundsUsed: 2, queued: 0, failedJobs: 0 });
  // Real owner RLS reads all six new projects, another user reads none.
  await db.exec("set role authenticated");
  expect((await db.query("select id from projects")).rows).toHaveLength(7);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    existingProject,
  ]);
  expect((await db.query("select id from projects")).rows).toEqual([]);
  await db.exec("reset role");

  const editedTask = (
    await db.query<{ id: string }>("select id from project_tasks limit 1")
  ).rows[0].id;
  await db.query(
    "update project_tasks set title='User-edited demo task' where id=$1",
    [editedTask],
  );
  const snapshot = (
    await db.query(
      "select (select count(*) from audit_events) events,(select count(*) from scope_versions) scopes",
    )
  ).rows;
  await db.exec(seed);
  expect(
    (
      await db.query("select title from project_tasks where id=$1", [
        editedTask,
      ])
    ).rows[0],
  ).toEqual({ title: "User-edited demo task" });
  expect(
    (
      await db.query(
        "select (select count(*) from audit_events) events,(select count(*) from scope_versions) scopes",
      )
    ).rows,
  ).toEqual(snapshot);
  expect(
    (
      await db.query(
        "select name,client_name,status from projects where id=$1",
        [existingProject],
      )
    ).rows[0],
  ).toEqual({
    name: "Existing project",
    client_name: "Existing client",
    status: "draft",
  });
});

it("rolls back earlier inserts when a project identity conflicts", async () => {
  const otherWorkspace = "44444444-4444-4444-8444-444444444444";
  const otherOwner = "55555555-5555-4555-8555-555555555555";
  await db.query("insert into auth.users(id) values($1)", [otherOwner]);
  await db.query(
    "insert into organizations(id,name) values($1,'Collision test')",
    [otherWorkspace],
  );
  await db.query("insert into organization_members values($1,$2,'owner')", [
    otherWorkspace,
    otherOwner,
  ]);
  await db.query(
    `insert into projects(id,organization_id,owner_id,name,client_name,original_amount_cents,timezone)
    values(pg_temp.bridgify_demo_id($1,'project:evergreen'),$1,$2,'Keep this project','Existing client',10000,'UTC')`,
    [otherWorkspace, otherOwner],
  );
  await db.query("select set_config('bridgify.demo_workspace_id',$1,false)", [
    otherWorkspace,
  ]);
  await expect(db.exec(seed)).rejects.toThrow(
    "Demo project identity collision",
  );
  await db.exec("rollback");
  expect(
    (
      await db.query("select name from projects where organization_id=$1", [
        otherWorkspace,
      ])
    ).rows,
  ).toEqual([{ name: "Keep this project" }]);
  expect(
    (
      await db.query(
        "select d.id from documents d join projects p on p.id=d.project_id where p.organization_id=$1",
        [otherWorkspace],
      )
    ).rows,
  ).toEqual([]);
});

it("preserves the rest of a partially removed demo and reports the missing project", async () => {
  // The draft has no dependents except its initial activity event.
  await db.query(
    "delete from audit_events where project_id=pg_temp.bridgify_demo_id($1,'project:juniper')",
    [workspace],
  );
  await db.query(
    "delete from projects where id=pg_temp.bridgify_demo_id($1,'project:juniper')",
    [workspace],
  );
  await db.query("select set_config('bridgify.demo_workspace_id',$1,false)", [
    workspace,
  ]);
  const before = (await db.query("select count(*) from project_tasks")).rows;
  await expect(db.exec(seed)).rejects.toThrow("Demo was partially removed");
  await db.exec("rollback");
  expect((await db.query("select count(*) from project_tasks")).rows).toEqual(
    before,
  );
  expect(
    (
      await db.query(
        "select title from project_tasks where title='User-edited demo task'",
      )
    ).rows,
  ).toEqual([{ title: "User-edited demo task" }]);
});
