# Bridgify — Feature Completion Checklist
**Date:** October 17, 2026  
**Purpose:** A feature-based build and verification checklist for the functioning application.  
**Scope:** Automatic client communication in iMessage, an owner dashboard, revision-aware task creation, exception decisions, proposals, and approvals.

This is a new completion plan, not an audit of the current repository. All items start unchecked. Mark a feature complete only when its UI, server behavior, persistence, permissions, and relevant verification work together. Existing screens or generated code alone do not establish completion.

Each checkbox represents a meaningful feature or workflow. Implementation details appear inside its completion criteria rather than as hundreds of separate microtasks.

## What “Complete” Means

Bridgify handles authorized routine requests itself, replies to the client, and creates actionable work. The freelancer completes the website changes. Exceptions go to the owner privately; additional scope follows an explicit proposal and approval workflow.

There are two completion milestones:
- **Working core release:** All features in sections 1–10 and the core release checks in section 12 work end to end. This is the initial product release target, not a promise that every item fits the remaining hackathon time.
- **Full planned workflow:** Complete section 11 as well, including round-based revisions, richer team support, and private owner messaging.

Automatic website edits, payment collection, accounting integrations, formal e-signatures, voice transcription, arbitrary OCR, and autonomous negotiation remain outside this app definition. A disabled placeholder does not count as an implemented feature.

For any checkbox, a deliberate limitation must be visible to users and recorded in release notes. Do not claim completion of unsupported functionality.

## 1. Accounts, Access, and Project Onboarding

- [ ] **Account creation, sign-in, recovery, and organization setup**

  Build a real owner account flow, organization creation, authenticated sessions, sign-out, and the recovery path needed for the chosen authentication method. Private dashboard routes require an authorized organization role. Provide a usable first-run state instead of assuming a pre-existing seeded owner.

  **Complete when:** A new owner can create/access their workspace, leave and sign back in, recover access, and cannot view another organization's data. Any seeded-only demo shortcut is identified as such rather than called general onboarding.

- [ ] **Client invitation and authorized proposal access**

  Let the owner invite the designated client requester/approver and establish the application identity used for approval. Preserve the exact proposal destination through sign-in. Handle expired invitations and attempts by the wrong account without exposing private terms.

  **Complete when:** A real invited client reaches the correct proposal after authentication; a forwarded link does not give an unauthorized person approval authority. Email identity and iMessage sender identity are explicitly mapped, not inferred from matching names.

- [ ] **Project creation and resumable setup**

  Finish the setup workflow for project basics, agreement, client participants/chat, automation rules, and activation. Persist progress across refresh and sign-out. Store price as integer cents, project timezone, and nullable agreed dates. Validate required inputs on the server.

  **Complete when:** An owner can create a project from an empty workspace, resume a partially completed setup, and activate only after the required scope, identity, messaging, allowance, and disclosure checks pass.

- [ ] **Agreement import, source evidence, and baseline confirmation**

  Support pasted agreement text and supported text PDFs. Extract included work, exclusions, revision terms, dates, and responsibilities with source references. Let the owner correct and confirm the extraction. Show processing, unsupported scans, oversized files, and extraction failures.

  **Complete when:** The owner can inspect the evidence for each confirmed term, and no unconfirmed or silently truncated agreement authorizes automatic work. Material later changes follow the amendment workflow rather than erasing history.

- [ ] **Project lifecycle and verified client-chat connection**

  Connect the exact Photon group and provider instance, verify requester/owner/bot identities, test sending, and disclose the assistant's participation. Define the activation cutoff. Support active, paused/review-only, completed, and archived behavior without losing history.

  **Complete when:** Only the linked verified project group can trigger work; earlier messages are not replayed as new tasks; completed/archived projects stop accepting work; changed membership is held for verification.

## 2. The iMessage Assistant

- [ ] **Reliable real-message intake and conversation history**

  Receive actual Photon events through verified intake, persist before acknowledgment, normalize message identity/revisions, and suppress duplicates and bot echoes. Preserve source messages for requests. Unknown participants and unsupported event forms cannot authorize work.

  **Complete when:** A real client message appears in the correct project's history, repeated delivery produces no repeated effects, and assistant/owner messages do not become new client requests.

- [ ] **Request understanding and scope matching with Gemini**

  Identify actionable edits, questions, corrections, cancellations, disputes, casual messages, and mixed requests. Match them to confirmed targets, current approved scope, and existing request/task records. Validate structured outputs, evidence, and references before decisions.

  **Complete when:** One message can produce distinct requests where necessary; the model cannot invent authority, alter recipients, or treat pending proposals as approved scope. Invalid or uncertain interpretation routes to clarification or owner review.

