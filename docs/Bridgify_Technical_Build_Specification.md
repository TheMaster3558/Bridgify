# Bridgify — Owner workspace and iMessage automation specification

Updated for the current product completion work. This document supersedes the archived dual-sided product specification. See [Product Completion](Product_Completion.md) for the workflow matrix, PR/release status and operator handoff.

## Product and authority

The website is exclusively for project owners. Clients have no website login,
project invitation, portal, shared proposal page, or web approval flow. They
communicate through the verified Photon iMessage conversation selected by the
owner. Client phone identity is independent of Supabase authentication.

Owners authenticate, create their workspace, confirm agreement evidence, connect
a Photon user, send the disclosure introduction, configure permissions and
activate. They manage tasks, commercial exceptions, delivery recovery and policy
amendments. Gemini interprets messages; it cannot set recipients, grant scope,
spend allowance, set prices/dates, mark work complete, or send independently.
The assistant facilitates work that the owner performs; it does not edit websites.

## Owner pages

- Home, Projects and project overview: real database records, paginated discovery,
  setup progress, work/decision counts, revision accounting and approved value.
- Requests and Activity: paginated source evidence and audit history with links to
  decisions, tasks, proposals and retained agreement versions.
- Work: task details, saved status, reviewed corrections/cancellation and explicit
  revision refunds. Private notes never become client replies.
- Needs Attention: original evidence, owner authorization, decline, dismissal,
  deletion and safe reprocessing of eligible failed analysis.
- Scope & Revisions: confirmed agreement versions, request usage, owner-managed
  feedback rounds, round membership, closure and explicit accounting refunds.
- Conversation: real Photon history and owner-written iMessage replies.
- Automation: saved permissions, versioned amendments, worker health, processing
  history, editable/cancellable queued replies and receipt-based delivery recovery.
- Proposals: owner-authored drafts and immutable sent revisions, delivered through
  iMessage. Owners record client-message evidence against the exact frozen terms.
  Approval atomically appends scope and commercial history, creates deliverable
  tasks and queues confirmation. Clients have no website access. Pending,
  superseded, expired or withdrawn terms never authorize work.
- Settings: owner profile, workspace and actual integration health.

## Automated request workflow

Verified client messages are durably deduplicated before interpretation. Check
lifecycle, binding, source timestamps, confirmed scope and saved policy. Split
mixed requests into independent structured intents and send one combined workflow
update. Standalone gratitude is silent. Clarification answers attach only to an
unambiguous unresolved request, with at most two follow-ups.

New policies use editable plain-language acceptance guidance. The model assesses
each request against that guidance and the confirmed agreement; it may recommend
acceptance, clarification or review. The advanced page/element list is optional
and narrows eligibility when populated. There are no preselected change types.
The default guidance covers small content, styling, layout and supplied-asset
updates; owners can edit it. General changes become actionable owner tasks with
instructions and a descriptive target, without invented technical identifiers.
Previously saved operation/target-list policies retain their existing limits
until the owner explicitly saves new settings.

Automatic acceptance requires enabled policy, a clear allowed guidance assessment
(or permitted legacy operation and target),
confirmed inclusion evidence, no exclusion/conflict/deadline change, complete
fields, capacity and available individual-request allowance. Otherwise create an
owner review. Acceptance atomically creates a task, usage entry, audit record and
confirmation. Status answers use actual tasks/requests; older records are searched
within the same project, with bounded matching context and ambiguity handling.

Review & activate lists each missing prerequisite with a link to its setup step.
The activation action explains missing setup or consent when clicked; it is only
disabled while saving or after activation. Client disclosure, a recorded verified
introduction, scope and policy confirmation remain mandatory backend conditions.

Corrections and cancellations require owner authorization and a specific existing
task. Apply them to that task under version checks; never create an accidental
replacement task or silently refund allowance. A correction needs an actionable
owner-reviewed title. Cancellation retains source/history and usage unless the
owner separately authorizes a refund with a reason.

## Replies and recovery

Owner-selected progress notifications report saved started, blocked, completed or
cancelled status. They do not reveal private notes. Queue them in the transaction
that changes status, with unique event identities. Default progress notifications
are off for existing policies until selected.

Only queued outbox items can be edited or cancelled, with optimistic concurrency
and audit. Persist sending before provider I/O. A lost receipt is unknown, never
automatically resent. Reconcile against an actual outbound provider message in
the same conversation, with matching body and attempt time. Owners may explicitly
retry only after checking the conversation and affirming non-delivery. Record the
old attempt and new queued attempt separately. A provider receipt proves provider
submission, not device delivery.

Failed interpretation can be retried only while its review is unresolved and no
work or revision has been committed. Retain failed attempt evidence, re-evaluate
against current scope/policy, and deduplicate previously saved effects. Source
mutation and identity/delivery reviews require separate owner judgment.

## Revisions and amendments

Individual usage is immutable. Refunds are separate, reasoned owner commands;
never delete ledger entries. Feedback rounds are manually opened, populated with
accepted requests, then closed (one round consumed). Only one round may be open
per project. Membership, closure and round refunds are audited and idempotent.
Round mode remains owner-reviewed; no automatic per-message spending of rounds.

Activated policy changes require owner authorization, a reason, expected project
version, validated policy, and an appended policy version. Existing usage carries
forward; amendments do not reset allowance. Lifecycle mode follows the new policy
unless paused. Scope, prices and deadlines cannot change through this command.

## Security and migration

Supabase RLS restricts all website data to workspace owners. Server commands
check auth.uid(), project ownership, lifecycle, versions and idempotency. Old
invitation/shared-proposal RPC privileges and legacy onboarding entry points are
revoked. Historical invitation/member records remain private audit history;
revocation does not delete accounts or alter old agreements.

Credentials and raw provider errors stay server-side. Model context excludes
private notes and secrets. Client text is data, never tool instructions. Provider
recipient authorization failures are distinct from uncertain sends.

## Operations and acceptance

Deployment uses Vercel authenticated bounded automation batches with durable
Postgres leases and health records, not an infinite in-function polling process.
Signed Photon webhooks persist messages and start processing immediately. Supabase
Cron resumes saved work on Vercel Hobby; normal delivery never waits for this
scheduler. An optional long-running local SDK listener feeds the same durable
inbox and wakes the same processor immediately, without a public URL or webhook
secret. It catches up history at startup/stream reopen, reconnects on failure,
retries uncommitted event writes and shuts down on SIGINT/SIGTERM. SDK provenance
does not mark a binding as webhook-verified. Both modes deduplicate on the provider
message GUID and use the shared outbox. Keep one local listener active and stop it
after hosted delivery is verified. Explicit history import also recovers deployment gaps. Health shows last success,
staleness, dependency failures and backlog. Overlapping invocations cannot apply
the same effect twice. No fake health, messages, tasks or seed customer records.

Every owner operation must be reachable from the UI, enforced by the backend,
transactional and audited. Test migrations on a clean database, tenant isolation,
stale writes, duplicate commands, ambiguous receipts, model failure, retries,
policy changes and accounting. Verify owner browser flows and retired client URLs.

Deployment: [operator steps for Vercel Hobby](Automation_Deployment.md).

## Version boundary

This version excludes subscriptions/billing, paid-plan limits, team access,
reminders, private owner notifications, policy simulation, private asset management,
automatic pre-work corrections and exports. Existing optional progress replies
remain part of project automation. Interface changes support functioning actions;
there is no visual redesign.

Current-product code is delivered in unmerged, dependency-ordered PRs until the
owner chooses to merge and deploy. Live-provider verification remains a release
step, not an inference from local tests.
