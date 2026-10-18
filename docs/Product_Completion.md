# Current product completion and release handoff

This is the current functionality checklist. The older finish lists are historical planning material. The website is for owners; clients communicate in the selected verified Photon conversation.

## Implemented workflows

| Surface                       | Authoritative data and behavior                                                                                                                              | Verification                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Projects, quick search, Home  | Owner-scoped server queries, full-result filters/counts, stable pagination, real recent projects and setup/workspace destinations                            | Query tests; owner RLS and browser navigation tests                           |
| Tasks and project Work        | Shared records, manual creation/editing, private notes, internal target dates, direct details, cancelled history, guarded status commands                    | Database replay/stale-write/isolation tests; browser task form                |
| Requests and decisions        | Original messages, interpretation/evidence, scope/policy usage, clarification, explicit extra-revision authorization, resolved history and related proposals | Transaction tests; owner decision browser tests                               |
| Activity and project overview | Persisted audit history, linked objects, work/decision/revision summaries and approved commercial totals                                                     | Database accounting tests; project browser tests                              |
| Scope & Revisions             | Immutable request usage/refunds, owner-managed feedback rounds, complete page membership/refund annotations and amendment provenance                         | Accounting, history and amendment tests                                       |
| Conversation and recovery     | Existing real Photon history and owner replies; actual introduction receipt verification, explicit non-delivery retry, client identity checks                | Provider adapter/intake tests; recovery browser test                          |
| Lifecycle                     | Pause/review-only/resume/close, consent confirmation, fresh cutoffs, owner review of old queued work/replies, deletion cleanup                               | Lifecycle and deletion transaction tests                                      |
| Proposals                     | Drafts, exact prices/deliverables/criteria/exclusions, frozen SHA-256 terms, shared outbox submission, revisions and withdrawal                              | Proposal transaction and browser form tests                                   |
| Commercial responses          | Owner-attested client evidence, immutable response snapshots, atomic scope/tasks/value/deadline/entitlement changes; retained usage                          | Replay, rollback, conflicting amendments, edited evidence and isolation tests |
| Auth and Settings             | Existing sign-in/signup/recovery/workspace/profile/health; explicit field associations and owner-only copy                                                   | Main auth tests and public auth browser journeys                              |
| Recovery processing           | Existing bounded hosted runner also expires pending proposals, resumes interrupted interactive agreement jobs and retries private agreement cleanup          | Migration tests and existing worker suites                                    |

Each implementation PR is intentionally unmerged at the owner's request. The final branch contains the dependency stack; it is not a claim that production has changed.

Review order: [#100](https://github.com/TheMaster3558/Bridgify/pull/100) discovery → [#101](https://github.com/TheMaster3558/Bridgify/pull/101) tasks → [#102](https://github.com/TheMaster3558/Bridgify/pull/102) requests → [#103](https://github.com/TheMaster3558/Bridgify/pull/103) summaries → [#104](https://github.com/TheMaster3558/Bridgify/pull/104) connection recovery → [#105](https://github.com/TheMaster3558/Bridgify/pull/105) proposals → [#106](https://github.com/TheMaster3558/Bridgify/pull/106) approvals → [#107](https://github.com/TheMaster3558/Bridgify/pull/107) landing render repair → final product verification PR.

## Rules retained

- An accepted individual request uses one revision immediately. Cancellation retains usage; refunds require a separate owner command and reason.
- Manual tasks and proposal deliverable tasks do not spend an included request revision.
- Feedback rounds stay owner-managed. Commercial entitlement changes preserve existing usage and append policy/scope history.
- Pending proposals do not expand scope or approved value. Exact frozen revisions and actual outbound submission receipts are required before recording client evidence.
- Owners confirm that selected, unedited client messages apply to those exact terms. Gemini cannot record approval or set recipients, price or dates.
- Queued commercial messages cannot be edited through generic outbox controls. Replace their proposal revision instead.
- Uncertain delivery is never automatically resent. Provider submission does not prove device receipt.
- Private notes remain private. Prices shown as approved value are not collected payments.

## Deployment after PR review

1. Merge the stacked PRs in dependency order, retargeting each subsequent PR to `main` after its base merges. No PR is merged automatically by this implementation.
2. Back up the configured database. Test the upgrade on staging, then run `npm run automation:install` with private environment variables loaded. This installer includes the new product migrations; do not edit already-applied migration files.
3. A fresh Supabase environment uses the full ordered migration runner (`db:migrate`) with its environment loaded. It needs the standard Supabase auth/storage schemas and roles. The automation suite verifies all migrations together against an isolated database.
4. Deploy the matching web code. Configure the existing signed webhook, authenticated recovery callback, Supabase auth redirect URLs and server-only credentials as described in `Automation_Deployment.md`.
5. Verify one new owner journey, agreement review, included request, clarification, owner decision, task completion, commercial proposal/recorded approval, connection recovery and closure using consenting test participants.
6. Verify the hosted recovery callback resumes saved work. Only then stop a local SDK listener. Inspect actual provider receipts and Automation health; HTTP success alone is insufficient.

The existing minute-level recovery callback handles saved work, expired proposals, interrupted interactive agreement attempts and private deletion cleanup. It does not poll Photon history or resend uncertain submissions. A repeatedly interrupted agreement becomes a visible failed attempt with an explicit retry path.

## Local verification commands

```
npm run typecheck -- --incremental false
npm run lint
npm test
npm run test:automation
npm run test:assistant
npm run test:intake
npm run build
npm run test:e2e
```

Browser fixtures use synthetic records and intercepted API requests. Public auth/navigation tests run against the local Next server. These checks complement database transaction tests; they do not establish live customer delivery or an authenticated staging account journey.

Final local run: 199 main tests, 65 automation/database tests, 38 assistant tests, 17 intake tests and 46 browser tests passed. Type checking, lint and the production build also passed. Production migrations and hosted delivery were not executed as part of this run.

## Deliberately excluded

No subscriptions, billing, paid-plan limits, sales quote intake, team access, reminders, private owner iMessage notifications, policy simulation, asset-management workflow, automatic pre-work corrections, exports, additional board features, automatic website editing, payment collection, e-signatures, arbitrary OCR or voice transcription.

The pricing route redirects home and the former quote form no longer claims to have submitted a request. Existing unrelated workspace client-photo support remains unchanged.