- [ ] **Automatic acceptance, revision reservation, and task creation**

  Implement the central workflow as one atomic operation: recheck identity and current project/policy/scope, confirm operation eligibility, reserve allowance, record authorization, create one actionable task, record acceptance/audit, and queue confirmation.

  **Complete when:** An eligible client change produces one task and one logical confirmation without owner approval. Failure rolls back all local acceptance effects. Two simultaneous requests cannot both take the last available revision. No “accepted” reply is sent before commitment succeeds.

- [ ] **Automatic clarification with correct request matching**

  Ask the client for missing target, page, wording, or other supported details. Attach answers to the correct unresolved request, reassess the latest scope/policy, and accept only when complete and eligible. Set a bounded clarification limit.

  **Complete when:** Follow-up details resolve the right request without duplicate tasks or premature revision usage. If multiple open requests could match an answer, the bot asks which one or escalates rather than guessing.

- [ ] **Factual project-status answers and appropriate silence**

  Answer from recorded task state and agreed dates. Handle no date, ambiguous task names, and unknown status accurately. Ignore casual messages where no reply is needed. Unsupported attachments/voice notes receive a text-request response.

  **Complete when:** The bot does not invent progress, deployment, delivery, deadlines, or completed work. It distinguishes “accepted for the owner to do” from “done.”

- [ ] **Exception acknowledgment and private owner escalation**

  Route exhausted allowance, additions, new deadlines, conflicting instructions, disputes, unknown identities, and failed processing to the correct owner decision. Send a bounded neutral client acknowledgment where appropriate.

  **Complete when:** Routine accepted work bypasses mandatory owner review, while exceptions appear in Needs Attention with source evidence and options. No unapproved price/date or internal recommendation leaks to the group.

- [ ] **Safe replies, conversation continuity, and response limits**

  Use controlled automatic templates populated with validated facts. Consolidate outcomes of mixed requests. Avoid repeated acknowledgments, endless clarification, and replies to every casual message. Preserve enough recent context and unresolved-request history.

  **Complete when:** Replies accurately distinguish accepted, clarifying, and owner-review portions. Context limits and model failures cannot silently turn uncertainty into permission.

## 3. Rules, Revisions, and Automation Controls

- [ ] **Owner-defined automation permissions**

  Build controls for supported operation categories, confirmed page/element targets, exclusions, required details, queue capacity, and permitted reply behavior. Keep new prices and schedule commitments owner-controlled. Saving creates an inspectable policy version.

  **Complete when:** Routine acceptance is possible only within configured standing authority and approved scope. A generic “minor change” classification is insufficient. The owner can inspect which policy authorized any task.

- [ ] **Revision allowance and complete usage ledger**

  Show total, reserved, consumed, and available allowance. Reserve at acceptance, consume when work starts/directly completes, and apply documented cancellation/release rules. Support owner adjustments and waivers with reasons and history.

  **Complete when:** Counters remain consistent under retries/concurrency; completing/reopening a task cannot charge twice; several unrelated changes are handled according to the displayed counting policy. Per-request mode must not masquerade as contractual round mode.

- [ ] **Pause, review-only, resume, and owner intervention**

  Let the owner stop automatic acceptance while retaining intake and existing committed tasks. Make review-only behavior clear. On resume, distinguish fresh eligible work from old, corrected, or already-handled requests.

  **Complete when:** No stale batch is blindly accepted or acknowledged on resume. The owner can correct mistaken handling with an audit trail and appropriate client communication rather than silently reversing promises.

## 4. Business-Owner Dashboard

- [ ] **Shared dashboard shell and daily Home**

  Finish navigation, project context, account menu, and connection indicators. Home shows Actionable Tasks, Needs Your Decision, Awaiting Client Approval, and integration issues, plus a digest of automatic handling.

  **Complete when:** Counts derive from real statuses, cards open the right records, and the owner can understand what to do next without reading the whole chat. Routine successes do not flood the decision queue.

- [ ] **Project list and project overview**

  Provide owner-scoped project search/filtering, lifecycle actions, and a project summary of work, decisions, agreed dates, current scope, allowance, proposals, and automation. Show original value, approved additions, and approved total separately.

  **Complete when:** Global and project views show consistent records; pending proposals do not inflate approved totals; approved value is never labeled as collected cash.

