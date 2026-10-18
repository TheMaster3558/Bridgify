import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function user(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}

async function migration(name: string) {
  await db.exec(
    await readFile(
      new URL(`../../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid,bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select, insert, delete on storage.objects to authenticated;`,
  );
  await migration("202610170001_onboarding.sql");
  await migration("202610190018_client_photos.sql");
  await db.exec(
    `insert into auth.users(id) values ('${owner}'),('${other}');
     insert into organizations(id,name) values ('${orgA}','A'),('${orgB}','B');
     insert into organization_members(organization_id,user_id,role) values ('${orgA}','${owner}','owner'),('${orgB}','${other}','owner');`,
  );
});

afterAll(async () => {
  await db.close();
});

describe("client photos", () => {
  it("creates a private bucket limited to small images", async () => {
    await db.exec("reset role");
    const bucket = await db.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='client-photos'",
    );
    expect(bucket.rows[0]).toEqual({
      public: false,
      file_size_limit: 2097152,
      allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
    });
  });

  it("lets an owner add, change and remove their own client photos", async () => {
    await user(owner);
    await db.query(
      "insert into client_photos(organization_id,client_key,storage_path) values($1,'yohaan shah',$2)",
      [orgA, `${orgA}/one.jpg`],
    );
    await db.query(
      "update client_photos set storage_path=$1 where client_key='yohaan shah'",
      [`${orgA}/two.jpg`],
    );
    const rows = await db.query<{ storage_path: string }>(
      "select storage_path from client_photos",
    );
    expect(rows.rows).toEqual([{ storage_path: `${orgA}/two.jpg` }]);
    await db.query("delete from client_photos where client_key='yohaan shah'");
    expect((await db.query("select 1 from client_photos")).rows).toHaveLength(
      0,
    );
  });

  it("hides other workspaces' photos and blocks writing into them", async () => {
    await user(owner);
    await db.query(
      "insert into client_photos(organization_id,client_key,storage_path) values($1,'maria',$2)",
      [orgA, `${orgA}/maria.jpg`],
    );
    await user(other);
    expect((await db.query("select 1 from client_photos")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into client_photos(organization_id,client_key,storage_path) values($1,'maria',$2)",
        [orgA, `${orgA}/stolen.jpg`],
      ),
    ).rejects.toThrow();
  });

  it("requires a normalized client name and a path inside the workspace folder", async () => {
    await user(owner);
    await expect(
      db.query(
        "insert into client_photos(organization_id,client_key,storage_path) values($1,'Mixed Case',$2)",
        [orgA, `${orgA}/x.jpg`],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into client_photos(organization_id,client_key,storage_path) values($1,'elsewhere',$2)",
        [orgA, `${orgB}/x.jpg`],
      ),
    ).rejects.toThrow();
  });

  it("limits storage objects to the owner's workspace folder", async () => {
    await user(owner);
    await db.query(
      "insert into storage.objects(id,bucket_id,name) values(gen_random_uuid(),'client-photos',$1)",
      [`${orgA}/ok.jpg`],
    );
    await expect(
      db.query(
        "insert into storage.objects(id,bucket_id,name) values(gen_random_uuid(),'client-photos',$1)",
        [`${orgB}/nope.jpg`],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into storage.objects(id,bucket_id,name) values(gen_random_uuid(),'client-photos','not-a-uuid/x.jpg')",
      ),
    ).rejects.toThrow();
    await user(other);
    expect(
      (
        await db.query(
          "select 1 from storage.objects where bucket_id='client-photos'",
        )
      ).rows,
    ).toHaveLength(0);
  });
});
