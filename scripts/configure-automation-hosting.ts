import { randomBytes } from "node:crypto";
import { readFile, writeFile, appendFile, chmod } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";
const mode = process.argv[2];
async function main() {
  const envPath = ".env.local";
  const base = new URL(
    process.env.AUTOMATION_PUBLIC_URL || "https://bridgify-two.vercel.app",
  );
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/"
  )
    throw new Error("Public HTTPS origin required");
  let env = await readFile(envPath, "utf8");
  const save = async (key: string, value: string) => {
    if (!/^[A-Z_]+$/.test(key) || /[\r\n]/.test(value))
      throw new Error("Invalid environment field");
    const re = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
    await writeFile(envPath, env, { mode: 0o600 });
    await chmod(envPath, 0o600);
    process.env[key] = value;
  };
  if (mode === "prepare") {
    if (!process.env.AUTOMATION_RUNNER_SECRET)
      await save("AUTOMATION_RUNNER_SECRET", randomBytes(32).toString("hex"));
    await save("AUTOMATION_PUBLIC_URL", base.origin);
    console.log(
      "Recovery secret saved privately to .env.local. Add AUTOMATION_RUNNER_SECRET, AUTOMATION_PUBLIC_URL and your existing private provider/database settings to Vercel Production. Deploy this branch before running configure.",
    );
    return;
  }
  const runner = process.env.AUTOMATION_RUNNER_SECRET;
  if (!runner || runner.length < 32)
    throw new Error("Run prepare and configure Vercel environment first");
  const health = await fetch(`${base.origin}/api/internal/automation`, {
    headers: { authorization: `Bearer ${runner}` },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!health.ok || (await health.json()).version !== "webhook-automation-v1")
    throw new Error(
      "Deploy the new endpoint and matching recovery secret first",
    );
  if (mode === "webhook") {
    const id = process.env.SPECTRUM_PROJECT_ID,
      secret = process.env.SPECTRUM_PROJECT_SECRET;
    if (!id || !secret) throw new Error("Photon credentials required");
    const url = `https://spectrum.photon.codes/projects/${encodeURIComponent(id)}/webhooks/`;
    const headers = {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    };
    const webhookUrl = `${base.origin}/api/v1/integrations/photon/webhook`;
    const existing = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!existing.ok) throw new Error("Photon list unavailable");
    const list = z
      .object({
        data: z.array(z.object({ id: z.string(), webhookUrl: z.string() })),
      })
      .parse(await existing.json());
    if (list.data.some((w) => w.webhookUrl === webhookUrl)) {
      if (!process.env.PHOTON_WEBHOOK_SIGNING_SECRET)
        throw new Error(
          "Existing webhook secret is unavailable; recover its configured secret before changing registration",
        );
      console.log(
        "Webhook already registered. Existing registration and secret retained.",
      );
      return;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ webhookUrl }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Photon registration unavailable");
    const registered = z
      .object({
        data: z.object({
          id: z.string(),
          signingSecret: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      })
      .parse(await response.json());
    // Persist the once-only secret immediately; never print provider responses.
    await appendFile(
      ".env.local",
      `\nPHOTON_WEBHOOK_SIGNING_SECRET=${registered.data.signingSecret}\n`,
      { mode: 0o600 },
    );
    env = await readFile(envPath, "utf8");
    await save("PHOTON_WEBHOOK_INSTANCE_ID", id);
    await save("PHOTON_WEBHOOK_PROTOCOL", "spectrum-cloud-v0");
    await save("AUTOMATION_INTAKE", "webhook");
    console.log(
      "Photon webhook registered. Signing secret is saved only in .env.local. Add PHOTON_WEBHOOK_SIGNING_SECRET, PHOTON_WEBHOOK_INSTANCE_ID and PHOTON_WEBHOOK_PROTOCOL to Vercel Production, set AUTOMATION_INTAKE=webhook, and redeploy. Stop the old history worker once delivery is verified.",
    );
    return;
  }
  if (mode !== "recovery") throw new Error("Use prepare, webhook or recovery");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("create extension if not exists pg_cron");
      await c.query("create extension if not exists pg_net");
      // Dedicated scheduler secrets never enter cron SQL or API responses. Remove
      // browser-role reads on pg_net queues per Supabase's current guidance.
      await c.query(
        "revoke select on net.http_request_queue,net._http_response from public,anon,authenticated",
      );
      await c.query("create schema if not exists automation_private");
      await c.query(
        "revoke all on schema automation_private from public,anon,authenticated",
      );
      await c.query(
        "create table if not exists automation_private.scheduler_config(id boolean primary key default true check(id),url text not null,secret text not null)",
      );
      await c.query(
        "revoke all on automation_private.scheduler_config from public,anon,authenticated",
      );
      await c.query(
        "insert into automation_private.scheduler_config values(true,$1,$2) on conflict(id) do update set url=excluded.url,secret=excluded.secret",
        [`${base.origin}/api/internal/automation`, runner],
      );
      await c.query(`select cron.schedule('bridgify-automation-recovery','* * * * *',$cron$
     select net.http_post(url:=url,headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=5000) from automation_private.scheduler_config where id=true;
   $cron$)`);
      await c.query("commit");
      console.log(
        "Supabase recovery scheduled every minute. It resumes saved jobs/replies; normal inbound delivery uses Photon webhooks.",
      );
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Automation hosting configuration did not finish. Check the deployment endpoint, private environment settings, Photon registration and Supabase extension permissions. No secrets were logged.",
  );
  process.exitCode = 1;
});