- [ ] **Actionable Tasks and task detail**

  Wire the global list and project Work view to the same tasks. Support creation, assignment, priority, blocking, progress, completion, cancellation, notes, source evidence, and state history. Distinguish internal target dates from client-agreed dates.

  **Complete when:** Every accepted request has actionable work with its source and authorization. Proposal drafts remain outside committed work. All visible task actions persist and apply revision rules correctly.

- [ ] **Needs Attention and owner decision resolution**

  Build reason-filtered decisions with client message, scope evidence, allowance state, missing details, recommended choices, internal notes, and client reply preview. Support included-work overrides, extra revision, clarification, proposal, decline, and dismissal.

  **Complete when:** A decision is resolved once, appropriate downstream work/messages are created, and stale actions are rejected. Genuine free new scope uses a documented zero-price approval rather than a hidden scope edit.

- [ ] **Request history and conversation evidence**

  Show every request's state, linked task/proposal/decision, source messages, follow-ups, interpretation, and applied rule. Provide a read-only client-group thread with bot identity, processing state, and delivery uncertainty.

  **Complete when:** The owner can trace a task back to a message and understand why it was accepted/escalated. Private owner communication never appears in the client-group view.

- [ ] **Scope, revisions, and project history**

  Finish agreement preview, confirmed inclusions/exclusions, target catalog, amendments, revision ledger, and version history. Activity records owner/system actions with linked objects and versions.

  **Complete when:** Current commitments can be reconstructed without searching chat. Material amendments, corrections, waivers, and task changes preserve their origins and actors.

- [ ] **Automation settings, profile, and integration controls**

  Finish policy editing, pause/resume, owner notification settings supported by the release, profile/timezone/organization updates, sign-out, redacted provider health, and an authorized test-message action.

  **Complete when:** Settings actually persist; test sends target only the configured destination; health distinguishes reachable, sent, unknown, and unavailable. Provider keys remain server-side.

- [ ] **Consistent usable states across the dashboard**

  Implement loading, empty, retryable error, access denied, and stale-data behavior across real data surfaces. Preserve recoverable drafts, support keyboard navigation and visible focus, paginate longer lists, and prevent repeated mutations.

  **Complete when:** Refresh/refocus/reconnection restores authoritative data, errors are actionable, and no important button is merely decorative. A Kanban board is optional; a working list is sufficient for the core release.

## 5. Proposals and Explicit Client Approval

- [ ] **Proposal creation and editable drafts**

  Convert an owner-reviewed request into deliverables, acceptance criteria, exclusions, dependencies, additional price, date impact, expiry, and designated approver. Gemini can draft wording from confirmed terms; the owner sets commercial details.

  **Complete when:** Drafts can be saved/reopened/edited; totals are correct; private pricing notes are excluded from client text; the owner can preview exact proposal terms and outgoing message.

- [ ] **Proposal sending, versions, withdrawal, and follow-up**

  Send the frozen revision through Photon, show business state independently of delivery, and support superseding or withdrawing a pending proposal. An owner-reviewed follow-up reuses the current valid terms.

  **Complete when:** Changing sent terms produces a new revision; old revisions cannot be approved; no sent/approved history is deleted. The relevant API handlers exist for every visible action, including withdrawal.

- [ ] **Client approval page and all response outcomes**

  Authenticate the designated approver before revealing terms. Show the exact revision, price, scope/date impact, and expiry. Support explicit confirmation, decline, and request changes; handle expired, superseded, withdrawn, already-resolved, and unauthorized access.

  **Complete when:** A chat “yes” is directed to the approval page; an explicit decision records the actor and terms; duplicate submissions return the prior result rather than duplicate effects.

- [ ] **Atomic approval-to-work synchronization**

  In one transaction record approval, update scope, create line-item tasks, update approved additional value, record history, and queue confirmation. Recheck current revision, authority, expiry, and relevant scope conflicts.

  **Complete when:** An approval race or failure cannot leave partial project updates. Tasks are created exactly once and later requests use the expanded approved scope, not pending drafts.

## 6. Completing Work and Communicating Outcomes

- [ ] **Task completion and optional client updates**

  Let the owner record what was done, preview a public completion note, and choose whether to notify. Completion and any required allowance consumption are consistent; notification is queued after commit.

  **Complete when:** The client receives only authorized factual completion information, no private notes or invented testing claims. Repeated completion cannot resend or consume allowance twice unintentionally.

- [ ] **Corrections, cancellations, and project closeout**

  Preserve accepted commitments when the client changes their mind. Route accepted-work edits/cancellations to owner review in the core release. Communicate agreed changes, apply allowance rules, and stop automatic new work when a project closes.

  **Complete when:** “Make it blue instead” after work starts cannot silently overwrite history or bill another unit. Closed projects retain readable evidence without continuing to accept tasks.

