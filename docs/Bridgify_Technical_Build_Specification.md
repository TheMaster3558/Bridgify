# Bridgify — Technical Build Specification
**Version:** 1.0 · October 16, 2026  
**Purpose:** Implementation contract for the automated iMessage assistant and business-owner dashboard.  
**Basis:** The current Bridgify Idea Summary, including automatic acceptance of eligible routine work.  
**Status:** Proposed implementation; features, integrations, tests, and audits described here are not yet completed.

## 0. Read This First

Build a system that:
1. Receives client messages from a linked iMessage group through Photon.
2. Uses Gemini to extract requests and understand their relationship to a confirmed project scope.
3. Automatically accepts explicitly authorized routine requests when sufficient revision allowance exists.
4. Creates actionable tasks and sends confirmation without asking the owner each time.
5. Clarifies straightforward missing details directly with the client.
6. Privately escalates exceptions to the owner.
7. Lets the owner complete work, decide exceptions, and manage proposals through a dashboard.
8. Updates scope and tasks atomically after explicit approval of additional work.

**The dashboard is the owner's main workspace. iMessage is the client interaction channel.**

Acceptance means “this work is on the freelancer's work list,” not “the website has been edited.” Website editing, deployment, invoicing, and payment collection are outside this release.

### Priorities

- **P0:** Required for the 36-hour end-to-end release.
- **P1:** Specified next-stage capability; do not build before P0 works.
- **P2:** Future product direction, explicitly excluded from the hackathon.

No specification can eliminate provider setup uncertainty or all semantic ambiguity. This document fixes application behavior and identifies dependencies that must be verified rather than inventing provider capabilities.

## 1. Release Scope and Definition of Done

### P0 vertical slice

One organization, an authenticated owner, a designated client approver, one project, one Photon-linked group, a confirmed agreement, supported routine categories, and one working proposal lifecycle. Structure the schema for multiple projects, but demonstrate and test one full project first.

A release is complete when:
- A routine request causes an automatic reply and exactly one actionable task.
- Available revision allowance is checked and reserved in the same transaction.
- A missing-detail request triggers a client clarification.
- Exhausted revisions and out-of-scope requests appear in Needs Attention.
- Owner action produces the appropriate client reply.
- A client can authenticate and approve an exact proposal revision.
- Scope, tasks, and approved value update together, once.
- Completing a task can queue a factual completion update after explicit owner confirmation.
- The dashboard shows processing and delivery failures truthfully.
- Private notes and cross-project data are inaccessible to the client.
- Duplicate events, concurrent requests, and duplicate approvals are tested.

### P1 and P2

P1: Revision-round accounting, multiple projects at realistic scale, teammate management, safe pre-work corrections, owner-private iMessage notifications, reminders, private assets, pause/resume replay controls.

P2: Automatic website modification, payment collection, e-signatures, accounting integrations, voice notes, arbitrary OCR, multiple messaging channels, profitability forecasts, autonomous price negotiation.

## 2. Technology and Repository

| Layer | Choice | Responsibility |
|---|---|---|
| Web | Next.js, React, TypeScript | Dashboard, approval page, authenticated API |
| UI | Tailwind, shadcn/ui | Forms, dialogs, tabs, tables, accessible controls |
| Database | Supabase Postgres | Authoritative project state, constraints, transactions |
| Auth | Supabase Auth | Owner and client sessions |
| Storage | Private Supabase Storage | Agreements; later assets |
| Updates | Supabase Realtime | Invalidate/refetch authorized dashboard records |
| Model | Gemini API via @google/genai | All interpretation and drafting |
| Validation | Zod | API, model, and internal object validation |
| Messaging | @photon-ai/advanced-imessage HTTP transport | Photon sends; webhook receives events |
| Worker | Node.js / TypeScript | Document extraction, analysis, outgoing delivery |
| PDF | pdfjs-dist | Text extraction with page references |
| Tests | Vitest + Playwright | Domain logic, transactions, role access, journeys |
| Deployment | Next.js host + persistent Node worker host | Separate short requests from background jobs |
| Review | GitHub Actions and VEYZL | CI and real audit/remediation evidence |

Use a supported Node LTS, pin dependencies and a lockfile, and select the Gemini model available to the actual sponsor account. Do not hardcode an unverified model identifier.

Suggested structure:

```text
app/
  (auth)/login/
  (owner)/app/
  (owner)/app/projects/new/
  (owner)/app/projects/[projectId]/
  (owner)/app/settings/
  proposals/[proposalId]/
  api/
components/
  dashboard/
  requests/
  tasks/
  proposals/
  setup/
lib/
  auth/
  db/
  schemas/
  ai/
  photon/
  domain/
    policies.ts
    requests.ts
    revisions.ts
    tasks.ts
    proposals.ts
    messages.ts
workers/
  index.ts
  process-inbox.ts
  analyze-project.ts
  deliver-outbox.ts
supabase/
  migrations/
  seed.sql
tests/
  domain/
  integration/
  e2e/
```

Avoid separate microservices for each domain. One web application, one worker, and Postgres are enough.

## 3. Roles and Authority

| Actor | Authority |
|---|---|
| Owner | Configure automation; confirm scope; decide exceptions; set terms; manage tasks |
| Client requester | Submit requests in a verified linked group |
| Client approver | Read shared proposal terms and explicitly approve/decline |
| Teammate (P1) | Manage assigned work, without commercial authority by default |
| Gemini | Propose structured interpretations and text; no direct write/send/approval power |
| Policy engine | Decide whether standing owner authorization applies |
| Worker | Apply validated commands through scoped domain functions |
| Photon | Transport messages; not the source of application authorization |

Sender display names never grant authority. Bind provider sender identities to project membership through owner-confirmed setup. Unknown participants cause a review condition.

P0 owner-private prompts are dashboard notifications. Add private iMessage notifications only after verifying a separate owner-only destination; never reuse the client group's GUID for private messages.

## 4. Dashboard Information Architecture

