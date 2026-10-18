# Project automation

The automation worker uses the same `projects`, `scope_versions`, `chat_bindings`,
`project_tasks` and `owner_decisions` records as project setup and the dashboard.
It imports real Photon messages, interprets them with Gemini, and atomically saves
requests, revision usage, tasks, private review items, audit events and replies.
It does not edit a website or mark tasks completed without an owner status update.
There are no seeded customer records or fabricated integrations.

## Install and populate

1. Add the private `DATABASE_URL` from Supabase **Connect → Session pooler → URI**
   to `.env.local`, replacing its password placeholder. Keep your existing
   Supabase HTTPS URL and API keys. Never use `NEXT_PUBLIC_` for the Postgres URI.
2. On an existing configured project database, run `npm run automation:install`.
   This applies only `202610170010_project_automation.sql` and records its checksum
   without replaying the existing setup schema. For an empty Supabase project,
   apply the files in `supabase/migrations` in order using `db:migrate` with the
   environment loaded. The incompatible historical intake prototype is retained
   under `supabase/legacy` exclusively for its isolated regression tests.
3. Run `npm run automation:sync`. This reads authenticated Photon history for
   active and review-only projects and stores messages after each activation
   cutoff. Repeating an import does not create duplicate work. It traverses every
   provider page; source edits/deletions require review.
4. Run `npm run automation:process` to populate tasks, review records, revision
   usage and queued replies from those messages using the saved settings and real
   Gemini interpretation. This command does not submit replies.
5. Set `AUTOMATION_WORKER_ENABLED=true` and run `npm run automation:worker` as a
   persistent process. The worker polls authenticated history every 30 seconds,
   processes jobs and submits queued replies through the real Spectrum adapter.
   It needs `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `GEMINI_API_KEY`,
   `GEMINI_MODEL`, and `DATABASE_URL`. The agreement worker remains separate.

For webhook deployments, set `AUTOMATION_INTAKE=webhook` and the signed Spectrum
configuration in `.env.example`. The existing Photon webhook route verifies raw
bytes before using the canonical project automation inbox. Its configured instance
must equal the Spectrum project used by the sender. Unsigned payloads are rejected.

## Saved authority and replies

- Manual approval routes work to Needs Attention without spending revisions.
  Automatic acceptance requires active lifecycle, enabled policy, a per-request
  allowance, permitted operation and target, agreement inclusion evidence, no
  applicable exclusions, complete fields and available task capacity. Scope and
  policy versions are checked again after Gemini returns.
- Text replacement and color changes are the supported routine task operations.
  New features, scope additions, deadline changes, conflicts, cancellations and
  uncertain interpretation require the owner. No new operation is silently
  enabled for existing projects.
- Project creation includes independent controls for status answers, clarification
  questions and review acknowledgments. Earlier policies default these to enabled.
  Task acceptance always queues a confirmation. Casual messages stay quiet.
- Clarifications retain their original request and source IDs, with at most two
  questions. No revision is used while waiting. Ambiguous matching requires review.
- Status answers use stored task titles and statuses. Owners update task status
  from the task detail panel. Private notes, decision explanations and proposal
  terms are excluded from model context and status replies.
- Each accepted individual request uses one revision in an immutable accounting
  ledger. Task cancellation does not silently refund it. Contractual rounds remain
  under manual accounting. Owner overrides are explicit and audited.
- Owners can accept, decline or dismiss review requests, record their reason,
  and optionally queue an actual client reply. Message identity and delivery
  reviews must be checked in the conversation rather than accepted as work.

## Reliability and verification

Per-project jobs run in order with leases, three bounded attempts and stale
snapshot rejection. Model calls run outside database locks. Task, allowance,
decision, audit and reply writes commit together. Incoming message IDs deduplicate
authenticated history and webhook deliveries. Provider event identity conflicts
are rejected. Outbound messages cannot authorize new work.

The outbox records `sending` before submission. Successful sends retain the real
provider message ID. Failed or uncertain sends create private delivery reviews;
they are never blindly sent again. An expired sending lease becomes `unknown`.
Paused projects and held or changed bindings cannot submit queued replies.
Sent means provider submission succeeded, not device delivery/read confirmation.

Run `npm run test:automation`, `npm run test:assistant`, `npm run test:intake`,
`npm test`, `npm run typecheck`, and `npm run lint`. Automation tests use synthetic
conversations against the actual migrations and PGlite transactions; they are not
live-provider or deployed end-to-end delivery claims.
