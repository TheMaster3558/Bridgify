import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(hashtextextended('bridgify:migrations',0))");
    await client.query(`create table if not exists public.bridgify_migrations(
      name text primary key, sha256 text not null, applied_at timestamptz not null default now())`);
    for (const name of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) {
      const sql = await readFile(`supabase/migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prior = await client.query("select sha256 from public.bridgify_migrations where name=$1", [name]);
      if (prior.rows.length) {
        if (prior.rows[0].sha256 !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into public.bridgify_migrations(name,sha256) values($1,$2)", [name, checksum]);
        await client.query("commit");
        console.log(`Applied ${name}`);
      } catch (error) { await client.query("rollback"); throw error; }
    }
  } finally {
    await client.query("select pg_advisory_unlock(hashtextextended('bridgify:migrations',0))");
    client.release();
    await pool.end();
  }
}
main().catch(() => {
  // Raw driver errors may include connection strings and source data.
  console.error("Database migration failed. Check configuration and migration state.");
  process.exitCode = 1;
});