### Navigation

Global sidebar:
- Home.
- Projects.
- Actionable Tasks.
- Needs Attention.
- Proposals.
- Settings.

Inside a project:
- Overview.
- Work.
- Requests.
- Scope & Revisions.
- Proposals.
- Conversation.
- Activity.
- Automation.

**Implement shared filtered components, not independent copies.** Global Tasks and Project Work read the same task records; global Proposals and project Proposals share the same list component.

Global header: organization/project context, connection health, account menu. Project header: project name, client, status, automation badge, Pause automation, project tabs.

### Common interface contract

Every data surface needs loading, empty, populated, error/retry, and permission-denied states. Show last refreshed time if data may be stale. Use pagination (25 records initially), explicit filters, descriptive button labels, visible keyboard focus, and text status labels alongside colors.

Mutations disable the relevant button while pending and use idempotency keys. Approval, policy changes, and proposal sends wait for server success rather than optimistic confirmation. Preserve unsaved drafts when recoverable.

## 5. Exact Page Specifications

### 5.1 Login and invitation — /login

**P0.** Email/password or configured Supabase email authentication; choose one working method early. Fields: email, password where applicable; sign in; error; sign out. Client invitation returns the client to the exact proposal after authentication.

No public organization selection that reveals other customers. Invalid/expired invite gives a neutral error and request-access instruction. Configure redirect allowlists.

### 5.2 Project setup — /app/projects/new

**P0.** Five-step wizard with saved progress.

1. **Basics:** Project name, client name, original price in cents, currency (USD-only P0), project timezone, optional agreed completion date.
2. **Agreement:** Paste text or upload text PDF; processing status; extracted inclusions/exclusions; source preview; owner edits and confirms.
3. **People and chat:** Owner identity, designated client requester/approver, exact Photon instance and chat binding; verified group test; mapping confirmation.
4. **Automation:** Allowed routine operations, exclusions, allowance mode/limit, target pages, pause behavior, notifications.
5. **Review and activate:** Show all settings and assistant introduction preview; confirm participant disclosure; activate only after required checks.

Validation: Positive or zero original amount; currency required; due date is an agreed date, not an AI prediction; at least one confirmed scope item and participant binding; at most one active group per project for P0.

Draft projects receive stored intake only if intentionally connected but cannot automatically accept. Activation is a server-side guarded transition.

### 5.3 Home — /app

**P0.** The owner's daily landing page.

Widgets:
- Ready tasks.
- Decisions needed.
- Awaiting client approval.
- Automation/integration issues.

Main areas:
- Needs Your Decision: exceptions, reason, project, age, Open decision.
- Work Next: ready/in-progress tasks, due date or No date agreed, assignee.
- Handled Automatically: recent accepted changes and clarifications, source link.
- System banner: disconnected messaging, backlog, or paused project.

Cards link to records, not static summaries. Counts derive from defined statuses. No fabricated hours saved or revenue recovered.

Empty state: Create your first project. Never put every routine success in the decision queue.

### 5.4 Projects — /app/projects

**P0 simple list; P1 richer portfolio.** Name, client, project state, automation state, pending decisions, next agreed date, approved value. Filter by state and search by name. Create/open project. Archive action requires confirmation; completed/archived projects no longer accept new work automatically.

No public client directory is needed.

### 5.5 Project Overview — /app/projects/:id

**P0.** Summary: client, baseline, agreed dates, owner, current scope version, automation state.

Sections:
- Ready work and blockers.
- Recent automatic handling.
- Open decisions.
- Pending proposals.
- Original value + approved additions = approved total.
- Revision availability and active reservations.
- Connection state and last successful event receipt.

Buttons: Open Work, Review decisions, View scope, Configure automation. Financial labels never imply payment collected. Deadline changes appear only after an authorized decision.

### 5.6 Work — /app/tasks and /app/projects/:id/work

**P0.** List is required; Kanban is optional polish.

Columns: task title, project, status, priority, assignee, agreed date, acceptance origin, update time. Filters: project, status, due, assignee.

Statuses: ready, in_progress, blocked, done, cancelled. Proposed/unaccepted work belongs in Requests/Proposals, not this actionable table.

Actions: Open task; start; mark blocked with reason; complete; manual task creation; owner-confirmed cancellation. Due dates are nullable. New arbitrary dates are internal targets unless explicitly communicated/agreed.

Task detail drawer or /work/:taskId:
- Title and exact requested change.
- Page/target, requested value, acceptance criteria.
- Source messages.
- Scope item and authorizing policy version.
- Revision reservation.
- Notes labeled internal.
- State history and assigned owner.
- Completion form: what was done, public completion note preview, Notify client checkbox.

P0 completion checkbox defaults off. Marking done records the owner's statement; it does not verify a deployment. Client status replies can say “marked complete by the project owner,” not “independently tested.”

Changing commercial terms cannot be done by editing a task. Cancellation releases only eligible unused reservations; if work started or client commitment changed, require a reviewed client explanation.

### 5.7 Needs Attention — /app/decisions

**P0.** Filtered exception list, not another transcript.

Reason labels: scope_addition, exhausted_allowance, ambiguous_request, deadline_change, conflicting_request, unknown_participant, unsupported_input, failed_processing, delivery_unknown.

Detail panel:
- Client request and exact source.
- Scope evidence and policy reason.
- Missing fields.
- Proposed owner options.
- Private notes.
- Client reply preview.
- Resolution history.

Owner actions:
- Accept included work: requires supporting scope and explicit override reason if policy failed.
- Allow an extra revision: create a documented entitlement adjustment/waiver.
- Ask client: edit/send clarification, request returns to awaiting_details.
- Prepare proposal: open proposal draft.
- Decline: send reviewed explanation.
- Dismiss duplicate/no action: record reason; no new task.

For genuine new scope accepted at no charge, use a zero-price proposal and client approval; do not silently rewrite the agreement. Owners may resolve several records later, but bulk decisions are P1.

