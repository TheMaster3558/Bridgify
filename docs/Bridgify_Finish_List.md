# Bridgify finish list

Every remaining task from the technical build specification. The page shells already exist. **P0** is the release. **P1** comes after that release.

- P0 tasks: 141 (140 open, 1 done)
- P1 tasks: 9

P2 stays out of this list: automatic website edits, payments, e-signatures, accounting, voice notes, arbitrary OCR, extra messaging channels, forecasts, and autonomous price negotiation. A chat “yes” is never proposal approval.

## Build order

Suggested sequence from the technical specification, section 20. These elapsed hours are an order of work, not a promise that it fits in 36 hours.

| When | Do this before expanding scope |
| --- | --- |
| 0–3 h | Photon receive and send, Gemini schema, roles, revision semantics |
| 3–7 h | Migrations, auth, project setup, shared dashboard shell |
| 7–12 h | Manual acceptance transaction, revision ledger, task actions |
| 12–17 h | Gemini extraction, policy routing, clarification, inbox worker |
| 17–22 h | Real automatic replies, exception decisions, delivery states |
| 22–27 h | Proposal editor, client approval, atomic scope and tasks |
| 27–31 h | Concurrency and access tests, task completion, audit fix |
| 31–36 h | Fixes and demo rehearsal. No new feature expansion |

If the core loop is not working by hour 22, shrink the proposal screens rather than leaving buttons that do nothing.

## Foundation

- [x] **P0.** App scaffold is in place

  Done. Next.js, React, TypeScript, Tailwind, shadcn/ui, and a lockfile. Pages are static shells.

- [ ] **P0.** Validate environment variables at startup

  Require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, GEMINI_API_KEY, GEMINI_MODEL, PHOTON_HTTP_ADDRESS, PHOTON_TOKEN, APP_BASE_URL, and WORKER_ENABLED. Add PHOTON_INSTANCE_ID only if provisioned. Fail closed and never print secrets.

- [ ] **P0.** Add .env.example and a demo-mode flag

  DEMO_MODE must visibly mark simulated messages. It cannot look like a real Photon demonstration.

- [ ] **P0.** Pin the Gemini model from the sponsor account

  Confirm the model, quota, structured-output schema, and data-use terms. Do not hardcode an unverified model id.

- [ ] **P0.** Provision Photon before writing provider-specific code

  Confirm instance, address, token, bot identity, a consented test group, webhook verification, sender and chat GUIDs, echo behavior, edits, deletions, replay, delivery recovery, quotas, and hosting. Do not guess event shapes.

- [ ] **P0.** Shared /api/v1 response and mutation contract

  Success is { data, requestId }. Errors are { error: { code, message, fieldErrors? }, requestId }. Use 400, 401, 403, 404, 409, 422, 429, and 503. Mutations that can repeat take Idempotency-Key and expectedVersion.

- [ ] **P0.** Shared helpers for money, time, and pages

  Integer cents, USD only, timestamps in the project timezone, and 25-row pagination. Zod validates API, model, and domain objects.

## Database

- [ ] **P0.** organizations and organization_members

  UUID keys, UTC timestamps, unique organization and user pair, role on the membership.

- [ ] **P0.** projects and project_members

  Name, client label, status, currency, original_amount_cents, agreed_due_at, timezone, current scope and policy versions. Roles are owner, requester, approver, and teammate.

- [ ] **P0.** conversations and participant_bindings

  Bind provider instance and chat GUID. One active group per project. Unique active instance plus chat GUID. Sender display names never grant authority.

- [ ] **P0.** documents, document_spans, and private storage

  Store agreement text or a text PDF privately. Spans keep page, offsets, and source text. Processing status and extraction errors are visible. Access uses expiring authorized URLs.

- [ ] **P0.** scope_versions, scope_items, and scope_targets

  Versions are append-only. Items are inclusions or exclusions with a source quote. Targets have a stable id, page, element, allowed operations, and owner confirmation.

