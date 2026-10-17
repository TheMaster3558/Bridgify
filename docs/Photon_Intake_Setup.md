# Photon intake and conversation history

Implemented on branch `codex/photon-message-intake`. No live provider delivery or
deployed database has been verified. Creating an online Photon project does not
by itself configure a verified inbound endpoint.

## Supported provider contract

The implemented decoder supports **Spectrum Cloud v0 signed `messages` events**.
This format and signature were checked against Photon's official adapter source:

- [Webhook verification and wire types](https://github.com/photon-hq/vercel-chat-adapter-imessage/blob/main/src/internal/webhook.ts).
- [Message content extraction](https://github.com/photon-hq/vercel-chat-adapter-imessage/blob/main/src/internal/inbound.ts).
- [Advanced iMessage SDK inbound transport notes](https://github.com/photon-hq/advanced-imessage-ts#inbound-events).

It checks `X-Spectrum-Signature` (`v0=` plus SHA-256 HMAC) against the unchanged raw
body prefixed by `v0:{X-Spectrum-Timestamp}:`, with a five-minute timestamp window
and constant-time comparison. The signing secret must be present. Signature checks
precede JSON parsing. Incoming instance identity comes from the explicit server
configuration associated with that secret, never arbitrary request metadata.

The wire body has `event: messages`, `space.id` (the chat GUID), and a `message`
with provider ID, sender ID, content, optional direction and timestamp. Text content
is supported. Membership content (`addMember`, `removeMember`, `leaveSpace`) holds
the conversation for private identity review. Non-text messages are stored with
unsupported-input state and a private review job; no attachment interpretation or
automatic response is performed.

This is **not** the [older Photon webhook bridge](https://github.com/photon-hq/webhook)
using `X-Photon-*` and `{event,data}`. It also does not assume the advanced-imessage
SDK's public event model is itself a JSON webhook wire format. These products have
different contracts. Confirm which service the account uses before enabling.

Spectrum's referenced Cloud contract documents new messages, not edit/delete
frames. Unsupported mutation frames return 422. The persistence operation already
supports authenticated normalized edit/delete events as append-only revisions,
but wiring those requires actual provider mutation documentation and sanitized
real delivery examples. Tests for that internal boundary do **not** claim live
Spectrum mutation support. Reusing a provider message identity with changed content
returns 409 rather than silently overwriting source evidence.

## Configuration and initial setup

1. Create/configure the real Supabase Postgres/Auth project. Set `DATABASE_URL`
   only on the server, plus `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` for verified history sessions. Use the database
   host's TLS connection settings. No service-role key is sent to browsers.
2. Apply `supabase/migrations/202610170001_message_intake.sql` using Supabase's
   migration tooling **or** `DATABASE_URL=... npm run db:migrate`. Use one migration
   tracking system consistently. The included runner checks applied-file hashes
   and runs each file transactionally; it does not seed real identities or chats.
3. The onboarding/admin owner must establish actual `organizations`,
   `organization_members`, `projects` and `project_members` records. Auth user IDs
   must match real Supabase users. This feature does not replace the preview login
   with full signup/onboarding. It accepts a verified Supabase cookie session or
   Bearer access token for reads, never the preview button's navigation as identity.
4. Verify the exact provider instance, group chat GUID, client sender ID, owner
   sender ID and assistant sender ID using the actual Photon account/group. Insert
   a `conversations` binding (`type=client_group`, `verified_at`, `active=true`)
   and `participant_bindings`. Requesters and owners must also have matching
   `project_members` roles. Never map by display name. Only server administrators
   can write these tables in this initial implementation; there is no fake
   verification button or public binding endpoint.
5. Set the project's `activated_at` to the deliberately chosen activation cutoff,
   and set `status=active` only after actual setup/participant disclosure. Earlier
   messages remain evidence but cannot create analysis jobs. Missing provider
   timestamps, paused projects and identity holds require review. Completed,
   archived and draft projects do not accept client work.
6. In Photon, confirm/configure Spectrum Cloud webhook delivery to the deployed
   HTTPS `/api/v1/integrations/photon/webhook`. Obtain its per-webhook signing
   secret. Set **server-only** `PHOTON_WEBHOOK_PROTOCOL=spectrum-cloud-v0`,
   `PHOTON_WEBHOOK_SIGNING_SECRET`, and `PHOTON_WEBHOOK_INSTANCE_ID`. This endpoint
   is for one explicitly configured provider identity/signing secret. Do not use a
   shared secret covering unrelated unconfigured instances. Optionally set
   `PHOTON_WEBHOOK_PHONE` to pin the signed receiving line when relevant.
7. Have a consenting client send a real new message to the linked group. Confirm
   one history entry and one queued processing job, then redeliver the same event
   and confirm no repeated effects. Also check wrong signatures, unknown senders,
   owner/bot messages and a database outage. **This step has not been performed.**

Secrets belong in the host's environment settings or an ignored local env file,
not in chat, source control, or the example file. The migration runner expects
DATABASE_URL in its process environment; Next.js loads its usual env files.

## Persistence and processing boundary

`createInboxWriter(database).persistVerifiedEvent(event)` is the production
Postgres operation. It uses one transaction to resolve/lock project and conversation,
deduplicate the provider event, snapshot sender role, store message/revision and
queue processing. A per-instance/chat advisory lock plus unique constraints also
protect concurrent delivery and semantic duplicates. The HTTP handler returns 200
only after commit. Incomplete intake, including job-insert or commit failure,
returns a retryable failure without partial local records.

`inbox_events` retains provider event/instance/chat/message/sender identifiers,
provider/received timestamps and a content fingerprint, without storing webhook
headers or credentials. Unknown chats get durable `unlinked_chat` records but no
project history or jobs. Successful HTTP receipts expose no project identifiers.

`messages` preserve the conversation/provider GUID. `message_revisions` preserve
immutable text/deletion evidence, sender and timestamp snapshots and source event
references. Stable `message_revisions.id` values are the source references for
future requests; they have a unique `(id,project_id,organization_id)` key for
scoped foreign keys. Normalized edits/deletions create private review jobs, and
invalidate queued/running analysis of the older source (`source_changed`), never
silently modifying an accepted task. Old evidence remains readable.

Bot echoes and verified owner messages are stored as `bot_echo` / `owner_context`
without client-analysis jobs. Outbound messages do not authorize client work even
if misbound to a requester. Unknown, revoked or viewer senders are stored for a
private review job and cannot receive private information through this endpoint.

The durable `jobs` rows contain scoped source references, type, state, availability,
attempt and lease fields. Only eligible active requester text creates
`analyze_conversation`; other job types are private review work. An intake job is
**not** work authorization. The existing domain acceptance operation is still an
interface. The worker/decision consumer is a separate missing integration; this
feature does not call Gemini, accept work, send replies, or implement website edits.

Every new linked event increments `conversations.input_version`. Future workers
must retain that watermark and current identity/lifecycle/policy/scope versions,
recheck them at business commit, and reject stale source analysis. Database row
locks and leases cannot replace these checks for a model call already in flight.
Membership changes set `identity_hold=true`; only deliberate owner re-verification
can clear it. Replays do not automatically reprocess previously unlinked or held
messages after configuration changes.

## History and permissions

- `GET /api/v1/projects/:projectId/messages?cursor=...`: 25-message keyset pagination,
  provider identifiers, immutable source revisions and processing states. Uses
  actual Supabase `getUser` verification, plus server-side organization/project
  checks. Unauthorized clients and other organizations receive no history.
- `/app/projects/:projectId/conversation`: read-only owner dashboard view backed by
  that same query, with loading, empty, retry and denied states. Source revisions
  have stable `#source-<uuid>` anchors. Timestamps are explicitly displayed in UTC.
- All tables enable RLS. Browser roles have no writes; only authorized owner/team
  reads are granted on project/conversation/message/source records. Private owner
  conversations are excluded from this client-group view. Inbox, bindings and job
  metadata have no browser grants. The elevated Postgres server connection still
  performs explicit membership checks for history.

## HTTP outcomes

- 200: durable intake committed; `duplicate` identifies a replay. No acceptance is implied.
- 400: invalid JSON or missing body.
- 401: missing/invalid signature or stale delivery timestamp.
- 409: a provider event identity was reused with conflicting content.
- 413: body exceeds 256 KB; enforced while streaming, not after allocation alone.
- 422: unsupported provider event/payload, inconsistent chat/line, or unsupported mutation.
- 503: required configuration missing or storage/commit failed. Unsigned fallback is never enabled.

Raw SQL/provider errors, message text and credentials are not returned in error
responses or logged by these handlers. RLS/function permissions must stay intact
when future migrations add onboarding or worker operations.

## Verification performed locally

`npm run test:intake` uses signed **synthetic** Cloud-format fixtures and a
file-backed PGlite instance running real Postgres SQL, transactions, constraints,
triggers and RLS. It tests routing, concurrent duplicate submissions, bot/owner
suppression, unknown/revoked senders, rollback on job failure, signature rejection,
activation/lifecycle, source history, unsupported events, membership holds,
permissions, pagination and persistence after database restart. It is not a
multi-backend hosted-Postgres load test and does not verify the account's actual
provider delivery contract. Production uses the `pg` driver and DATABASE_URL;
PGlite and synthetic setup records are test-only.

Run `npm run test:intake`, `npm run test:assistant`, `npm run typecheck`, and
`npm run lint`. A real Photon round trip and deployment migration remain pending
credentials, confirmed account/webhook setup and verified participant/chat bindings.