### 5.8 Requests — /app/projects/:id/requests

**P0.** Full history: request number, short description, source time, category, handling state, linked task/proposal, last update.

Filters: automatically accepted, clarifying, owner decision, pending approval, closed. Detail includes analysis evidence, applied rule, revision usage, and all follow-up messages.

P0 ambiguous corrections escalate. P1 permits updating an accepted request automatically before work starts under an explicit correction policy.

### 5.9 Scope & Revisions — /app/projects/:id/scope

**P0.** Tabs:
- Agreement: document/text preview and confirmed extraction.
- Current scope: inclusions, exclusions, target pages, approved additions.
- Revision allowance: total, reserved, consumed, available, ledger.
- Versions: baseline and amendments.

Actions: Confirm baseline; correct unconfirmed extraction; adjust future automation policy; documented entitlement adjustment; view proposal amendment.

After activation, correcting a transcription error requires an audited correction, not deletion of the original. Material contractual changes require explicit agreement, not an owner unilateral edit disguised as extraction correction.

P0 supports **per accepted request** counting only, explicitly shown in setup. If the actual agreement promises revision rounds, do not silently reinterpret it as per-request: select manual review for revision requests or build P1 round mode.

P1 round UI: open a numbered round for a deliverable; show grouped feedback; close/lock; owner-approved reopen; messages do not each consume a round.

### 5.10 Proposals list and editor — /app/proposals, /app/projects/:id/proposals/:proposalId

**P0.** List: number, client/project, revision, amount, business status, delivery status, sent date.

Editor:
- Request link.
- Title and client-facing explanation.
- Deliverables with acceptance criteria.
- Exclusions and dependencies.
- Fixed-price line items (integer cents).
- Proposed agreed date or no date change.
- Optional expiry.
- Designated approver.
- Preview exact terms and outgoing iMessage.

Actions: Save draft, generate wording, send, supersede, withdraw. New price or term after sending creates revision N+1; old revision is no longer approvable. Do not offer arbitrary delete for sent/approved proposals.

P0 no tax calculation, discounts engine, or payment button. Label amount as additional project price.

### 5.11 Client proposal — /proposals/:id?revision=N

**P0.** Public entry route with authentication before private data.

Show project, exact proposal revision, deliverables, exclusions, price/currency, date impact, expiry, and status. Actions: Approve, Decline, Request changes. Approval confirmation repeats key terms and requires an explicit click.

A link is navigation, not authority. Check signed-in designated approver and project membership. Expired, superseded, already-resolved, and unauthorized states have clear outcomes. A repeat approval returns prior success without duplicate work.

Client sees no owner notes, suggested margins, internal tasks, or other projects. P0 requires an approval page; natural-language “yes” in chat does not substitute for it.

### 5.12 Conversation — /app/projects/:id/conversation

**P0 read-only evidence view.** Thread shows client messages, bot replies, received/sent timestamps, source links, delivery uncertainty, and linked requests.

Highlight assistant messages. Distinguish paused, pending analysis, ignored casual message, and processed event. Do not show private owner prompts in the client thread.

P1 owner composer supports authenticated owner-originated sends with clear attribution. Native owner messages should be displayed where available but must not be interpreted as client requests. Owner chat claims of agreement do not bypass explicit proposal approval.

### 5.13 Activity — /app/projects/:id/activity

**P0 basic timeline.** Filter requests, acceptance, revision reservation, owner decision, proposal, approval, task completion, policy, integration. Each item shows actor, time, version, and linked record.

Derived history is app-level auditability, not a tamper-proof legal record. Export is P1.

### 5.14 Automation — /app/projects/:id/automation

**P0.** Controls:
- enabled / paused / review_only.
- Authorized routine operations and eligible page targets.
- Explicit exclusions.
- Required request details.
- Revision bucket and budget.
- Maximum open automatically accepted tasks (default 10).
- Prohibit new deadlines/prices.
- Owner decision destination.
- Completion-notification preference.
- Save versioned policy; inspect history.

Explain that a policy cannot expand the signed scope. Show a policy simulator: paste request and preview assessment with no sends/writes (P1; useful if time remains).

Pause stops new automatic acceptances and suppresses unsent automatic acceptance replies for uncommitted work. Existing committed task confirmations require explicit recovery treatment: show them to the owner, not silent deletion of accepted work.

### 5.15 Settings and Integrations — /app/settings

**P0 minimal.** Profile, timezone, organization, account logout. Integration card: Photon configured/unconfigured, connection check, last inbound event, test message to configured test destination, masked identifier, webhook status. Gemini configured/rate-limited/unavailable; no browser-visible keys.

P0 credentials are server environment values; UI does not need to accept or store provider keys. Health “reachable” does not mean a real message was delivered.

P1 notifications and teammate role management. No billing page needed for the hackathon.

## 6. iMessage Behavior Matrix

All bot text below is an application template populated with escaped validated values. Gemini can draft owner-reviewed prose; automatic commercial acceptance uses controlled templates to avoid extra promises.

| Input class | Action | Example reply |
|---|---|---|
| Supported included edit, complete details, allowance available | Accept transaction; task; confirmation | “Absolutely — I've added ‘change the homepage heading to green’ to the work list.” |
| Missing page/text/asset reference | Ask one targeted clarification | “Which page and heading should I update?” |
| Allowance exhausted | Escalate; no acceptance | “I've received that change. The included revision allowance is used, so I'll check the options with the project owner.” |
| Explicit exclusion/new feature | Escalate | “That needs review against the current scope. I'll check with the project owner.” |
| Classification uncertain | Escalate neutrally | “I'll ask the project owner to confirm how this should be handled.” |
| Earlier deadline | Escalate; preserve existing date | “I've noted the requested earlier date; it isn't confirmed yet.” |
| Task status question | Read authorized stored state | “The heading update is marked in progress. No completion date is confirmed.” |
| Casual thanks/emoji | No action | No reply by default |
| Chat says “yes” to proposal | Link to exact approval page | “Please confirm the proposal here so the exact terms are recorded: …” |
| Attachment-only or voice note in P0 | Ask for text; record unsupported input | “Please describe the requested change in text so I can handle it accurately.” |
| Unknown sender or changed group | Do not reveal project details; review | No project-specific automatic answer |
| Complaint, refund, dispute, urgency claim | Acknowledge once; owner decision | “I've flagged this for the project owner.” |
| Multiple independent requests | Extract separately; consolidate reply | Clearly list accepted, clarifying, and under-review parts |