- [ ] **P0.** policy_versions

  Versioned mode, allowed operations, target ids, maximum open tasks, and notification rules. Saving creates a new version. History is kept.

- [ ] **P0.** revision_buckets and revision_ledger

  Available is total minus reserved minus consumed. CHECK counts are non-negative and reserved plus consumed is at most total. Ledger rows have actor, reason, and a unique idempotency key. Default allowance is 0.

- [ ] **P0.** inbox_events, messages, and message_revisions

  Unique provider event key. Unique conversation plus provider message GUID. Edits are revisions, not new messages. Keep provider time and received time.

- [ ] **P0.** requests, request_sources, and assessments

  One message can create several requests. Assessments store scope and policy versions, reason codes, evidence, and the model and prompt version.

- [ ] **P0.** work_authorizations, decisions, tasks, and task_notes

  Unique task origin per accepted request revision. Notes are internal or public_completion. Decisions store reason, status, resolution, and owner.

- [ ] **P0.** proposals, proposal_revisions, and approvals

  Sent terms are immutable and hashed. Amounts are non-negative integer cents. Unique approval per revision. Proposal tasks are unique by revision plus line-item key.

- [ ] **P0.** jobs, outbox_messages, notifications, and audit_events

  Jobs have attempts, available_at, and lease_until. Outbox has a unique dedupe key and a separate delivery state. Notifications dedupe. Audit events store actor, action, object version, and safe metadata.

- [ ] **P0.** Indexes and composite constraints

  Index project plus status plus updated_at, conversation plus timestamp, jobs state plus available_at, and outbox state plus available_at. Enforce project consistency on scoped commands.

- [ ] **P0.** Row-level security before any browser access

  Owners see records for their membership. Clients can read only shared proposal fields. Private notes, margins, tasks, and other projects are excluded. Service-role access bypasses RLS, so workers must enforce scope themselves.

- [ ] **P0.** Seed the Harbor & Pine synthetic project

  $3,000, five pages, accounts and payments excluded, one requester and approver, two confirmed targets, two per-request revision units, image replacement disabled. Seed the ten labeled fixture messages from the spec.

## Auth

- [ ] **P0.** Email and password sessions

  Use Supabase Auth. One working method is enough. Wire the existing /login form to a real session.

- [ ] **P0.** Protect every /app route

  Unauthenticated visitors go to /login. Role checks are server-side. The client approver cannot open owner pages.

- [ ] **P0.** Client invite returns to the exact proposal

  After sign-in, send the designated approver to /proposals/:id?revision=N. A link is navigation, not authority.

- [ ] **P0.** Neutral invalid-invite error

  Expired or invalid invites do not reveal the organization or project. Tell the person to request a new link. Configure the redirect allowlist.

- [ ] **P0.** Sign out from Settings

  Clear the Supabase session and return to /login.

## Domain

- [ ] **P0.** Policy engine for AcceptanceCandidate

  Server reloads every referenced record. The model cannot supply authority or balances. Accept only when the project is active, the chat and requester are verified, automation is enabled, the scope baseline is confirmed, versions match, the operation and target are complete, and capacity remains.

- [ ] **P0.** Allow only replace_text and change_color

  replace_image_reference stays disabled. Behavior changes, authentication, checkout, payments, new pages, integrations, database changes, security settings, and unknown operations always escalate. A policy cannot expand the signed scope.

- [ ] **P0.** Per-request revision transactions

  Accept reserves one unit and creates one task. Start, or complete directly from ready, consumes it once. Cancel before start can release it. Cancel after start does not refund it. Lock the bucket so two requests cannot claim the last unit.

- [ ] **P0.** Request state machine

  received, analyzing, awaiting_details, awaiting_owner, accepted, ignored, proposal_pending, declined, dismissed. One message can create several requests. Corrections to accepted work become owner decisions. At most two clarification turns, then escalate. At most one acknowledgment per request version.

