import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  client = "33333333-3333-4333-8333-333333333333",
  wrong = "44444444-4444-4444-8444-444444444444";
async function user(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
async function admin() {
  await db.exec("reset role");
}
async function command(
  id: string | null,
  version: number | null,
  section: string,
  payload: unknown,
  key = crypto.randomUUID(),
) {
  const result = await db.query<{
    result: {
      project: {
        id: string;
        version: number;
        status: string;
        activation_cutoff: string;
      };
      invitationToken: string;
      documentId: string;
    };
  }>("select public.onboarding_command($1,$2,$3,$4::jsonb,$5) result", [
    id,
    version,
    section,
    JSON.stringify(payload),
    key,
  ]);
  return result.rows[0].result;
}
const basics = {
  name: "New website",
  client_name: "Invited client",
  original_amount_cents: 10029,
  currency: "USD",
  timezone: "America/Los_Angeles",
  agreed_due_date: null,
};
const people = {
  owner_sender_id: "+12065550001",
  client_sender_id: "+12065550002",
  bot_sender_id: "bot@example.test",
  instance_id: "photon-instance",
  chat_guid: "any;+;group",
  identities_confirmed: true,
};
const policy = {
  mode: "enabled",
  allowance_mode: "per_request",
  allowance: 2,
  operations: ["replace_text"],
  targets: ["home.heading"],
  exclusions: "No new pages",
  max_open_tasks: 10,
  notifications: "dashboard",
};
async function project() {
  await user(owner);
  const p = await command(null, null, "basics", basics);
  return p.project;
}
async function inviteProject() {
  const p = await project();
  const invite = await command(p.id, p.version, "invite", {
    email: "client@example.test",
  });
  await user(client);
  await db.query("select accept_invitation($1)", [invite.invitationToken]);
  await user(owner);
  return invite.project;
}
async function readyProject() {
  let p = await inviteProject();
  p = (
    await command(p.id, p.version, "people", {
      ...people,
      chat_guid: `any;+;${p.id}`,
    })
  ).project;
  await admin();
  const doc = crypto.randomUUID(),
    span = crypto.randomUUID();
  await db.query(
    "insert into documents(id,project_id,kind,original_text,status) values($1,$2,'text','One page included','ready')",
    [doc, p.id],
  );
  await db.query(
    "insert into document_spans values($1,$2,1,0,17,'One page included')",
    [span, doc],
  );
  await user(owner);
  p = (
    await command(p.id, p.version, "scope", {
      document_id: doc,
      terms: [
        {
          kind: "inclusion",
          text: "One page",
          quote: "One page included",
          span_id: span,
        },
      ],
      reviewed_all_terms: true,
    })
  ).project;
  p = (await command(p.id, p.version, "policy", policy)).project;
  await admin();
  await db.query(
    "insert into chat_bindings(project_id,instance_id,chat_guid,participants,membership_hash,verified_at,test_state,test_message_guid,disclosed_message_guid,webhook_verified_at) values($1,'photon-instance',$2,'[]','hash',now(),'sent','test-guid','test-guid',now())",
    [p.id, `any;+;${p.id}`],
  );
  await user(owner);
  return p;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid,bucket_id text,name text); alter table storage.objects enable row level security;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/202610170001_onboarding.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/202610170002_password_auth.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [id, email] of [
    [owner, "owner@example.test"],
    [other, "other@example.test"],
    [client, "client@example.test"],
    [wrong, "wrong@example.test"],
  ])
    await db.query("insert into auth.users values($1,$2,now())", [id, email]);
  await user(owner);
  await db.query("select create_workspace('Owner workspace')");
  await user(other);
  await db.query("select create_workspace('Other workspace')");
});
afterAll(async () => {
  await db?.close();
});
describe("actual Postgres onboarding migration", () => {
  it("creates an owner workspace once from an empty account", async () => {
    await user(owner);
    const result = await db.query("select create_workspace('Repeated') id");
    expect(result.rows).toHaveLength(1);
    expect(
      (await db.query("select * from organization_members")).rows,
    ).toHaveLength(1);
  });
  it("isolates another organization's rows and commands", async () => {
    const p = await project();
    await user(other);
    expect(
      (await db.query("select * from projects where id=$1", [p.id])).rows,
    ).toHaveLength(0);
    await expect(
      command(p.id, p.version, "basics", { ...basics, name: "Stolen" }),
    ).rejects.toThrow();
  });
  it("keeps owner tables inaccessible to clients", async () => {
    await inviteProject();
    await user(client);
    for (const table of [
      "projects",
      "documents",
      "scope_versions",
      "chat_bindings",
      "audit_events",
      "proposal_revisions",
      "project_invitations",
    ]) {
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    }
  });
  it("forbids direct browser mutations and worker commands", async () => {
    const p = await project();
    await expect(
      db.query("update projects set status='active' where id=$1", [p.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("select claim_document_job()")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("rejects stale and missing expected versions", async () => {
    const p = await project();
    await expect(command(p.id, 99, "basics", basics)).rejects.toThrow(
      /changed/,
    );
    await expect(command(p.id, null, "basics", basics)).rejects.toThrow(
      /changed/,
    );
  });
  it("deduplicates creation and rejects reused keys with changed bodies", async () => {
    await user(owner);
    const key = crypto.randomUUID();
    const one = await command(null, null, "basics", basics, key),
      two = await command(null, null, "basics", basics, key);
    expect(one.project.id).toBe(two.project.id);
    await expect(
      command(null, null, "basics", { ...basics, name: "Different" }, key),
    ).rejects.toThrow(/reused/);
  });
  it("does not let a forwarded invitation authorize the wrong account", async () => {
    const p = await project();
    const invitation = await command(p.id, p.version, "invite", {
      email: "client@example.test",
    });
    await user(wrong);
    await expect(
      db.query("select accept_invitation($1)", [invitation.invitationToken]),
    ).rejects.toThrow(/Invitation unavailable/);
  });
  it("rejects expired invitations without disclosing private terms", async () => {
    const p = await project();
    const invite = await command(p.id, p.version, "invite", {
      email: "client@example.test",
    });
    await admin();
    await db.query(
      "update project_invitations set expires_at=now()-interval '1 second' where project_id=$1",
      [p.id],
    );
    await user(client);
    await expect(
      db.query("select accept_invitation($1)", [invite.invitationToken]),
    ).rejects.toThrow(/Invitation unavailable/);
  });
  it("preserves the exact authorized proposal revision and excludes internal notes", async () => {
    const p = await project(),
      proposal = crypto.randomUUID();
    await admin();
    await db.query(
      "insert into proposal_revisions values($1,7,$2,null,'awaiting_client','{\"price_cents\":50000}','SECRET OWNER NOTE',null)",
      [proposal, p.id],
    );
    await user(owner);
    const invite = await command(p.id, p.version, "invite", {
      email: "client@example.test",
      proposal_id: proposal,
      revision: 7,
    });
    await user(client);
    const result = await db.query<{ next: string }>(
      "select accept_invitation($1) next",
      [invite.invitationToken],
    );
    expect(result.rows[0].next).toBe(`/proposals/${proposal}?revision=7`);
    const shared = await db.query("select shared_proposal($1,7) result", [
      proposal,
    ]);
    expect(JSON.stringify(shared.rows)).not.toContain("SECRET OWNER NOTE");
    await user(wrong);
    await expect(
      db.query("select shared_proposal($1,7)", [proposal]),
    ).rejects.toThrow();
  });
  it("requires client acceptance before mapping messaging identities", async () => {
    const p = await project();
    await expect(command(p.id, p.version, "people", people)).rejects.toThrow(
      /accept the invitation/,
    );
  });
  it("rejects fabricated source evidence even through direct RPC", async () => {
    const p = await project();
    await expect(
      command(p.id, p.version, "scope", {
        document_id: crypto.randomUUID(),
        reviewed_all_terms: true,
        terms: [
          {
            kind: "inclusion",
            text: "Everything",
            quote: "fabricated",
            span_id: crypto.randomUUID(),
          },
        ],
      }),
    ).rejects.toThrow(/Review/);
  });
  it("blocks activation until every connection and scope guard passes", async () => {
    const p = await project();
    await expect(
      command(p.id, p.version, "lifecycle", {
        status: "active",
        reason: "Activate",
        disclosed: true,
      }),
    ).rejects.toThrow(/Confirm scope/);
  });
  it("requires explicit disclosure, then freezes scope after activation", async () => {
    const p = await readyProject();
    await expect(
      command(p.id, p.version, "lifecycle", {
        status: "active",
        reason: "Activate",
        disclosed: false,
      }),
    ).rejects.toThrow(/participants/);
    const active = await command(p.id, p.version, "lifecycle", {
      status: "active",
      reason: "Activate",
      disclosed: true,
    });
    expect(active.project.status).toBe("active");
    expect(active.project.activation_cutoff).toBeTruthy();
    await expect(
      command(p.id, active.project.version, "basics", basics),
    ).rejects.toThrow(/immutable/);
  });
  it("does not replay old events, duplicates or bot echoes as requests", async () => {
    const p = await readyProject();
    const active = await command(p.id, p.version, "lifecycle", {
      status: "active",
      reason: "Activate",
      disclosed: true,
    });
    await admin();
    const base = {
      instanceId: people.instance_id,
      chatGuid: `any;+;${p.id}`,
      kind: "message",
      senderId: people.client_sender_id,
    };
    const receive = async (event: object) =>
      (
        await db.query<{ d: string }>(
          "select receive_onboarding_event($1::jsonb,'hash') d",
          [JSON.stringify(event)],
        )
      ).rows[0].d;
    expect(
      await receive({
        ...base,
        eventKey: "old",
        occurredAt: "2020-01-01T00:00:00Z",
      }),
    ).toBe("before_cutoff");
    const fresh = {
      ...base,
      eventKey: "fresh",
      occurredAt: new Date(
        Date.parse(active.project.activation_cutoff) + 1000,
      ).toISOString(),
    };
    expect(await receive(fresh)).toBe("eligible_intake");
    expect(await receive(fresh)).toBe("duplicate");
    expect(
      await receive({
        ...fresh,
        eventKey: "echo",
        senderId: people.bot_sender_id,
      }),
    ).toBe("bot_echo");
  });
  it("holds changed membership and pauses automatic intake", async () => {
    const p = await readyProject();
    await command(p.id, p.version, "lifecycle", {
      status: "active",
      reason: "Activate",
      disclosed: true,
    });
    await admin();
    const event = {
      instanceId: people.instance_id,
      chatGuid: `any;+;${p.id}`,
      kind: "membership",
      eventKey: crypto.randomUUID(),
    };
    await db.query("select receive_onboarding_event($1,'changed')", [
      JSON.stringify(event),
    ]);
    const result = await db.query<{ status: string }>(
      "select status from projects where id=$1",
      [p.id],
    );
    expect(result.rows[0].status).toBe("paused");
  });
  it("retains history while completed and archived projects reject work", async () => {
    let p = await readyProject();
    p = (
      await command(p.id, p.version, "lifecycle", {
        status: "active",
        reason: "Activate",
        disclosed: true,
      })
    ).project;
    p = (
      await command(p.id, p.version, "lifecycle", {
        status: "completed",
        reason: "All work completed",
      })
    ).project;
    await expect(
      command(p.id, p.version, "lifecycle", {
        status: "active",
        reason: "Try reopen",
        disclosed: true,
      }),
    ).rejects.toThrow(/Closed/);
    p = (
      await command(p.id, p.version, "lifecycle", {
        status: "archived",
        reason: "Retain archive",
      })
    ).project;
    expect(p.status).toBe("archived");
    expect(
      (
        await db.query("select * from scope_versions where project_id=$1", [
          p.id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("requires a verified webhook and real send receipt even when scope is ready", async () => {
    const p = await readyProject();
    await admin();
    await db.query(
      "update chat_bindings set webhook_verified_at=null where project_id=$1",
      [p.id],
    );
    await user(owner);
    await expect(
      command(p.id, p.version, "lifecycle", {
        status: "active",
        reason: "Activate",
        disclosed: true,
      }),
    ).rejects.toThrow(/verified group/);
  });
  it("rejects an invalid quotation on a ready document", async () => {
    const p = await readyProject();
    const source = await db.query<{
      document_id: string;
      terms: { span_id: string }[];
    }>("select document_id,terms from scope_versions where project_id=$1", [
      p.id,
    ]);
    await expect(
      command(p.id, p.version, "scope", {
        document_id: source.rows[0].document_id,
        reviewed_all_terms: true,
        terms: [
          {
            kind: "inclusion",
            text: "Invented work",
            span_id: source.rows[0].terms[0].span_id,
            quote: "NOT IN THE SOURCE",
          },
        ],
      }),
    ).rejects.toThrow(/source quotation/);
  });
  it("invalidates prior automation when the baseline is reconfirmed", async () => {
    let p = await readyProject();
    const source = await db.query<{ document_id: string; terms: object[] }>(
      "select document_id,terms from scope_versions where project_id=$1",
      [p.id],
    );
    p = (
      await command(p.id, p.version, "scope", {
        document_id: source.rows[0].document_id,
        reviewed_all_terms: true,
        terms: source.rows[0].terms,
      })
    ).project;
    const row = await db.query<{ policy_version: number; policy: unknown }>(
      "select policy_version,policy from projects where id=$1",
      [p.id],
    );
    expect(row.rows[0]).toEqual({ policy_version: 0, policy: null });
    await command(p.id, p.version, "policy", policy);
    expect(
      (
        await db.query("select * from policy_versions where project_id=$1", [
          p.id,
        ])
      ).rows,
    ).toHaveLength(2);
  });
  it("rejects automatic accounting for contractual revision rounds in SQL", async () => {
    let p = await readyProject();
    const source = await db.query<{
      document_id: string;
      terms: { span_id: string; quote: string }[];
    }>("select document_id,terms from scope_versions where project_id=$1", [
      p.id,
    ]);
    const term = source.rows[0].terms[0];
    p = (
      await command(p.id, p.version, "scope", {
        document_id: source.rows[0].document_id,
        reviewed_all_terms: true,
        terms: [
          { ...term, kind: "inclusion", text: "One page" },
          { ...term, kind: "revision", text: "Two revision rounds" },
        ],
      })
    ).project;
    await expect(command(p.id, p.version, "policy", policy)).rejects.toThrow(
      /revision rounds/,
    );
    await command(p.id, p.version, "policy", {
      ...policy,
      mode: "review_only",
      allowance_mode: "manual_rounds",
    });
  });
  it("binds the accepted application user explicitly to the provider sender", async () => {
    const p = await readyProject();
    const row = await db.query<{
      people: {
        client_user_id: string;
        owner_user_id: string;
        client_sender_id: string;
      };
    }>("select people from projects where id=$1", [p.id]);
    expect(row.rows[0].people.client_user_id).toBe(client);
    expect(row.rows[0].people.owner_user_id).toBe(owner);
    expect(row.rows[0].people.client_sender_id).toBe(people.client_sender_id);
  });
  it("allows only the current worker lease to commit extraction", async () => {
    const p = await project();
    const imported = await command(p.id, p.version, "document", {
      kind: "text",
      text: "One page included",
    });
    await admin();
    const job = await db.query<{ job: { id: string; lease_token: string } }>(
      "select claim_document_job() job",
    );
    const j = job.rows[0].job;
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select finish_document_job($1,$2,'[]','{}',null,false) ok",
          [j.id, crypto.randomUUID()],
        )
      ).rows[0].ok,
    ).toBe(false);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select finish_document_job($1,$2,'[]','{}','Temporary failure',false) ok",
          [j.id, j.lease_token],
        )
      ).rows[0].ok,
    ).toBe(true);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from documents where id=$1",
          [imported.documentId],
        )
      ).rows[0].status,
    ).toBe("queued");
  });
  it("accepts an invited password account without requiring email verification", async () => {
    const p = await project();
    const invitation = await command(p.id, p.version, "invite", {
      email: "client@example.test",
    });
    await admin();
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [client],
    );
    try {
      await user(client);
      const result = await db.query<{ next: string }>(
        "select accept_invitation($1) next",
        [invitation.invitationToken],
      );
      expect(result.rows[0].next).toBe("/access");
    } finally {
      await admin();
      await db.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [client],
      );
    }
  });
});