Do not accept arbitrary links as instructions or fetch client URLs server-side in P0. Do not send sensitive internal information in replies. Deduplicate clarification/acknowledgment messages per request version.

### Limits and defaults

Application defaults, not vendor guarantees:
- Batch a message burst for 3 seconds; no promise of instant delivery.
- At most 2 automatic clarification turns per unresolved request, then escalate.
- At most 1 acknowledgment per request version while awaiting owner action.
- Read up to 20 recent messages and 10 unresolved requests per analysis; larger/ambiguous context escalates.
- Maximum source agreement text 30,000 characters for P0; reject larger inputs visibly.
- Limit automatic accepting to supported operation categories, never a generic “minor change.”
- Only authorized project requesters can trigger accepted work.
- Default initial allowance 0 until owner configures it.
- No invented due date, new fee, refund, discount, or claim of completed work.

Limits should be configurable constants and visible when reached. Do not truncate source text silently.

## 7. Supported Routine Operations and Policy

### P0 allowlist

1. **replace_text:** Confirmed eligible page and exact target, old text/unique locator, supplied replacement text.
2. **change_color:** Eligible page and exact existing element, supplied unambiguous color.
3. **replace_image_reference:** Eligible page/slot and owner-approved asset reference; if actual file handling is unimplemented, leave this category disabled.

P0 excludes behavior changes, authentication, checkout, payments, new pages, integrations, database changes, security settings, and unknown operation types.

Gemini proposes category, target, values, scope match, ambiguity, and evidence. Code validates allowed enums, required fields, approved scope/target/category membership, contradictions, policy state, participant authority, entitlement, and queue capacity.

**Semantic limitation:** Code cannot prove a natural-language classification correct. Narrow structured operations reduce risk but do not eliminate model mistakes. The owner delegates this residual risk, sees accepted work in the digest, and can pause automation. Do not market this as guaranteed scope correctness.

### Policy command contract

```ts
type AcceptanceCandidate = {
  requestId: string;
  requestRevision: number;
  expectedScopeVersion: number;
  expectedPolicyVersion: number;
  operation: "replace_text" | "change_color" | "replace_image_reference";
  scopeItemId: string;
  targetId: string;
  normalizedPayload: Record<string, string>;
  sourceMessageRevisionIds: string[];
};
```

Server reloads all referenced records; client/model cannot supply trusted authorization or balances.

Acceptance requires all:
- Active project, verified chat/requester, automation enabled.
- Scope baseline confirmed, no conflicting exclusion.
- Current request/scope/policy versions.
- Complete supported operation and confirmed target.
- No unresolved correction, ambiguity, dependency, or material new deadline.
- Applicable allowance and permitted capacity.
- No existing task for the same accepted request revision.

If false, return a typed reason and route to clarification or owner decision. A request for missing harmless fields goes to clarification; a policy/commercial failure goes to owner review.

## 8. Revision Accounting — Exact Semantics

### P0 per-request mode

One distinct accepted routine request consumes one revision unit. Several independent changes in one message may consume several units; disclose this before activating and do not use it for a round-based agreement.

Bucket fields: total_units, reserved_units, consumed_units, version. Available = total - reserved - consumed.

- Accept: reserve one unit and create one task.
- Start work: move reserved to consumed, once.
- Complete directly from ready: consume the reservation in the same transaction.
- Cancel before start: owner-approved release if policy permits; send an explanation if client was already promised work.
- Cancel after start: no automatic refund of the unit.
- Duplicate/correction with same work identity: no new unit without an explicit new accepted request.
- Waiver: ledger entry records zero-charge authorization or added entitlement, actor, and reason; never fabricate historical remaining allowance.

Add a database CHECK ensuring counts are non-negative and reserved + consumed <= total. Lock the bucket while accepting; two requests cannot claim the last unit.

### P1 round mode

One round belongs to a deliverable and has open/closed/in_progress/completed state. Opening reserves one unit; grouped feedback creates several linked tasks without extra units. Starting the first task consumes that round unit. Closing submissions and starting work are distinct states/fields if necessary.

The owner opens/closes rounds; the model cannot decide a contractual round boundary from silence. Feedback after close escalates or enters a newly authorized round. Completing a round requires all included tasks resolved. Changes to work already started require review.

## 9. End-to-End Processing and State Machines

### Inbound pipeline

1. Receive raw Photon event, verify delivery authenticity using the provisioned mechanism.
2. Resolve provider instance, chat, and sender. Reject unknown binding for automation.
3. Store durable inbox event and message revision, then enqueue analysis, atomically.
4. Acknowledge webhook after durable intake; return transient failure if intake failed.
5. Worker leases a per-project job and batches eligible messages.
6. Load current scope/policy, recent conversation, unresolved requests, and task states.
7. Call Gemini outside database locks.
8. Validate structure, references, source access, required details, and request identities.
9. Recheck versions/watermarks; stale analysis retries or escalates.
10. Apply policy and commit effects through domain transactions.
11. Outbox worker sends queued text through Photon.
12. Dashboard subscription causes authorized refetch.

Do not hold a row lock while waiting for a model or network send.

### Request state

received -> analyzing -> awaiting_details OR awaiting_owner OR accepted OR ignored  
awaiting_details -> analyzing  
awaiting_owner -> accepted OR proposal_pending OR declined OR dismissed  
proposal_pending -> accepted on exact approval, or returns to owner when changed/declined  
accepted -> task lifecycle; request history remains preserved.