- [ ] **P0.** Task state machine

  ready, in_progress, blocked, done, cancelled. Reopen only with an audit note, and never consume the allowance twice. Editing a task cannot change price or scope. Completion records the owner’s statement and does not claim a deployment was verified.

- [ ] **P0.** Proposal revisions and atomic approval

  draft, awaiting_client, approved, declined, changes_requested, expired, withdrawn, superseded. Delivery is a separate state. Sending freezes terms. A change creates revision N+1. Approval writes the approval, scope version, tasks, approved value, outbox, and audit in one transaction. A repeat approval returns the earlier result.

- [ ] **P0.** Controlled reply templates

  Render acceptance, clarification, exhausted allowance, exclusion, uncertainty, deadline, status, proposal link, attachment, and complaint replies from server templates after the database decision. Escape values. Do not let Gemini decide permission and wording together.

- [ ] **P0.** Visible processing limits

  Batch bursts for 3 seconds. Read at most 20 recent messages and 10 unresolved requests. Reject agreements over 30,000 characters with a visible error. Cap open auto-accepted tasks at 10. Do not fetch client URLs. Do not invent dates, fees, refunds, or completion claims.

- [ ] **P0.** Waivers and zero-price proposals

  An extra revision is a ledger entry with actor and reason. New scope at no charge is a zero-price proposal and client approval, not a silent edit of the agreement.

## Gemini

- [ ] **P0.** extractScope from document spans

  Return draft inclusions and exclusions with source span ids. The owner confirms each item. Nothing is truncated silently.

- [ ] **P0.** interpretMessages and assessRequests

  One structured call is enough for P0. Intents are new_request, clarification_answer, correction, cancellation, status_question, casual, dispute, or unsupported. Output operation, target, payload, evidence, missing fields, and ambiguity. Never an authority token.

- [ ] **P0.** draftProposal for owner-reviewed wording

  Gemini may draft the client explanation from owner-confirmed terms. It does not set price, date, or approval.

- [ ] **P0.** Validate model output before any effect

  Parse with Zod, check enums and ids, require operation fields, reject contradictions and stale versions, then pass the result to the policy engine. One retry for malformed output, then an owner decision. Record the model and prompt version.

- [ ] **P0.** Give the model no tools or credentials

  Do not run URLs, SQL, function names, or code from the model. Exclude owner-private notes from interpretation. Cap tokens and input size. Keep message bodies out of general logs.

## Photon

- [ ] **P0.** MessagingAdapter

  verifyAndNormalize and sendText(chatGuid, text). Map the installed @photon-ai/advanced-imessage payloads in one module. Save a sanitized fixture. Store the returned message GUID.

- [ ] **P0.** Verified webhook intake

  POST /api/v1/integrations/photon/webhook reads the raw body, verifies the provisioned mechanism, stores the inbox event, enqueues analysis, then acknowledges. A failed intake returns a transient error. Unverified intake cannot create work.

- [ ] **P0.** Sender, echo, and membership checks

  Use chat GUIDs, not phone numbers or group names. Bot-originated events never re-enter analysis. Unknown senders get no project details. A membership change pauses affected automation until the owner verifies it.

- [ ] **P0.** Outbox send and unknown delivery

  States are pending, sending, sent, failed_retryable, unknown, and cancelled. A timeout after submission becomes unknown. Do not resend blindly. The owner can confirm delivered, resend after review, or cancel.

- [ ] **P0.** Activation cutoff

  Messages before activation are context only. They are never turned into work. Replay after an outage is bounded and reviewed when old or conflicting.

- [ ] **P0.** Test message to the configured test group

  Settings can check the connection and send one test. Reachable does not mean a client message was delivered. Identifiers shown in the UI are masked.

## Worker

- [ ] **P0.** Postgres job runner

  Claim with skip-locked, a 60-second renewable lease, attempt count, and heartbeat. Retry at 5s, 30s, and 120s, then send the job to Needs Attention. No Redis in P0.

