# Assistant contracts and adapters

**Update:** The subsequent intake feature now implements Postgres inbox/history
persistence, a signed Spectrum Cloud webhook handler and authorized history reads.
See [Photon Intake Setup](./Photon_Intake_Setup.md) for current setup, exact supported
provider protocol, tests and remaining live-verification limitations. The inventory
below describes the repository before that work; acceptance/escalation and worker
consumers remain missing implementations.

## Repository inspection

At this change's starting point, the repository contained Next.js 16.4.2 / React
19.3.0 / TypeScript UI scaffolding, a sidebar, a static login preview, and the four
Bridgify specs/mockup. Owner and proposal pages returned null. The login button
linked directly to `/app`; it established no authenticated session. No repository
AGENTS.md was present. The installed Next.js guidance and relevant local docs were
read before editing. The latest automatic-acceptance specification governs behavior.

There were **no** Photon/Gemini integrations or installed SDKs; auth or Supabase
clients; database migrations; project/chat/participant bindings; persisted message,
request, task, scope, policy, revision, decision, job, or outbox records; atomic
acceptance/escalation operations; API routes; webhook verification; worker runner;
or application tests. Spec/mockup objects are illustrative, not implemented tables.
No existing backend operation was replaced, and no UI file was changed.

## Implemented pieces

- `lib/assistant/contracts.ts`: Zod application event and acceptance schemas,
  snapshot/version fields, supported operations, decision reasons, delivery result,
  and interfaces for domain commands and messaging. These are integration DTOs,
  not migrations. Only text replacement and color changes are enabled categories.
- `lib/assistant/config.ts`: lazy, server-only, validated provider configuration;
  errors omit credential values. No default Gemini model or fabricated credentials.
- `lib/photon/sender.ts`: outbound HTTP SDK adapter. Uses the exact stored chat
  GUID, stable `clientMessageId`, optional SDK `replyTo`, timeout, and no SDK retries.
  Success records a returned GUID as sent, not delivered/read. Unrecognized errors,
  connection failures, timeouts, missing GUIDs and duplicate-message uncertainty
  yield unknown; only recognized explicit rejections yield failed. Caller persists
  results and controls reviewed retries. No automatic website modification.
- `lib/ai/interpret-messages.ts`: Gemini structured interpretation with strict Zod
  output, supported intent/operation enums, exact source/scope quote checks, bounded
  context and output, ID checks, missing-field checks, and one validation retry.
  SDK transport failures propagate for durable retry. Repeated invalid responses
  require owner review. No model tools, recipients, acceptance authority or sends.
  Results retain scope/policy versions, input watermark, model and prompt version.
- `lib/assistant/intake.ts`: raw-byte verification-to-durable-inbox seam. Missing
  decoder fails closed. Verification and event validation precede any write; durable
  commit is awaited. There is deliberately no public webhook route or default decoder.
- Synthetic unit tests under `tests/assistant`; production imports no test fixtures.

Pinned SDKs: `@photon-ai/advanced-imessage` **2.3.0**, `@google/genai` **2.30.0**.
The lockfile also pins Zod, server-only and the TypeScript test runner.

## Exact integration boundaries and ownership obligations

### Photon provisioning / webhook owner: `PhotonWebhookDecoder`

Implement `verifyAndNormalize(rawBody, headers) -> NormalizedEvent` against the
actual provisioned transport, verification mechanism, and sanitized real payloads.
The official Photon SDK describes HTTP as outbound-only, with Spectrum handling
webhook delivery. Its README example is not a complete verified ingress contract.
It does not establish the provisioned signature headers, replay rules, instance
identity, or edit/delete/membership payloads. No such mechanism was guessed here.

NormalizedEvent is Bridgify's internal shape (instanceId, eventKey, kind, chatGuid,
senderId/messageGuid as applicable, optional time/text, fromBot). A decoder must
not trust caller-supplied `fromBot` or authority. Unsupported wire events must be
rejected or held for review, never silently normalized into client requests.

A future route must enforce a body limit **while reading**, before allocating the
whole request; pass unchanged raw bytes/headers; return success only after intake
commit; map failures to redacted HTTP errors. The helper also checks a 256 KB limit.

### Persistence/auth owner: `InboxWriter`

