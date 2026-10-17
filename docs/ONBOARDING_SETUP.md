# Accounts and project onboarding

This feature replaces the seeded login mockup with Supabase email-link authentication and saved project setup. It uses Next.js/React/TypeScript, Supabase Auth/Postgres/private Storage, Zod, Gemini (`@google/genai`), `pdfjs-dist`, the Photon HTTP SDK, a persistent TypeScript document worker, Vitest and Playwright. There is no seeded owner and no authentication bypass.

## Start with an empty Supabase project

1. Create a Supabase project. In its SQL editor, run the complete file `supabase/migrations/202610170001_onboarding.sql` once, as the database administrator. Alternatively, use `supabase db push` after linking the project. It creates the tables, transaction functions, owner RLS policies and private `agreements` bucket. Do not disable RLS. No seed SQL is required.
2. Copy `.env.example` to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_URL`, the project's public anon/publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `APP_BASE_URL` (for development, `http://localhost:3000`). `SUPABASE_SERVICE_ROLE_KEY` is used only for private file uploads, provider recording and the worker. Keep it out of all `NEXT_PUBLIC_*` variables. The web app needs it for PDF import and Photon tests; text intake and ordinary owner commands use the signed-in user's RLS-scoped connection.
3. In Supabase Authentication, enable email signups, configure SMTP for actual users, set the Site URL to `APP_BASE_URL`, and allow the exact callback URL `APP_BASE_URL/auth/confirm` (plus its query parameters). Use separate explicit allowlisted URLs for development and production. Do not allow arbitrary domains.
4. Configure the **Magic Link** and **Confirm Signup** email templates to link to:

   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email"
     >Sign in to Bridgify</a
   >
   ```

   The app always passes a RedirectTo containing `/auth/confirm?next=...`, so the ampersand above is intentional. This uses `verifyOtp` on the server and preserves invitation/proposal destinations even when email is opened in a different browser. The standard PKCE `code` callback is also supported. Do not remove or decode the `next` parameter in your email infrastructure. Test both first signup and returning-user emails with the actual Supabase project.

5. Use Node 24 LTS, run `npm ci`, then `npm run dev`. Configure the public Supabase variables before running a production build, since Next.js embeds public variables at build time. Open `/login`, request a link for your own mailbox, follow it, and create a workspace. Repeated workspace creation is idempotent. The P0 membership model supports one owner workspace per account; clients can participate in projects without an owner workspace.
6. For agreement extraction, configure `GEMINI_API_KEY` and `GEMINI_MODEL` using a model actually available to your account. Start `npm run worker` on a persistent Node host with `.env.local`, or `WORKER_ENABLED=true tsx workers/index.ts` with your deployment's injected environment. The worker validates Gemini configuration before processing. No model ID is assumed.

The web server and worker may run separately. A hosted database is not provisioned by this code. `DATABASE_URL` is unnecessary for this feature: web commands and durable jobs use Supabase RPC rather than a second database connection.

## Account and recovery behavior

Email magic links are the chosen authentication method. The same login form creates accounts, signs in returning users and recovers access without a password. Supabase enforces email delivery rate limits. Invalid or expired links have a neutral error and retain the intended destination. Losing access to the mailbox requires recovery with the mailbox provider; no insecure owner-reassignment shortcut exists.

Every owner layout and API read is server-authorized. RLS isolates organizations, documents, spans, baselines, policies, connection state and history. Browser roles cannot directly mutate tables or execute worker functions. The application uses `auth.getUser()` rather than trusting a client-supplied session. Sign-out invalidates the session through Supabase and clears its cookies. Private responses must not be cached by a shared CDN.

## Saved project setup

- Save basics: integer USD cents, an IANA project timezone and an optional agreed calendar date (not an inferred UTC deadline).
- Paste the complete agreement or upload a private text PDF. Limits: 5 MB, 50 pages, 30,000 extracted characters, 100 extracted terms. No truncation is accepted. A scanned/empty page, oversized input, model failure or incomplete/invalid citations leaves the baseline unconfirmed. The UI polls queued/processing documents; failures can be retried by importing again. All imports and confirmed baseline versions remain in history.
- Inspect full source pages and each exact quotation. Edit term wording/category, remove erroneous draft terms and add missing terms from exact source quotes. Review the whole document before confirming. The database checks that every citation belongs to the ready document for this project. Importing a replacement invalidates the current draft baseline and policy. Confirming a new baseline invalidates any prior automation policy, requiring renewed owner review.
- Invite the designated client using the link generated in People & chat. **The owner must share that link**; this release does not send an invitation email on the owner's behalf. The client authenticates using the exact invited, verified email and explicitly accepts. Links expire after seven days; replacements revoke earlier invitations and project access. Wrong-account and expired-link outcomes reveal no project terms. Accepted links may be reopened by that same account. No public customer directory exists.
- Map that accepted application user to the canonical provider client sender ID. Independently identify the owner sender ID, provisioned bot sender ID, exact Photon instance and returned group GUID. Three distinct sender IDs are required. Only the accepted client is the requester/approver; matching display names grant no rights.
- Save routine operations, stable page/element target IDs, exclusions, allowance and capacity. P0 supports `replace_text` and `change_color`, at most ten open automatic tasks, and one unit per accepted request. Contractual revision rounds require review-only handling. Saving policy creates an immutable version. Policy cannot expand confirmed scope.
- Verify the real group and introduce the assistant, confirm participant consent and activate. Postgres rechecks baseline, client acceptance, identity mapping, policy, test-send receipt, verified webhook echo and disclosure. Activation and resume record fresh server cutoffs. Earlier events remain historical/review-only. Paused/review-only projects cannot yield eligible automatic intake. Completed and archived projects retain history and stop accepting work; closed projects cannot be reopened through setup.

Each explicit Save is persisted server-side and survives refresh and sign-out. Unsaved field edits are not promised to survive navigation. Mutations use a stable idempotency key for retries plus an expected project version. A conflict keeps current form values visible so the owner can refresh and compare. Activated setup cannot be overwritten: material changes belong in the later proposal/amendment workflow.

## Photon provisioning and webhook boundary

The installed HTTP SDK is pinned. The adapter uses actual `chats.get`, `chat.participants[].address`, `chat.guid`, `chat.isGroup`, `messages.sendText` and the returned message GUID. Configure `PHOTON_HTTP_ADDRESS`, `PHOTON_TOKEN`, `PHOTON_INSTANCE_ID` and `PHOTON_BOT_SENDER_ID` from your provisioned dedicated instance. The latter must be the verified sending account, not a name typed by the owner. Group verification expects exactly owner/client/bot; the SDK may omit the sending account from its remote participant list, so only that provisioned bot ID is added.

**Native Photon webhook verification and event payloads remain an external provisioning dependency.** The public SDK does not establish your account's webhook authentication mechanism. This repository deliberately does not guess that mechanism or treat an unsigned native webhook as trusted. Until it is provisioned, setup cannot pass the echo test and activation remains blocked.

The implemented intake boundary accepts the application's **normalized-gateway-v1** contract, not arbitrary native Photon payloads. Use a trusted provider ingress that first verifies Photon origin, replay semantics and payloads using the mechanism actually supplied for your account, then maps events and forwards them to `/api/v1/integrations/photon/webhook` over HTTPS with `Authorization: Bearer <PHOTON_GATEWAY_SECRET>`. The secret must contain at least 32 random characters. Set `PHOTON_WEBHOOK_MODE=normalized-gateway-v1` only after that ingress is implemented and tested. Deploy normalization within the existing Node worker/ingress host; no additional microservice is required. Protect both the provider-facing ingress and this internal boundary. Native Photon requests are rejected by default.

Normalized input (application-owned shape):

```json
{
  "instanceId": "actual-instance-id",
  "eventKey": "stable-provider-event-id",
  "kind": "message",
  "chatGuid": "actual-provider-group-guid",
  "senderId": "canonical-provider-sender-id",
  "messageGuid": "actual-provider-message-guid",
  "occurredAt": "2026-10-17T20:00:00Z",
  "text": "Message text"
}
```

Kinds are `message`, `membership`, `edit`, `delete` and `delivery`. Do not generate a fresh event key on each redelivery, invent sender IDs or set occurrence time to processing time. Missing occurrence time is review-only. Retry non-2xx responses: the send receipt can race its webhook echo, and intake asks for retry until the receipt is recorded. Each accepted webhook re-fetches exact live group membership from Photon, then commits the event and its disposition transactionally. The bot echo matching the recorded test GUID establishes webhook verification. Unknown senders or changed membership invalidate verification and hold automation for owner review. Events are deduplicated by instance/event ID. No message bodies or contracts are logged.

Timeouts after a test submission become **unknown** and are never blindly retried. Inspect provider records and reconcile the exact group/test GUID before an administrator restores a known state; do not simply clear uncertainty or claim delivery. New tests can be run after a project is paused. If group membership is intentionally changed, it must again match the three confirmed identities before re-verification; general multi-client/team membership is outside P0.

## Proposal access boundary

For an existing proposal revision, POST `/api/v1/projects/:id/invitations` with `{expectedVersion, invitation:{email, proposal_id, revision}}` and an `Idempotency-Key`. The database checks proposal/project consistency and invitation acceptance returns **exactly** `/proposals/:id?revision=N`. General project invitations omit both proposal fields. The setup UI creates general invitations.

Client reads use `shared_proposal`, which requires accepted project membership, the designated authenticated approver and an explicit non-draft revision. Clients receive only `shared_terms`, project name, revision, expiry and status. They have no SELECT grant through an RLS policy on owner proposal tables and never receive `internal_notes`. A forwarded navigation link does not transfer authority.

This feature establishes invitation/identity and authenticated proposal access. Proposal authoring, sending, responses and atomic approval-to-scope/tasks are **section 5 of the completion checklist**, and remain separate work. There is deliberately no decorative Approve button or claim of approval-to-work completion. Likewise, `eligible_intake` is durable authorized intake for the future analysis/acceptance worker, not an accepted task or a client commitment.

## Verification

```sh
npm run typecheck
npm run lint
npm test
# Install the Playwright Chromium browser once, or set PLAYWRIGHT_CHROME_PATH.
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest runs the actual migration and its RLS/transaction functions in PGlite (embedded Postgres), with minimal stand-ins for Supabase's `auth` and `storage` schemas. It exercises tenant isolation, forwarded/expired invitations, exact proposal destinations, private DTOs, stale/idempotent commands, baseline guards, activation, replay cutoff, unknown membership and lifecycle closeout. It does not substitute for testing Supabase's hosted Auth/Storage services. Playwright uses an isolated `.next-e2e` build directory and port 3100 for anonymous login, recovery and destination-preservation tests. It does not send real emails.

Before calling this feature operational, test actual owner signup, repeat sign-in and recovery emails; refresh/sign-out/resume of all saved setup steps; real text PDF extraction with your Gemini model; client invitation acceptance with a second mailbox; wrong-mailbox and expired invitation failures; real Photon group read/send/echo; membership-change holds; and cross-organization access against the deployed Supabase policies. Those external checks cannot run without your provisioned credentials and consented test group.

The dependency audit currently reports pre-existing development-tool advisories in the shadcn/ESLint glob chain; no SDK/runtime advisory was introduced by this feature. Avoid automatic major-version downgrades offered by `npm audit fix --force`.

References checked during implementation: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Photon SDK](https://github.com/photon-hq/advanced-imessage-ts).