- [ ] **P0.** extract_document job

  Use pdfjs-dist, keep page references, and reject scanned or oversized files with a visible error.

- [ ] **P0.** analyze_conversation job

  Lease one project at a time. Call Gemini outside database locks. If a newer message arrives, schedule another pass. Discard a stale result that conflicts with a candidate acceptance.

- [ ] **P0.** deliver_message and reconcile_delivery jobs

  Send queued text through Photon. A failed send leaves the accepted task in place and shows a delivery issue. It must not create a second task.

- [ ] **P0.** Commit effects only through domain transactions

  Do not hold a business-row lock during a model call or network send. Recheck scope, policy, and request versions at commit. Lock resources in a consistent order.

## API

- [ ] **P0.** GET /api/v1/dashboard

  Role-filtered counts and queues for ready tasks, decisions, awaiting approval, integration issues, and recent automatic handling. Counts come from stored statuses.

- [ ] **P0.** GET and POST /api/v1/projects

  List projects the member can see. Create a draft with basics only.

- [ ] **P0.** GET and PATCH /api/v1/projects/:id

  Read one project. Update permitted metadata with expectedVersion. Archive requires confirmation and stops automatic acceptance.

- [ ] **P0.** POST /api/v1/projects/:id/documents

  Accept pasted text or a text PDF and enqueue extraction.

- [ ] **P0.** GET /api/v1/documents/:id/extraction

  Return the draft extraction and source spans, including processing and error states.

- [ ] **P0.** POST /api/v1/projects/:id/scope/confirm

  Confirm a draft scope version from validated source ids. After activation, a transcription fix is an audited correction, not a deletion.

- [ ] **P0.** POST /api/v1/projects/:id/chat-binding

  Save the verified instance, chat GUID, and participant map. This input does not go through the model.

- [ ] **P0.** POST /api/v1/projects/:id/activate

  Server-side only. Require a confirmed scope item, participant binding, revision semantics, a delivered group test, and participant disclosure. Draft projects never auto-accept.

- [ ] **P0.** GET and PUT /api/v1/projects/:id/policy

  Read the current policy. PUT creates the next confirmed version.

- [ ] **P0.** POST /api/v1/projects/:id/pause

  Set paused or review_only with a reason. Stop new auto-acceptances. Do not delete committed tasks. Resume does not blindly replay old requests.

- [ ] **P0.** GET /api/v1/projects/:id/requests

  Paginated history with filters for accepted, clarifying, owner decision, pending approval, and closed.

- [ ] **P0.** GET /api/v1/requests/:id

  Evidence, assessment, applied rule, revision usage, and follow-up messages.

- [ ] **P0.** POST /api/v1/decisions/:id/resolve

  Resolutions are accept included work, allow an extra revision, ask the client, prepare a proposal, decline, or dismiss. Require expectedVersion. Accepting after a failed policy check requires an override reason. No bulk resolve in P0.

- [ ] **P0.** GET and POST /api/v1/projects/:id/tasks

  List actionable tasks. The owner can create a manual task. Proposed work stays out of this list.

- [ ] **P0.** PATCH /api/v1/tasks/:id

  Change status, assignment, blocked reason, or internal notes with expectedVersion. A 409 refetches and keeps the draft.

- [ ] **P0.** POST /api/v1/tasks/:id/complete

  Save the completion note. notifyClient defaults off. Consume a reserved unit in the same transaction when needed.

- [ ] **P0.** POST /api/v1/tasks/:id/cancel

  Require a reason. If work started or the client was already promised the work, require a reviewed client explanation.

- [ ] **P0.** GET /api/v1/projects/:id/revisions

  Return the bucket, active reservations, and ledger.

- [ ] **P0.** POST /api/v1/projects/:id/revisions/adjust

  Owner reason, delta, and explicit waiver or entitlement semantics. Never rewrite history.

