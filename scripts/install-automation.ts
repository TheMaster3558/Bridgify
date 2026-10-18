import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

// Existing projects may have been provisioned through the Supabase SQL editor
// without the migration runner's receipt table. Do not replay their baseline.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("database_not_configured");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended('bridgify:migrations',0))",
      );
      await client.query(`create table if not exists public.bridgify_migrations(
        name text primary key,sha256 text not null,applied_at timestamptz not null default now())`);
      const name = "202610170010_project_automation.sql";
      const sql = await readFile(`supabase/migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prior = (
        await client.query(
          "select sha256 from public.bridgify_migrations where name=$1",
          [name],
        )
      ).rows[0];
      if (prior && prior.sha256 !== checksum)
        throw new Error("migration_changed");
      if (!prior) {
        await client.query(sql);
        await client.query(
          "insert into public.bridgify_migrations(name,sha256) values($1,$2)",
          [name, checksum],
        );
      }
      await client.query("commit");
      console.log(
        "Automation schema is installed. Run automation:sync, then automation:process to populate real records.",
      );
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Automation migration failed. Confirm DATABASE_URL and the existing project setup migrations. No baseline tables were replayed.",
  );
  process.exitCode = 1;
});
