> Production uses immediate signed Photon delivery. Local development can use the live SDK listener. See [Automation Deployment](Automation_Deployment.md) for Vercel Hobby setup and cutover.

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
   This applies the project automation and review recovery migrations and records their checksums
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
5. Set `AUTOMATION_WORKER_ENABLED=true` and run `npm run automation:sdk` as a
   persistent local process. It receives live SDK messages, catches up history at
   startup/reopen, processes saved jobs and submits replies through Spectrum.
   Normal incoming delivery does not poll history. The local database pump also
   resumes retries and owner-queued replies without waiting for new messages.
   It needs `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `GEMINI_API_KEY`,
   `GEMINI_MODEL`, and `DATABASE_URL`. The agreement worker remains separate.
   `npm run photon:demo` is a compatibility entry point for this same SDK
   facilitator, rather than a separate general chatbot. Run one worker command;
   restart an existing worker after code changes.

For webhook deployments, set `AUTOMATION_INTAKE=webhook` and the signed Spectrum
configuration in `.env.example`. The existing Photon webhook route verifies raw
bytes before using the canonical project automation inbox. Its configured instance
must equal the Spectrum project used by the sender. Unsigned payloads are rejected.
The general `automation:worker` command reads `AUTOMATION_INTAKE`; `sdk` selects
live intake, `webhook` only consumes saved jobs, and `history` explicitly enables
the legacy 30-second history fallback. The dedicated `automation:sdk` command
selects SDK mode without editing the saved webhook configuration.

## Saved authority and replies

- Manual approval routes work to Needs Attention without spending revisions.
  Automatic acceptance requires active lifecycle, enabled policy, a per-request
  allowance, a clearly allowed assessment under saved acceptance guidance,
  agreement inclusion evidence, no
  applicable exclusions, complete fields and available task capacity. Scope and
  policy versions are checked again after Gemini returns.
- Step 4 uses an editable guidance box instead of two operation checkboxes.
  The model can classify text, visual, layout, asset and other included changes
  into owner tasks. Optional advanced page/element limits narrow eligibility;
  blank means evaluate the confirmed scope. New features outside the saved
  guidance, scope additions, deadline changes, conflicts, cancellations and
  uncertainty require the owner. Existing operation-list policies are preserved
  until explicitly edited. General tasks store instructions and a descriptive
  target; no website edit is executed or claimed.
- Project creation includes independent controls for status answers, clarification
  questions and review acknowledgments. Earlier policies default these to enabled.
  Task acceptance always queues a confirmation. Standalone thanks and gratitude
  emoji stay in conversation history without invoking Gemini or queuing replies.
  Messages combining thanks with a request still follow the normal workflow.
- Clarifications retain their original request and source IDs, with at most two
  questions. No revision is used while waiting. Ambiguous matching requires review.
- Status answers use stored request states as well as task titles and statuses,
  including requests waiting for owner approval or missing details. Owners update task status
  from the task detail panel. Private notes, decision explanations and proposal
  terms are excluded from model context and status replies.
- Each accepted individual request uses one revision in an immutable accounting
  ledger. Task cancellation does not silently refund it. Contractual rounds use owner-managed membership, consumption and refund records. Owner overrides are explicit and audited.
- Owners can accept, decline, dismiss or delete review items. Approval accepts an
  editable task title and an optional private decision reason, saves a real task, accounts
  for the revision and queues a confirmation in the same transaction. An optional
  owner-written reply replaces the default confirmation. Deletion removes an item
  from Needs Attention while retaining source and audit history. Message identity and delivery
  reviews must be checked in the conversation rather than accepted as work.
  When the reason is blank, the audit records the owner's action automatically.
- Failed interpretation retains the verified original text as an approvable
  request. Owners can explicitly authorize that work after reviewing the source;
  no AI-generated values are invented to bypass failed processing.

## Reliability and verification

Per-project jobs run in order with leases, three bounded attempts and stale
snapshot rejection. Model calls run outside database locks. Task, allowance,
decision, audit and reply writes commit together. Incoming message IDs deduplicate
authenticated history, SDK and webhook deliveries. Provider event identity conflicts
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