P0 corrections/cancellations of accepted requests create owner decisions rather than silently reversing a commitment. One message may create several independent request records.

### Task state

ready -> in_progress / blocked / done / cancelled  
in_progress -> blocked / done / cancelled  
blocked -> ready / in_progress / done / cancelled  
done -> reopen only by owner with audit note; previous completion is preserved.  
Starting/reopening cannot consume allowance twice.

### Proposal business state

draft -> awaiting_client -> approved / declined / changes_requested / expired / withdrawn / superseded.

Delivery is a separate enum. Sending creates awaiting_client terms and a pending delivery; unknown send does not mean approved, declined, or delivered.

### Atomic auto-acceptance

In one transaction:
- Lock current request, project version, and revision bucket.
- Revalidate authorization/policy/version.
- Reserve applicable unit.
- Insert accepted-work authorization.
- Insert task with unique origin.
- Mark request accepted.
- Append audit event.
- Insert deduplicated confirmation outbox row.
- Commit.

Transaction success precedes any acceptance confirmation. If the send fails, task remains accepted and a delivery issue appears; it must not be recreated.

### Atomic proposal approval

Lock project and proposal revision; verify actor, current revision, expiry, expected scope version, and unresolved conflicting commitments. Commit:
- Approval record.
- Approved business state.
- New scope version and approved items.
- New tasks keyed to proposal line items.
- Approved value record.
- Notification outbox.
- Audit event.

Repeat approval returns existing result. A stale proposal requires owner review/reissue, not silent reinterpretation. All domain transactions lock common resources in a consistent order to reduce deadlocks.

## 10. Data Model

Use UUID primary keys, UTC timestamps, created_at/updated_at, organization_id and project_id where relevant. All timestamps shown in the project's timezone. Include version integers on mutable decision inputs.

| Table | Essential fields and relationships |
|---|---|
| organizations | id, name, owner_user_id |
| organization_members | organization_id, user_id, role; unique pair |
| projects | org, name, client_label, status, currency, original_amount_cents, agreed_due_at, timezone, current_scope_version, current_policy_version |
| project_members | project, user_id, role=requester/approver/owner/teammate |
| conversations | project, provider_instance_id, chat_guid, type=client_group/owner_private, verified_at, active |
| participant_bindings | conversation, provider_sender_id, user/member ref, authority, verified_at |
| documents | project, storage_path, mime, hash, processing_status, extraction_error |
| document_spans | document_id, page, start_offset, end_offset, text |
| scope_versions | project, version, confirmed_by, source_type, source_proposal_revision_id, created_at |
| scope_items | scope_version_id, stable_item_id, inclusion/exclusion, description, source_span_id, source_quote |
| scope_targets | project, stable target ID, page, element description, allowed operation context, owner_confirmed |
| policy_versions | project, version, mode, allowed operations/target IDs, maximum open tasks, notification rules |
| revision_buckets | project, mode, total, reserved, consumed, version |
| revision_ledger | bucket, request/round, delta_reserved, delta_consumed, reason, actor, idempotency_key |
| revision_rounds (P1) | bucket, deliverable, number, state, submissions_closed_at |
| inbox_events | provider instance, dedupe key, payload reference/minimized payload, received_at, processing state |
| messages | conversation, provider_message_guid, direction, sender, original timestamp |
| message_revisions | message, revision, text, received_at, source_event_id, edited/deleted flags |
| requests | project, parent message, intent index, stable identity, state, category, payload, revision, last analysis |
| request_sources | request, source message revision; normalized many-to-many relation |
| assessments | request revision, scope/policy versions, result, reason codes, evidence JSON, model/prompt version |
| work_authorizations | request, authorizing policy/proposal/owner action, actor, version |
| decisions | request/project, reason, status, resolution, owner, timestamps |
| tasks | project, authorization, title, description, target, acceptance criteria, status, assignee, internal target date, agreed date, version |
| task_notes | task, author, body, visibility=internal/public_completion |
| proposals | project, request, current_revision |
| proposal_revisions | proposal, revision, immutable terms JSON/hash, amount_cents, agreed date change, approver, state, expires_at, expected_scope_version |
| approvals | proposal revision, actor, decision, terms hash, timestamp |
| jobs | type, project, payload refs, state, attempts, available_at, lease_until, error_code |
| outbox_messages | project, conversation, purpose, dedupe_key, text, state, provider_message_guid, send_started_at, error |
| notifications | owner, project, decision/delivery ref, read_at; deduped |
| audit_events | org/project, actor/system, action, object/ref/version, safe metadata, timestamp |

### Required constraints

- Unique active (provider instance, chat GUID) project binding.
- Unique provider event dedupe key; if no provider event ID, use documented stable event identity plus revision/type.
- Unique (conversation, provider message GUID); separate edits as revisions.
- Unique task origin for accepted request; proposal tasks unique by revision + line-item key.
- Unique ledger idempotency key, outbox dedupe key, and approved revision decision.
- Monetary amounts are non-negative integer cents in P0; currency fixed per project.
- Foreign-key/project consistency enforced in scoped commands and composite constraints where practical.
- Index on project + status + updated_at for lists, conversation + timestamp, jobs state + available_at, outbox state + available_at.

Do not store duplicate independent counters for project totals: derive original + approved additions, or update a cache transactionally. Scope append operations preserve history; proposals cannot be edited after approval.

## 11. Gemini Integration

### Server-side modules

- extractScope(documentSpans) -> draftScope.
- interpretMessages(context) -> structured intents, request candidates, corrections, status questions.
- assessRequests(candidates, confirmedScope, policyContext) -> evidence and ambiguity.
- draftProposal(ownerConfirmedTerms) -> editable explanation.

For P0, interpretation and assessment may share one call with a simple schema. Separate them only if it improves measured quality; do not build an elaborate agent framework.

### Model input/output

Input includes minimized client-visible content, stable target catalog, current scope, policy definitions, pending request IDs, and stored task state. Exclude owner-private pricing notes unless explicitly drafting a reviewed proposal with appropriate context.