- [ ] **P0.** POST /api/v1/projects/:id/proposals

  Create a draft from a request id and owner-confirmed terms.

- [ ] **P0.** PUT /api/v1/proposals/:id/draft

  Edit only the current draft. Line items are integer cents. Label the amount as additional project price. No tax, discount engine, or payment button.

- [ ] **P0.** POST /api/v1/proposals/:id/send

  Freeze the revision, check expectedScopeVersion, and queue the iMessage. Unknown delivery is not approval.

- [ ] **P0.** POST /api/v1/proposals/:id/supersede

  Create the next revision and make the previous pending revision unapprovable. Sent and approved proposals cannot be deleted.

- [ ] **P0.** GET /api/v1/proposals/:id/shared

  Authorized client DTO only: project, revision, deliverables, exclusions, price, date impact, expiry, and status. No owner notes or other projects.

- [ ] **P0.** POST /api/v1/proposals/:id/respond

  Body is revision, termsHash, and approve, decline, or changes_requested, plus an optional note. Check the designated approver, membership, expiry, and current revision.

- [ ] **P0.** GET /api/v1/projects/:id/messages

  Paginated conversation evidence with delivery state. Private owner prompts are excluded.

- [ ] **P0.** GET /api/v1/projects/:id/activity

  Paginated audit history filtered by request, acceptance, revision, decision, proposal, approval, task completion, policy, and integration.

- [ ] **P0.** GET /api/v1/integrations/health

  Authorized, redacted Photon and Gemini status, last inbound event, webhook status, and outbox issues. No browser-visible keys.

## Pages

- [ ] **P0.** Wire /login

  Replace the static owner, client-invite, and expired states with real auth results and field errors.

- [ ] **P0.** Wire /app/projects/new

  Save progress across Basics, Agreement, People and chat, Automation, and Review. Activate only after the server checks pass. Show extraction processing and a visible rejection for oversized or scanned files.

- [ ] **P0.** Wire /app

  Fill Home from GET /dashboard. Cards link to records. Empty state is create your first project. Do not invent hours saved or revenue recovered. Show the system banner for disconnects, backlog, and paused projects.

- [ ] **P0.** Wire /app/projects

  Live list with name search and state filter. Archive asks for confirmation. Completed and archived projects stop accepting new work.

- [ ] **P0.** Wire /app/projects/:id

  Show client, baseline, dates, owner, scope version, automation, approved value, revision availability, connection, recent handling, decisions, and pending proposals. Approved total is original plus approved additions, never payment collected.

- [ ] **P0.** Wire /app/tasks and /app/projects/:id/work

  Both routes use one task component and the same records. Filters are project, status, due, and assignee. Actions are open, start, block, complete, create, and cancel. The list is required. The board can stay a static preview.

- [ ] **P0.** Wire /app/tasks/:taskId

  Show the requested change, target, acceptance criteria, source messages, scope item, policy version, revision reservation, internal notes, and history. The notify-client checkbox defaults off.

- [ ] **P0.** Wire /app/decisions

  Filter by reason. The detail panel shows the source, evidence, missing fields, options, private notes, an editable reply preview, and history. Wait for the server before confirming a resolution.

- [ ] **P0.** Wire /app/projects/:id/requests

  Full history and the selected request’s analysis, rule, revision usage, and follow-ups. Opening a request does not create a second task.

- [ ] **P0.** Wire /app/projects/:id/scope

  Agreement, current scope, revision allowance, and versions. Actions are confirm baseline, audited correction, entitlement adjustment, and waiver. Round mode stays unavailable.

- [ ] **P0.** Wire both proposal lists

  /app/proposals and /app/projects/:id/proposals share one list. Columns are number, client or project, revision, additional price, business status, delivery status, and sent date.

- [ ] **P0.** Wire /app/projects/:id/proposals/:proposalId

  Edit draft terms, generate wording, preview the exact iMessage, save, send, supersede, and withdraw. Show the value if approved and the tasks that approval would create. Private pricing notes never leave this page.