## 7. Durable Processing and Recovery

- [ ] **Persistent background processing and shared data contracts**

  Run agreement extraction, conversation analysis, and outgoing delivery outside short web requests. Use durable jobs, leases, bounded retries, per-project coordination, version checks, and scoped domain commands. Define consistent API validation, authorization, error responses, idempotency, and stale-write handling.

  **Complete when:** Web and worker restarts preserve queued work; slow network/model calls do not hold business locks; a stale analysis cannot commit against changed rules or scope.

- [ ] **Outgoing delivery and unknown-send recovery**

  Persist outbound intent with the business action. Track pending, sending, successful, retryable failure, and uncertain delivery. Reconcile where Photon supports it; otherwise require owner review before resending an uncertain message.

  **Complete when:** A timeout after provider acceptance does not cause a blind duplicate. The dashboard shows whether client communication is pending or uncertain without undoing accepted tasks.

- [ ] **Crash, replay, and outage recovery**

  Cover failures immediately before/after acceptance commit and immediately before/after external sending. Handle duplicate events, out-of-order corrections, deleted/edited messages, prolonged outages, and provider/model rate limits.

  **Complete when:** Reprocessing yields the same local commitment and revision balance. Unknown external delivery remains explicit; exactly-once external delivery is not claimed without provider guarantees.

## 8. Privacy, Permissions, and Data Integrity

- [ ] **Organization/project isolation and private client views**

  Enforce authentication and role authorization on all routes, reads, mutations, storage, and worker commands. Separate private owner records from explicitly shared client data. Use database access policies and constraints.

  **Complete when:** A client or another organization cannot read private notes, tasks, agreement files, or unrelated proposals by changing a URL/API ID. Elevated worker credentials do not bypass application scoping.

- [ ] **Safe model/provider integration and bounded input**

  Verify webhook origin using the actual provisioned method, deduplicate replays, validate model outputs/references, protect server keys, cap input/processing, escape displayed content, and treat messages/documents as untrusted.

  **Complete when:** Injection text cannot alter rules, recipients, allowance, prices, or authorization. Invalid citations/unsupported operations never trigger automatic commitments. Sensitive content stays out of ordinary logs.

- [ ] **Data handling and operational visibility**

  Document what messages/agreements are retained and who can access them. Use private storage, safe operational logs, request IDs, connection/backlog/error visibility, and participant disclosure.

  **Complete when:** The team can diagnose a failed request without exposing secrets or client text publicly. Synthetic demo data is distinguishable from real customer data; production retention/recovery limitations are recorded.

## 9. Feature-to-Backend Coverage

- [ ] **Complete service/API coverage for the entire owner workflow**

  Make a route/action coverage pass across every page. Include global tasks/decisions/proposals queries, account/organization bootstrap, invitations, notes, profile updates, test sends, proposal withdrawal, policy resume, task operations, and scope adjustments.

  **Complete when:** Every enabled UI action maps to a real authorized server operation and every displayed count/list reads real state. Reuse shared components and queries rather than maintaining conflicting global/project copies.

- [ ] **Database migrations, constraints, and reproducible fixtures**

  Implement the authoritative records for identities, projects, scope/policy versions, messages, requests, authorizations, revisions, tasks, proposals/approvals, jobs, delivery, notifications, and audit history. Provide ordered migrations and synthetic fixtures.

  **Complete when:** A fresh environment can be initialized reproducibly; relational/project constraints and unique effect keys protect against duplicate or inconsistent state. Stored counters and derived values reconcile.

## 10. Verification and Deployment

- [ ] **Automated business-rule, transaction, and permission verification**

  Test supported/unsupported policy decisions, last-revision races, rollback, retries, stale versions, exact proposal approval, task allowance transitions, unknown send recovery, cross-project access, and injection attempts.

  **Complete when:** Tests assert observable invariants, not merely implementation structure. In particular, acceptance and approval each have a failing-path rollback test and a duplicate/concurrency test.

- [ ] **Gemini evaluation against realistic conversations**

  Maintain a labeled set with routine edits, mixed requests, missing details, multiple clarification threads, corrections, additions, disputes, and adversarial input. Separate prompt-tuning examples from held-out evaluation.

  **Complete when:** The team reports false acceptances and escalation quality, fixes unsafe categories, and disables unsupported automation. Fluent output alone is not considered a pass.