Output includes:
- Intent: new_request / clarification_answer / correction / cancellation / status_question / casual / dispute / unsupported.
- Existing request/task reference when applicable.
- Operation, targetId, payload fields.
- Source message revision IDs and scope evidence.
- Missing details, conflicting instructions, and ambiguity flags.
- Proposed classification, never an authority token.
- Status-question target when unambiguous.

No arbitrary URLs, SQL, function names, recipient identities, or executable code from the model are run.

Validation:
1. Parse against schema.
2. Check enum, sizes, IDs, project ownership, exact source quotes.
3. Check all required operation fields.
4. Detect contradictions/stale versions.
5. Route through deterministic policy engine.
6. Record model and prompt version for debugging.

One constrained retry for malformed output; then owner decision. Rate-limit failures retry through jobs with backoff. A repeated semantic failure escalates rather than looping.

Gemini structured outputs support a subset of JSON Schema; syntactic conformity does not establish factual correctness. Use the pinned SDK's documented schema interface. [T2]

### Grounded automatic replies

For acceptance/status/allowance notifications, render server templates after the database decision. Do not ask Gemini to independently decide wording and permission in one step. Gemini-generated clarification questions must be limited to missing fields and checked for added price/date promises; P0 can use category-specific templates instead.

## 12. Photon Integration

### Provisioning gate

Obtain actual instance/address/token, bot messaging identity, accessible test group, and supported webhook delivery verification. Confirm:
- Receiving group messages.
- Sender/chat/message identifiers.
- Sending back to that exact group.
- Outgoing echo behavior.
- Edits/deletions and event replay behavior.
- Delivery/reconciliation capabilities.
- Account quotas and hosting requirements.

Photon's SDK exposes HTTP sends and webhook intake, and documents server chat GUIDs. Do not substitute phone numbers or group display names for returned GUIDs. [T1]

### Adapter contract

```ts
interface MessagingAdapter {
  verifyAndNormalize(rawBody: Uint8Array, headers: Headers):
    Promise<NormalizedEvent>;
  sendText(input: {
    chatGuid: string;
    text: string;
    replyToMessageGuid?: string;
  }): Promise<{ providerMessageGuid: string }>;
}

type NormalizedEvent = {
  instanceId: string;
  eventKey: string;
  kind: "message" | "edit" | "delete" | "membership" | "delivery";
  chatGuid: string;
  senderId?: string;
  messageGuid?: string;
  occurredAt?: string;
  text?: string;
  fromBot: boolean;
};
```

This is Bridgify's abstraction, not a claim that Photon uses these exact event field names. Map actual payloads in one module and record a sanitized fixture. Test verification with the actual provisioned mechanism. Unverified public webhook intake is not acceptable for automatic commitments.

### Example SDK use

```ts
import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: process.env.PHOTON_HTTP_ADDRESS!,
  token: process.env.PHOTON_TOKEN!,
  // server: optional dedicated instance ID, only if provisioned
});

const sent = await im.messages.sendText(storedChatGuid, renderedText);
// Save sent.guid as the authoritative identifier of this send.
```

Verify the installed SDK version against the current docs before implementation. No generic iMessage extension or AppleScript bridge is needed for this design. [T1]

### Delivery and recovery

Outbox states: pending, sending, sent, failed_retryable, unknown, cancelled.

- A successful SDK return records sent + provider GUID; not necessarily device-read.
- Explicit rejected send may retry according to error.
- Timeout after network submission becomes unknown; do not blind resend.
- Reconcile against provider records if supported; otherwise show owner an issue with inspect/confirm-delivered/resend-after-review.
- Bot-originated events never re-enter request analysis.
- Sender memberships are checked before responding with project data.
- Unknown edit/deletion semantics block autonomous handling of affected requests until resolved.

P0 does not import the entire old chat as actionable work. Establish an activation cutoff; older history can be context only after deliberate selection. After an outage, replay is bounded and reviewed if too old or conflicting.

## 13. API Contract

Use /api/v1. All user routes require a session and project-level authorization. Mutations accept an Idempotency-Key where effects may repeat and expectedVersion for stale-write detection.

Common response: { data, requestId }; errors: { error: { code, message, fieldErrors? }, requestId }. Use 400 validation, 401 unauthenticated, 403 forbidden, 404 inaccessible/missing as appropriate, 409 stale/conflict, 422 policy failure, 429 rate limit, 503 dependency unavailable.

| Method/path | Body / effect |
|---|---|
| GET /dashboard | Role-filtered home counts and queues |
| GET/POST /projects | List; create draft basics |
| GET/PATCH /projects/:id | Read; update permitted metadata with version |
| POST /projects/:id/documents | Upload metadata or pasted text; enqueue extraction |
| GET /documents/:id/extraction | Draft extraction and source spans |
| POST /projects/:id/scope/confirm | Confirm draft scope version, validated source IDs |
| POST /projects/:id/chat-binding | Verified instance/chat/participants; no model input |
| POST /projects/:id/activate | Guard required setup and disclosure state |
| GET/PUT /projects/:id/policy | Read; create new confirmed policy version |
| POST /projects/:id/pause | Pause/review_only; reason |
| GET /projects/:id/requests | Paginated status filters |
| GET /requests/:id | Evidence, assessment, linked work |
| POST /decisions/:id/resolve | Resolution enum, expectedVersion, reply/terms inputs |
| GET/POST /projects/:id/tasks | List; owner manual task creation |
| PATCH /tasks/:id | Permitted status/assignment/notes; expectedVersion |
| POST /tasks/:id/complete | Completion note + notifyClient; transaction consumes allowance if needed |
| POST /tasks/:id/cancel | Reason + reviewed client explanation where required |
| GET /projects/:id/revisions | Bucket and ledger |
| POST /projects/:id/revisions/adjust | Owner reason, delta, explicit waiver/entitlement semantics |
| POST /projects/:id/proposals | Request ID + draft owner terms |
| PUT /proposals/:id/draft | Edit draft revision |
| POST /proposals/:id/send | Freeze revision, expectedScopeVersion, queue message |
| POST /proposals/:id/supersede | Create next revision and invalidate prior pending revision |
| GET /proposals/:id/shared | Authorized client DTO only |
| POST /proposals/:id/respond | revision + termsHash + approve/decline/changes + note |
| GET /projects/:id/messages | Paginated conversation evidence |
| GET /projects/:id/activity | Paginated filtered audit history |
| POST /integrations/photon/webhook | Verified raw-body intake, durable enqueue |
| GET /integrations/health | Authorized redacted health status |