- [ ] **P0.** Wire /proposals/:id

  Authenticate before private data. Show exact terms and require a second confirmation click. Handle open, approved, superseded, expired, and unauthorized states. A repeat visit shows the original result.

- [ ] **P0.** Wire /app/projects/:id/conversation

  Read-only thread with client messages, bot replies, timestamps, delivery uncertainty, and linked requests. Distinguish paused, pending, ignored, and processed. The owner composer stays disabled.

- [ ] **P0.** Wire /app/projects/:id/activity

  Timeline of actor, time, version, and linked record. Export is not part of this release.

- [ ] **P0.** Wire /app/projects/:id/automation

  Save a new policy version for mode, operations, targets, exclusions, allowance, open-task cap, and completion preference. Explain that policy cannot expand scope. The simulator is P1.

- [ ] **P0.** Wire /app/settings

  Save profile, timezone, and organization. Show redacted Photon and Gemini health from GET /integrations/health. The UI does not accept provider keys.

- [ ] **P0.** Loading, empty, error, and denied states on every data surface

  Include retry, last refreshed time, visible keyboard focus, and text labels beside color. Disable the clicked button while a mutation is pending. Do not optimistically confirm approval, policy, or send.

- [ ] **P0.** Refresh authorized records

  Supabase Realtime invalidates the dashboard. Reconnect and refocus refetch. If subscriptions fail, poll every 15 seconds.

## Failures

- [ ] **P0.** Gemini unavailable

  Keep the intake, show pending processing, retry with backoff, and do not fabricate an acceptance.

- [ ] **P0.** Photon unavailable

  Queue a safe send and show the failure. Do not imply the client was informed.

- [ ] **P0.** Timeout after send

  Mark delivery unknown. Offer reconciliation or manual review. Do not send a duplicate automatically.

- [ ] **P0.** Two requests and one revision left

  One request reserves the unit. The other escalates. Counters never go negative.

- [ ] **P0.** Duplicate webhook

  One normalized request and one set of effects.

- [ ] **P0.** Invalid scope citation

  No automatic acceptance. Retry once or escalate.

- [ ] **P0.** Accepted request edited later

  Preserve history. P0 sends the change to the owner instead of reversing the commitment.

- [ ] **P0.** Requester added or removed

  Pause the affected automation until membership is verified.

- [ ] **P0.** Client asks for private pricing

  Do not disclose owner notes or margins. Give a general scope response or escalate.

- [ ] **P0.** Proposal edited after send

  The old revision is superseded and needs a fresh client approval.

- [ ] **P0.** Approval racing a scope change

  Return a conflict for owner review. Do not write a partial update.

- [ ] **P0.** Stale dashboard write

  Return 409, refetch, and preserve the recoverable draft.

- [ ] **P0.** Unsupported attachment or voice note

  Ask for text and record unsupported input. Do not pretend to interpret the file.

- [ ] **P0.** Owner marks work done

  The client reply says the owner marked it complete. It does not say the work was independently tested or deployed.

- [ ] **P0.** Unclear allowance

  Stay in review-only until the owner configures per-request counting. Do not silently treat a round-based agreement as per-request.

## Security

- [ ] **P0.** Separate private and client DTOs

  Hiding a field in React is not enough. Client responses are built from an allowlist.

- [ ] **P0.** Verify webhook origin and dedupe replays

  Use the vendor’s actual verification mechanism. Reject unverified bodies before any write.

- [ ] **P0.** Treat client text as untrusted

  Prompt-injection text cannot change rules, recipients, or allowance. Escape previews. Do not render raw model HTML.

- [ ] **P0.** Keep contracts and message bodies out of general logs

  Log operational ids and typed errors. Restrict access to raw fixtures.

- [ ] **P0.** Participant disclosure

  Activation requires the owner to confirm that people in the group know an assistant reads and replies. Connect only the agreed project chat.