- [ ] **Deploy the complete application and run real integration journeys**

  Deploy the web app, database/storage/auth, and persistent worker. Configure secrets, redirects, verified live webhook, and provider accounts. Run journeys through the actual deployed application using consenting test participants.

  **Complete when:** A real Photon message and Gemini call complete the core workflow; a process restart and a failed dependency have recoverable outcomes. Local tests alone do not satisfy this item.

- [ ] **Audit, remediation evidence, and release documentation**

  Run relevant CI checks and the real VEYZL repo audit for the sponsor submission. Address actual findings, verify the fix, and retain PR evidence. Document setup, launch commands, limits, supported operations, and recovery procedures.

  **Complete when:** Reviewers can distinguish implemented behavior, demonstrated integrations, and remaining limitations. An audit is not represented as comprehensive safety or legal certification.

## 11. Full Planned Workflow — After the Working Core

These features are necessary to claim the broader version described below, but are not blockers for a clearly labeled narrower core release.

- [ ] **Contractual revision-round mode**

  Group feedback by deliverable and owner-opened round. Reserve/consume one unit for the round rather than one for every message or task. Handle round closure, late feedback, reopen, and completion consistently.

  **Complete when:** Multiple feedback messages in one authorized round do not consume multiple rounds; the owner controls boundaries. Until then, round-based agreements stay in manual review.

- [ ] **Private owner iMessage escalation and controlled commands**

  Verify a separate owner-only destination and send deduplicated exception prompts with links. If owner commands are supported, bind identity and require explicit confirmation for sensitive actions.

  **Complete when:** Private prompts never reach the client group and owner chat cannot bypass client proposal approval. This is additional to dashboard notifications.

- [ ] **Team roles and richer multi-project operation**

  Invite teammates, assign work, manage permitted visibility, and support meaningful project switching and owner-wide queues. Non-commercial teammates cannot set prices or approve scope by default.

  **Complete when:** Organization/project permissions and lists remain correct with several actual users/projects, not just a static portfolio preview.

- [ ] **Safe automatic pre-work corrections**

  Allow explicitly authorized corrections to a known accepted task before work starts. Preserve request history, reassess policy, and prevent duplicate tasks/allowance consumption.

  **Complete when:** A precise correction updates the right eligible task; conflicts, new work, and edits after start escalate.

- [ ] **Client assets and image-replacement workflow**

  Add authenticated/private asset intake, supported types/limits, owner-approved references, task links, and safe rendering/access. Enable image replacement only when an actual asset can be identified.

  **Complete when:** The bot cannot promise an image change using a missing, inaccessible, or ambiguous asset.

- [ ] **Convenience features: simulator, reminders, export, and board**

  Add a no-effects policy preview, owner-controlled follow-ups, authorized history export, and Kanban if useful. Reuse existing records and state transitions.

  **Complete when:** Simulation never sends or commits work, reminders respect resolution and superseded proposals, exports exclude unauthorized content, and board actions behave like list actions.

## 12. Final Release Acceptance — Demonstrate, Don't Assume

Record the deployed test outcome and any limitation for each journey. A prepared backup recording is useful for the pitch but does not replace a working integration.

- [ ] **Onboarding:** New owner creates a workspace/project, confirms the agreement, verifies participants/chat, configures rules, and activates.
- [ ] **Routine request:** Client sends an eligible edit; bot accepts; exactly one task appears; allowance changes once; owner was not required to reply.
- [ ] **Clarification:** Bot asks for missing details, attaches the answer to the right request, and handles it without creating duplicates.
- [ ] **Exception:** Exhausted revisions or new scope prompts the owner; the owner's decision produces the right client response and work state.
- [ ] **Proposal:** Owner sends terms; authorized client approves the exact revision; scope/tasks/value update once; old links cannot approve superseded terms.
- [ ] **Execution:** Owner starts/completes work, updates the dashboard, and optionally sends a factual completion message.
- [ ] **Pause and lifecycle:** Pause prevents new acceptance, resume handles retained work deliberately, and project closure stops new commitments.
- [ ] **Failures and access:** Restart, retry, unknown delivery, duplicate events, concurrent requests, and unauthorized access preserve the required invariants.

## How to Use This List

Assign an accountable teammate and verification evidence to each feature. Build vertical workflows in this order: onboarding -> routine acceptance -> clarification/escalation -> proposals -> task completion -> failure recovery and final verification.

Start with a manually constructed acceptance command before adding Gemini, so the transaction and task pipeline can be debugged independently. Connect real Photon early so provider access is not left until the end.

Do not rebuild finished work just because its box is unchecked here. Inspect and verify it, then mark it complete. Do not mark a feature complete because a page exists, an API returns 200, or an AI coding tool says it implemented it.