Implement `persistVerifiedEvent(event) -> { inboxEventId, duplicate }` atomically:
dedupe by instance/event identity; resolve exact active provider-instance/chat GUID
binding; preserve message GUID/revision; store inbox/message and enqueue processing.
Enforce tenant/project consistency, sender identity, bot/owner echo suppression,
activation cutoff and lifecycle. Changed membership must hold automation for review.
The helper cannot guarantee these invariants without this missing database operation.

### Domain owner: `AssistantDomain`

All commands receive organization/project/conversation/request identity, request
revision, expected scope/policy versions, input watermark and idempotency key.

- `acceptRoutine(candidate)` returns accepted task/outbox IDs with replay status,
  or a typed rejection/stale snapshot. Reload trusted authority and policy; check
  exclusions, targets, requester, capacity, lifecycle and current versions; lock
  allowance and atomically reserve + authorize + create task + record acceptance,
  audit and templated confirmation outbox. A parsed candidate is **not** permission.
- `escalate(snapshot, reason, sources)` returns a deduplicated decision ID. Persist
  the private owner decision/notification plus any permitted neutral group
  acknowledgment atomically. Resolve the owner destination server-side; never
  send internal reasons/notes to the client group. P0 owner escalation is dashboard.
- `clarify(snapshot, missingFields, sources)` returns a queued outbox ID or requires
  owner review. Recheck versions/identity, enforce two-turn limit and correct request
  matching, set awaiting_details and queue a controlled question without reserving
  allowance. Ambiguous follow-ups escalate; the model cannot choose authority.

No database implementation, in-memory substitute or mock acceptance is provided.
Task start/completion/cancel accounting, proposal approvals and task execution remain
with the domain team. Requests to expand scope must use that team's proposal flow.

### Worker owner: interpreter, domain commands and sender

The worker must load a **confirmed, authorized, client-visible** context projection
for `interpret()`: messages with roles and revision IDs; current scope and targets;
up to ten unresolved requests; stored task summaries; project/version/watermark.
Do not include private notes or pending proposal terms as approved scope. Strict
schema rejection helps catch accidental extra fields; it cannot detect private
information a caller incorrectly puts into an allowed text field.

Persist validated analysis and split/match requests before constructing domain
commands. Never treat a complete model intent as auto-acceptance. Exclusions,
ambiguity, requested dates, corrections and policy failures require deterministic
routing; clarification answers require unambiguous matching. The adapters do not
implement this routing. The database command must recheck all current versions.

The missing durable Node worker must provide job leases, bounded retries, per-project
serialization, watermarks, stale-analysis rejection and crash recovery. No network
call should hold business locks. A delivery job leases the outbox row, loads the
authorized persisted recipient and text, records sending before submission, calls
`sendText`, then saves the result. A crash during submission is unknown until
reconciled/reviewed. Do not automatically resend unknown messages. Stable provider
keys supplement, but do not replace, database uniqueness and delivery recovery.

## Verification and remaining dependencies

Run `npm run test:assistant`, `npm run typecheck`, and `npm run lint`. Tests exercise
schema/evidence isolation, rejected model authority, bounded retries, uncertain
sends, missing/failed webhook verification, and durable-commit propagation using
synthetic stubs only. They are not live provider tests, transaction/concurrency
tests, role/RLS tests, or proof of webhook verification.

Provider/intake modules import `server-only` to prevent Next.js client imports.
Standalone Node workers importing these modules must run with the
`--conditions=react-server` Node flag, as the test script does; normal Node's
default `server-only` entry point intentionally throws. Do not remove the guard
to make browser imports work.

Before enabling an assistant: implement migrations and domain/inbox operations;
real Supabase owner/client auth and identity bindings; the actual Photon decoder;
worker and outbox persistence; policy/routing and controlled reply templates;
provider provisioning/configuration; and end-to-end/transaction/permission tests.
Neither a live Gemini call nor a real Photon send was performed in this change.

Official references checked alongside installed SDK types:
- [Photon SDK README](https://github.com/photon-hq/advanced-imessage-ts): HTTP sends,
  GUIDs, dedicated routing, inbound webhook responsibility and idempotency options.
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
  and [Google GenAI SDK](https://github.com/googleapis/js-genai): structured schemas;
  installed 2.30.0 types verify `models.generateContent`, `responseMimeType`,
  `responseJsonSchema`, timeout and retry options used here.

Structured output and exact citations do not prove semantic scope correctness.
Standing owner authority is determined only by the domain operation and measured
against realistic held-out conversations before enabling automatic commitments.
