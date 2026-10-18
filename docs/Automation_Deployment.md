# Immediate automation on Vercel Hobby

Target: **https://bridgify-two.vercel.app**. Production activation is an operator
step; code in an unmerged branch does not change the deployed site.

## Use it locally before deployment

With the existing private database, Spectrum and Gemini settings in `.env.local`,
run `AUTOMATION_WORKER_ENABLED=true npm run automation:sdk` from this repository.
`npm run photon:demo` also selects SDK mode. You do not need Vercel environment
access, a public URL, or webhook signing variables for this local listener.
The computer must stay awake and online. Only connected, disclosed and activated
project chats can authorize work; normal project settings still apply.

The listener receives live SDK messages, saves them to the same inbox and wakes
processing immediately. Startup/stream-reopen history catch-up covers downtime;
the SDK also handles resumable stream reconnects. Failed database writes are
retried before the next event is consumed. Normal inbound delivery does not poll
Photon history. The local database recovery pump checks for saved work/retries
every two seconds. This also handles owner approvals/status changes.

Keep `AUTOMATION_INTAKE=webhook` available for production: the dedicated SDK
command overrides it only for that process. This does not change Vercel variables
or the signed webhook endpoint. Both modes share tasks, revision accounting,
reviews, outbox leases and provider message GUID deduplication.

## Time and prerequisites for switching

Once you have Vercel Production environment access and the PRs are merged, budget
roughly **15–30 minutes** for configuration, two deployments and a real-message
check. This is an estimate, not a deployment SLA; build queues, credentials or
provider setup can add time. No SDK-to-webhook business-logic rewrite is needed.
The local listener can continue working until the hosted path is verified.

## Architecture

Photon POSTs a signed message to `/api/v1/integrations/photon/webhook`. The route
verifies the unchanged body, saves/deduplicates the event and job, then uses
Next.js `after()` to run the existing transactional processor and outbox sender.
The request is acknowledged after persistence; normal processing starts immediately
without a scheduled history poll. Gemini and provider latency still apply.

Each invocation is bounded by a 60-second function duration, transport timeouts
and persisted leases. Concurrent/replayed deliveries cannot accept the same job
or submit the same outbox row twice. An interrupted submission becomes unknown;
recovery never blindly resends it. Scope and policy are checked again after AI
interpretation. Standalone thanks creates no interpretation or reply job.

Supabase Cron invokes an authenticated `/api/internal/automation` every minute to
resume queued/retryable/expired jobs and queued replies. It does **not** poll
Photon history. It returns 202 quickly and starts bounded work with `after()`.
Health comes from actual database runs, backlog and safe job errors.

Vercel Hobby's built-in cron is daily, so no minute-level Vercel cron is declared.
Supabase pg_cron + pg_net supplies the recovery trigger. The setup script keeps
its dedicated secret in a private database schema and removes browser-role reads
from pg_net request/response queues. It never embeds credentials in cron SQL.
Existing project/tenant RLS remains enforced on owner pages.

## Deployment steps for the existing project

1. Merge the owner-only, automation lifecycle and local SDK option PRs into `main`,
   or deploy the SDK feature branch containing all three. Do not leave old client-invitation code
   deployed after applying the owner-only migration.
2. Run `npm run automation:install` with the private `.env.local` configured.
   It checks migration receipts and applies only missing automation migrations.
   The implementation session already applied these migrations to the configured
   Supabase project; this command is safe to repeat.
3. Run `npm run automation:hosting -- prepare`. It saves an independent recovery
   secret in ignored `.env.local`, without printing it. Never paste credentials
   in chat or commit that file.
4. In Vercel **Project → Settings → Environment Variables → Production**, set:
   - `APP_BASE_URL=https://bridgify-two.vercel.app`
   - `AUTOMATION_PUBLIC_URL=https://bridgify-two.vercel.app`
   - `AUTOMATION_WORKER_ENABLED=true`
   - `AUTOMATION_INTAKE=webhook`
   - `AUTOMATION_RUNNER_SECRET` from the local file
   - Existing `DATABASE_URL`, Supabase URL/anon key/service-role key,
     `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `GEMINI_API_KEY`, and
     `GEMINI_MODEL`. These are server variables except the two existing
     `NEXT_PUBLIC_SUPABASE_*` browser variables. Use Supabase's serverless
     transaction-pooler connection string for Vercel, with the database password
     encoded as required by Supabase. No credential values belong in the source.
5. Deploy. The public URL must reach the final endpoint without authentication
   middleware, deployment protection challenges or redirects. Application API
   authentication and webhook signatures remain required.
6. Locally run `npm run automation:hosting -- webhook`. It first verifies the
   deployed recovery endpoint and matching secret, then registers the public
   webhook using your existing Photon project credentials. The once-only signing
   secret is immediately saved to ignored `.env.local`; it is never printed.
   An existing registration is retained rather than deleted or rotated silently.
7. Add `PHOTON_WEBHOOK_SIGNING_SECRET`, `PHOTON_WEBHOOK_INSTANCE_ID` and
   `PHOTON_WEBHOOK_PROTOCOL=spectrum-cloud-v0` from that local file to Vercel
   Production and redeploy. The instance ID must equal `SPECTRUM_PROJECT_ID`.
   Photon may send events during this registration/deploy interval; retain the
   local SDK listener temporarily and perform the one-time catch-up below. The
   SDK command still selects local SDK mode if the setup script changes the
   saved `AUTOMATION_INTAKE` value to `webhook`.
8. Run `npm run automation:hosting -- recovery`. It installs/uses pg_cron and
   pg_net on your existing Supabase database, validates the deployed endpoint,
   and creates/updates the named `bridgify-automation-recovery` schedule. It
   resumes **saved work only**. Check Supabase Cron run history and the project's
   Automation page for actual processing health. A paused/unavailable Supabase
   project or exhausted provider quotas still interrupts processing.
9. Once, run `npm run automation:sync` and `npm run automation:process` to recover
   messages missed during cutover. This explicit catch-up reads authenticated
   history; it does not install recurring history polling. Replays deduplicate
   against webhook messages and committed work.
10. Verify a consenting client's fresh request produces one request/task or review
    and one appropriate outbox submission. Verify “thanks” produces no reply.
    Confirm the Automation page's health and delivery state. Then stop the old
    local SDK listener (Ctrl-C) so production no longer depends on a terminal.
    Both paths deduplicate messages during overlap, but a separate old chatbot
    demo must remain stopped because it bypasses the shared outbox.

Do not treat successful deployment or an HTTP 2xx as client device delivery.
For a failed/unknown reply, open Automation, inspect the actual conversation, and
verify its provider message ID or explicitly confirm non-delivery before retrying.

## Owner controls

- **Automation:** edit/cancel queued replies, verify actual provider receipts,
  explicitly retry non-delivered messages, retry eligible failed interpretation,
  apply reviewed corrections/cancellations to existing tasks, and amend policy.
- **Scope & Revisions:** manually group accepted requests into feedback rounds,
  close/consume rounds, refund individual usage or rounds with an audit reason.
- **Work:** status changes optionally queue client-safe progress updates. Enable
  progress updates in an explicit policy amendment; existing policies default off.

Corrections alter the selected open task; they do not create a second task or
revision charge. Cancellations retain usage until a separate explicit refund.
Accounting mode cannot change after work has been accepted; policy amendments
preserve usage and scope/commercial terms. Refunds remain immutable records.

Sources: [Photon webhooks](https://photon.codes/docs/webhooks/overview),
[registration](https://photon.codes/docs/webhooks/managing-webhooks),
[Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[pg_net queue privileges](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357),
[Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