P0 owner privately resolves decisions through authenticated buttons. Natural-language owner commands in iMessage are P1 and require identity binding plus confirmation for commercial changes.

## 14. Security, Privacy, and Access

- Supabase RLS scopes owner-visible records to membership and project role.
- Client access is limited to shared proposal/project fields, not owner tables.
- Separate private notes from client-visible DTOs; frontend hiding is insufficient.
- Database service-role access bypasses RLS: worker commands must independently enforce project/organization constraints.
- Store keys only server-side; use private document storage with expiring authorized access.
- Verify webhook origin using actual vendor mechanism; protect against replay with event deduplication.
- Document content and client text are untrusted instructions.
- Model has no unrestricted tools or database credentials.
- Validate request size; cap input/output tokens; limit per-project queue usage.
- Escape content in HTML and message previews; do not render raw model HTML.
- Keep full message bodies and contracts out of general logs.
- Record operational IDs and typed errors; restrict access to retained raw fixtures.
- Inform participants that the assistant processes their messages; connect only agreed project chats.
- P0 stores text agreement content and message text needed for the workflow; no arbitrary file ingestion.
- Before real customer onboarding, decide retention, deletion/export, backup, provider data-use terms, and incident recovery. The demo uses synthetic data and must not imply those production obligations are solved.

## 15. Background Jobs and Consistency

Use Postgres jobs rather than Redis in P0. Claim with row locking/skip-locked and a 60-second renewable lease. Record attempt and heartbeat. Suggested retry schedule 5s, 30s, 120s; max 3 automatic attempts, then decision queue. Adjust for real provider rate-limit hints.

Jobs: extract_document, analyze_conversation, deliver_message, reconcile_delivery. Project analysis uses a lease/mutex; long model calls do not lock business rows. Apply optimistic checks at commit.

Persist input watermark and scope/policy/request versions. A newer message arriving while analysis runs schedules another pass. If it materially conflicts with a candidate acceptance, discard stale result. Message source order uses provider order where reliable; otherwise preserve both provider and received time and escalate ambiguous correction order.

Realtime is a UI notification mechanism, not durable processing. Reconnect/refocus refetches authoritative records. Polling fallback every 15 seconds is sufficient for the demo if subscriptions fail.

Exactly-once local effects use constraints and transactions. Exactly-once external delivery is not guaranteed without provider support.

## 16. Key Business Workflows

### Morning review
Owner opens Home, sees tasks accepted overnight and only genuine decisions. Opens Work, starts a task (reservation consumed), completes it, optionally sends reviewed completion note.

### Routine client edit
Message -> extraction -> supported operation and target -> scope/policy check -> atomic reserve/task/outbox -> automatic reply -> task visible. No mandatory owner decision.

### Missing information
Message -> missing target -> targeted question -> client supplies answer -> rerun classification and policy against latest state -> accept or escalate. Do not reserve allowance while merely clarifying.

### Exhausted revisions
No reserve/task commitment -> client acknowledgment -> decision with allowance ledger -> owner adds entitlement/waiver or quotes/declines -> bot communicates result. Extra work does not start simply because a quote was prepared.

### New functionality
Create exception -> owner defines terms -> proposal sent -> client explicit approval -> scope/tasks/value update -> confirmation. New scope need not consume the original routine-revision bucket unless terms explicitly say so.

### Owner intervenes or pauses
Pause blocks new auto acceptance. Existing accepted work stays visible. Pending conversations remain recorded. Resume does not replay every old request blindly: show aged/unresolved items for review.

### Project close
Owner completes/archives project. Bot no longer accepts new work. New messages receive at most a configured acknowledgment or owner escalation. Historical approvals remain readable.

## 17. Failure Cases and Required User Experience

| Failure | Required behavior |
|---|---|
| Gemini unavailable | Persist intake; show pending processing; bounded retry; no acceptance fabricated |
| Photon unavailable | Queue safe send; expose failure; do not imply client was informed |
| Timeout after send | Unknown delivery; reconciliation/manual review; no blind duplication |
| Two requests, one revision left | One reserves; other escalates; counters never negative |
| Duplicate webhook | One normalized request and one set of effects |
| Invalid scope citation | No automatic acceptance; retry once or escalate |
| Accepted request later edited | Preserve history; P0 owner correction workflow |
| Requester added/removed | Pause affected automation until membership verified |
| Client asks private pricing | No private info disclosed; general scope response or escalation |
| Proposal edited after send | Old revision superseded; requires fresh client approval |
| Approval racing scope change | Transaction conflict/review, not partial updates |
| Dashboard stale write | 409; refetch and preserve draft where possible |
| Unsupported attachment | Ask for text; no pretend interpretation |
| Owner falsely marks done | Bot states recorded status; no claim of independent verification |
| Allowance policy unclear | Review-only handling until owner configures valid semantics |

## 18. Testing and Seed Data

### Seed project
A $3,000 five-page marketing site, explicit exclusion for accounts/payments, one client requester/approver, two supported target IDs, two per-request revision units, three routine operation rules with unsupported asset operation disabled.