- [ ] **P0.** Use synthetic data for the demo

  Do not imply production retention, deletion, backup, or incident recovery is solved. P0 stores only the agreement text and message text the workflow needs.

## Tests

- [ ] **P0.** Policy allow and deny tests

  Cover every operation, scope exclusion, missing field, and paused project.

- [ ] **P0.** Revision bucket and concurrency tests

  Constraints hold, and two concurrent requests cannot claim the last unit.

- [ ] **P0.** Task allowance tests

  Start, direct completion, and cancel do not consume a unit twice.

- [ ] **P0.** Inbox and outbox dedupe tests

  A repeated event creates no second request, task, or send.

- [ ] **P0.** Stale analysis test

  An analysis against an old scope, policy, or request version is rejected.

- [ ] **P0.** Atomic idempotent approval test

  Exact revision approval writes scope, tasks, and value once. Repeating it returns the first result.

- [ ] **P0.** Role access tests

  A client cannot read owner notes or another project. An unknown sender cannot authorize work. Model output cannot choose a recipient or execute code.

- [ ] **P0.** Delivery timeout test

  A timeout after submission becomes unknown and is not resent automatically.

- [ ] **P0.** 30-case labeled assessment set

  Include held-out examples. Report classification errors and false acceptances. Any unsupported automatic commitment disables that operation.

- [ ] **P0.** Browser journey: setup and activation

  Owner completes the wizard and activates only after the required checks.

- [ ] **P0.** Browser journey: routine acceptance

  A real routine iMessage becomes one task and one reply without owner approval.

- [ ] **P0.** Browser journey: exception decision

  The owner’s resolution sends the correct client reply.

- [ ] **P0.** Browser journey: client approval

  Approving the exact proposal creates tasks and scope once.

- [ ] **P0.** Browser journey: task completion

  The owner completes a task and can choose whether to notify the client.

- [ ] **P0.** Browser journey: pause and failed processing

  Paused automation and delivery failures stay visible.

## Deploy

- [ ] **P0.** Apply ordered migrations

  Create the database, then enable RLS and private storage before browser access.

- [ ] **P0.** Deploy the web app and a persistent worker

  One Next.js host for short requests and one Node worker for extraction, analysis, and delivery. No per-domain microservices.

- [ ] **P0.** Register and verify the live webhook

  Test exact group routing with consenting participants, then one model call and schema handling.

- [ ] **P0.** Enable automation only after setup is confirmed

  Run the vertical slice and role tests first. Do not send production customer traffic.

- [ ] **P0.** GitHub Actions for tests

  Run domain, integration, and the required browser journeys on pull requests.

- [ ] **P0.** VEYZL audit and a fixed finding

  Connect the repo, run the audit, fix one real finding, and keep the pull-request evidence.

## Later

- [ ] **P1.** Revision-round accounting

  A round belongs to a deliverable. Opening reserves one unit. Grouped feedback creates several tasks without extra units. The owner opens and closes rounds.

- [ ] **P1.** Richer multi-project portfolio

  The P0 list is enough for the release. Portfolio analytics wait.

- [ ] **P1.** Teammates and notification preferences

  Teammates manage assigned work and have no commercial authority by default.

- [ ] **P1.** Safe pre-work corrections

  An explicit correction policy may update an accepted request before work starts.

- [ ] **P1.** Owner-only iMessage notifications and composer

  Requires a verified private destination. Never reuse the client group GUID. Owner chat cannot bypass proposal approval.

- [ ] **P1.** Policy simulator

  Paste a request and preview the assessment with no sends and no writes.

- [ ] **P1.** Private assets and image replacement

  Enable replace_image_reference only after owner-approved asset handling exists.

- [ ] **P1.** Pause and resume replay controls

  Show aged unresolved items for review instead of replaying every old request.

- [ ] **P1.** Activity export, reminders, and Kanban

  These are specified later. The P0 activity page is a timeline, and P0 work is a list.