Fixture messages:
1. Change homepage heading to green -> accept, reserve 1.
2. Replace exact heading text -> accept, reserve last unit.
3. Another eligible edit -> owner decision exhausted.
4. Ask “which page?” clarification scenario on reset fixture.
5. Add customer accounts -> owner decision.
6. Mixed eligible edit and new feature -> separate outcomes.
7. Repeat same event -> no duplicate.
8. Change accepted edit after work starts -> review.
9. Status question -> grounded response.
10. Prompt-injection text -> no authority change.

### Mandatory automated tests
- Policy allow/deny for every category, scope exclusion, missing field, paused project.
- Bucket constraints and concurrent last-unit acceptance.
- Task start/direct completion/cancel and no double-consumption.
- Inbox and outbox deduplication.
- Stale scope/policy/request analysis rejected.
- Exact revision approval atomic and idempotent.
- Client cannot read owner notes or another project.
- Unknown sender cannot authorize work.
- Delivery timeout becomes unknown.
- Model output cannot choose arbitrary recipient or execute code.

### Mandatory browser journeys
1. Owner setup and activation.
2. Real routine iMessage acceptance appears as task without owner approval.
3. Owner exception decision sends correct reply.
4. Client proposal approval produces tasks and scope once.
5. Owner completes task and optionally notifies.
6. Pause and failed processing states remain visible.

Use a 30-case labeled assessment set with held-out examples. Report classification errors and false acceptance, not just attractive summaries. Any unsupported automatic commitment found during testing blocks enabling that operation category.

## 19. Deployment and Configuration

Required environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY (or provisioned public key equivalent)
- SUPABASE_SERVICE_ROLE_KEY (server only)
- DATABASE_URL (server/worker only)
- GEMINI_API_KEY
- GEMINI_MODEL
- PHOTON_HTTP_ADDRESS
- PHOTON_TOKEN
- PHOTON_INSTANCE_ID (only if provisioned)
- Provider verification configuration named for its actual mechanism
- APP_BASE_URL
- WORKER_ENABLED / DEMO_MODE

Validate required variables at startup without printing secrets. Demo mode visibly identifies simulated messages; it cannot masquerade as a real Photon demonstration.

Deployment sequence:
1. Create database and apply ordered migrations.
2. Enable RLS and private storage rules before browser access.
3. Configure auth redirects and seed synthetic project.
4. Deploy web API and worker.
5. Register actual webhook and verify intake.
6. Test exact group routing with consenting test participants.
7. Test one model call and schema handling.
8. Run vertical-slice and role tests.
9. Enable automation after owner confirms setup.
10. Connect GitHub/VEYZL, run audit, fix actual finding, retain PR evidence.

No production customer traffic until authorization, provider access, and data-handling assumptions are reviewed.

## 20. Build Order and Cut Line

| Elapsed time | Deliverable |
|---|---|
| 0–3 h | Photon group receive/send and Gemini schema call; settle roles and revision semantics |
| 3–7 h | Migrations, auth, project setup, shared dashboard shell |
| 7–12 h | Manual domain acceptance transaction, revision ledger, actionable task UI |
| 12–17 h | Gemini extraction, policy routing, clarification, inbox worker |
| 17–22 h | Real automatic messages, exception UI, delivery states |
| 22–27 h | Proposal editor, client auth/approval, atomic amendment/tasks |
| 27–31 h | Concurrency/access tests, task completion, audit remediation |
| 31–36 h | Fixes, demo rehearsal, submissions; no new feature expansion |

Work streams can overlap with named owners, but the elapsed schedule is aggressive. AI-generated code still requires integration and invariant testing.

Cut first: Kanban, charts, global search, styling extras, private owner iMessage alerts, round mode, asset upload, reminders, multi-project analytics. Keep automatic acceptance, exception decision, exact approval, privacy, deduplication, and visible delivery failure.

If the core loop is not working by hour 22, reduce proposal/UI breadth rather than claim all pages are complete. A coherent subset is better than buttons that do nothing.

## 21. Page-to-Backend Implementation Checklist

- [ ] Login/invite -> Auth session and role guard.
- [ ] Setup -> confirmed scope, verified chat, policy, activation.
- [ ] Home -> counts from requests/tasks/decisions/outbox.
- [ ] Projects -> list and lifecycle.
- [ ] Overview -> shared state summary.
- [ ] Work -> task state commands and revision effects.
- [ ] Decisions -> private evidence and owner resolutions.
- [ ] Requests -> complete intake/history, no duplicate actionable work.
- [ ] Scope/Revisions -> baseline/version view and ledger.
- [ ] Proposals -> immutable sent terms and queued delivery.
- [ ] Client approval -> authorized exact revision response.
- [ ] Conversation -> message evidence and delivery status.
- [ ] Activity -> audit events.
- [ ] Automation -> versioned allowlist and pause.
- [ ] Settings -> redacted integration health.
- [ ] Photon adapter -> verified receive, send, echo suppression, dedupe.
- [ ] Gemini module -> structured interpretation and validation.
- [ ] Worker -> leased jobs and transactional effects.
- [ ] Security -> RLS, role tests, private DTOs.
- [ ] Operations -> visible failures, retry/reconcile, synthetic seed.
- [ ] Verification -> real vertical slice, concurrency, audit evidence.

## 22. Open External Dependencies — Do Not Guess

Before writing provider-specific code, confirm actual Photon event shapes, verification, account identity, group access, edit/delete behavior, delivery recovery, provisioning, and quotas. Confirm Gemini model/quota/schema interface and data-use terms. These cannot be made exact from an application design alone.

This specification intentionally replaces the older manual-review-first workflow for implementation purposes. The owner delegates routine acceptance through explicit rules; the dashboard is where they execute accepted tasks and decide exceptions.

## Technical References

Checked October 16, 2026. Application defaults and data schemas above are proposed Bridgify designs, not vendor promises.

- [T1] Photon SDK: https://github.com/photon-hq/advanced-imessage-ts — HTTP/webhook transport, server chat GUIDs, sending, returned identifiers. Pin and verify the installed version.
- [T2] Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output — supported schema interface and need for semantic validation.
- [T3] Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security — database visibility controls; elevated service credentials require care.

