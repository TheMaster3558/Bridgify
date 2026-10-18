> Historical planning/reference: the [owner-only specification](Bridgify_Technical_Build_Specification.md) supersedes any client website, invitation or web approval flow described below. Clients now interact only through iMessage.

# Accounts and project onboarding

This feature replaces the seeded login mockup with Supabase email/password authentication and saved project setup. It uses Next.js/React/TypeScript, Supabase Auth/Postgres/private Storage, Zod, Gemini (`@google/genai`), `pdfjs-dist`, the Photon HTTP SDK, a persistent TypeScript document worker, Vitest and Playwright. There is no seeded owner and no authentication bypass.

## Start with an empty Supabase project

1. For a new Supabase project, run these onboarding migration files in order: `supabase/migrations/202610170001_onboarding.sql`, then `supabase/migrations/202610170002_password_auth.sql`, then `supabase/migrations/202610170003_agreement_review.sql`, then `supabase/migrations/202610170004_immediate_agreement_analysis.sql`, then `supabase/migrations/202610170005_photon_pro_people.sql`, then `supabase/migrations/202610170006_photon_users_only.sql`. Apply only migrations not already applied. These are the onboarding migration chain; do not blindly run the independent initial message-intake schema alongside it. Do not rerun the first migration or erase existing data. The second migration removes the email-verification check from invitation acceptance. No seed SQL is required.
1. For a new Supabase project, run **both** migration files in order: `supabase/migrations/202610170001_onboarding.sql`, then `supabase/migrations/202610170002_password_auth.sql`. If the first migration is already applied, run **only the second migration**. Do not rerun the first migration or erase existing data. The second migration removes the email-verification check from invitation acceptance. No seed SQL is required. Settings does not add tables: the owner name and timezone are saved on the authenticated account, and the organization name is the existing `organizations.name` row.
2. Copy `.env.example` to `.env.local` if you have not already configured it. Fill in `NEXT_PUBLIC_SUPABASE_URL`, the public anon/publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `APP_BASE_URL` (for development, `http://localhost:3000`). `SUPABASE_SERVICE_ROLE_KEY` stays server-only and is used for private PDF uploads, provider recording and the worker. Ordinary authentication and owner commands use the user's Supabase session, never an administrator signup bypass.
3. In Supabase **Authentication → Sign In / Providers → Email**, enable the Email provider and email/password signups, and turn **Confirm email OFF**. Save the settings. Signup uses `auth.signUp({email, password})`; with confirmation disabled, Supabase immediately returns a session. Sign-in uses `auth.signInWithPassword`. Normal signup/sign-in require no email or SMTP. If confirmation remains enabled, the application reports the configuration mismatch rather than claiming that signup signed the user in. SQL migrations do not change hosted Supabase Auth configuration.
4. In **Authentication → URL Configuration**, set Site URL to `APP_BASE_URL`. For local development, allow `http://localhost:3000/**` to include password-reset callbacks with their destination parameters. Use your explicit production host and callback path when deployed. Use `localhost` consistently with `APP_BASE_URL`; `127.0.0.1` is a different origin.
5. Use Node 24 LTS, run `npm ci`, then `npm run dev`. Open `/login`, choose **Create an account**, and enter your email and a matching password of 8–72 bytes. Signup immediately opens the intended invitation/proposal or `/app`, where a new owner creates a workspace. Sign out and sign back in with the same password. Restart the development server after `.env.local` changes. Set public Supabase variables before production builds, since Next.js embeds public variables at build time.

6. For agreement extraction, configure `GEMINI_API_KEY` and `GEMINI_MODEL` using a model available to your account. Analyze and Retry now call Gemini immediately in the authenticated web request; **`npm run dev` is sufficient for this Agreement step** after the migrations are applied. The document worker is optional for older background-mode jobs. If you run it, use `npm run worker` with `WORKER_ENABLED=true` on Node 24. `GEMINI_FALLBACK_MODEL` defaults to `gemini-3.1-flash-lite` for transient failures or exhausted quota; set it to `none` to disable fallback. A configured short model name such as `3.1-flash-lite` is normalized to `gemini-3.1-flash-lite`. Model availability and free-tier limits remain provider controlled.

The web server handles interactive agreement analysis; the optional background worker may run separately. A hosted database is not provisioned by this code. `DATABASE_URL` is unnecessary for this feature: web commands and durable jobs use Supabase RPC rather than a second database connection.

## Actionable tasks and needs attention

After applying the onboarding migrations through `202610170006_photon_users_only.sql`, apply `supabase/migrations/202610170007_work_management.sql` to the same Supabase project. It creates the `project_tasks` and `owner_decisions` tables used by the owner dashboard. For an existing project, apply only migrations that are not already recorded as applied; do not rerun this SQL on a project where the migration has already been applied. If the tables exist but PostgREST still reports them missing, reload the Supabase API schema cache and retry.

## Project creation defaults and navigation

After the existing onboarding and work-management migrations, apply `supabase/migrations/202610170008_editable_project_introduction.sql` and `supabase/migrations/202610170009_manual_approval_defaults.sql` before deploying the updated project wizard. The former retains the actual introduction sent to the client. The latter permits an empty list of automatic-change targets when every request requires manual approval; automatic acceptance still requires explicit targets. Existing saved policies retain their values.

New projects default to manual approval, text replacement as the permitted change type, no automatic-change targets, the standard approval boundaries and a limit of ten open automatic tasks. Advanced settings start collapsed and need no edits to continue with manual approval. Forward setup headers use the same validation and save/confirmation action as Continue, and cannot skip intermediate steps. Earlier steps remain available for review.

## Account and recovery behavior

Email and password are the authentication method. There is no email confirmation step for signup or sign-in. Passwords are handled by Supabase Auth and are never stored in application tables or logs. Authentication failures retain the exact proposal/invitation destination. Passwords are not trimmed. Signup and password updates require matching confirmation fields, a minimum of eight characters and a maximum of 72 UTF-8 bytes; existing shorter passwords can still be used to sign in.

**Forgot password** requests a recovery email with a neutral account-existence response. This optional recovery path still needs Supabase email delivery (custom SMTP for actual client addresses). Under **Authentication → Emails → Templates → Reset Password**, use:

```html
<h2>Reset your Bridgify password</h2>
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery"
  >Choose a new password</a
>
```

The app sets RedirectTo to `/auth/confirm?next=...&flow=recovery`, so the ampersand is intentional. The server verifies the single-use recovery token and sends the authenticated user to `/reset-password`; after saving, the original destination is restored. Expired/invalid links return to the recovery form. `auth.updateUser({password})` requires an authenticated session. Legacy magic-link-only users can use Forgot password to set their first password, or change it from an existing session at `/reset-password`.

No-confirmation signup treats the account email as self-declared; it does not prove mailbox ownership. Invitation access still requires the unguessable invitation token and a matching authenticated account email, with expiry and wrong-account checks. The owner must continue confirming the client's actual application identity and provider sender mapping during project setup. Do not describe such accounts as email-verified.

Every owner layout and API read is server-authorized. RLS isolates organizations, documents, spans, baselines, policies, connection state and history. Browser roles cannot directly mutate tables or execute worker functions. The application uses `auth.getUser()` rather than trusting a client-supplied session. Sign-out invalidates the session through Supabase and clears its cookies. Private responses must not be cached by a shared CDN.

## Saved project setup

- Save basics: integer minor currency units (two decimal places) and an explicit three-letter currency, an IANA project timezone and an optional agreed calendar date (not an inferred UTC deadline).
- Paste the complete agreement or upload a private text PDF. Limits: 5 MB, 50 pages, 30,000 extracted characters, 100 extracted terms. No truncation is accepted. A scanned/empty page, oversized input, model failure or incomplete/invalid citations leaves the baseline unconfirmed. The UI polls queued/processing documents; failed extractions have a Retry extraction action that requeues the same private source. Unsupported scans still need a text PDF or pasted text. All imports and confirmed baseline versions remain in history.
- Inspect full source pages and each exact quotation. Edit term wording/category, remove erroneous draft terms and add missing terms from exact source quotes. Review the whole document before confirming. The database checks that every citation belongs to the ready document for this project. Importing a replacement invalidates the current draft baseline and policy. Confirming a new baseline invalidates any prior automation policy, requiring renewed owner review.
- Connect the client on iMessage from People & chat. Choose an existing Photon user, or select **Add user** to create them in Photon with their name, email and country-coded phone number. The returned user is selected automatically; choose **Connect this client** to save the project link. You can still manage users on the Photon **Users** page. The server reads their phone number and assigned agent number from Photon; a Bridgify invitation is not required for this connection. Matching display names grant no rights.
- Save routine operations, stable page/element target IDs, exclusions, allowance and capacity. P0 supports `replace_text` and `change_color`, at most ten open automatic tasks, and one unit per accepted request. Contractual revision rounds require review-only handling. Saving policy creates an immutable version. Policy cannot expand confirmed scope.
- Text the assistant introduction to the client, confirm their consent and activate. Postgres rechecks baseline, the connected Photon user, policy, the accepted introduction send and disclosure. Activation and resume record fresh server cutoffs. Earlier events remain historical/review-only. Paused/review-only projects cannot yield eligible automatic intake. Completed and archived projects retain history and stop accepting work; closed projects cannot be reopened through setup.

Each explicit Save is persisted server-side and survives refresh and sign-out. Agreement review edits also autosave after 500 ms; wait for Saved or use Save review draft before leaving. A browser refresh warns while review changes are unsaved. Basics are persisted on Save basics & continue. Mutations use a stable idempotency key for retries plus an expected project version. A conflict keeps current form values visible so the owner can refresh and compare. Activated setup cannot be overwritten: material changes belong in the later proposal/amendment workflow.

## Photon provisioning and webhook boundary

### Project client connection (Photon Pro)

People & chat uses a Photon Pro (or Free) project. Set server-only `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` from Photon project Settings; no dedicated instance, bot sender ID or chat GUID is needed. Bridgify lists the project's users through the Spectrum API (`GET https://spectrum.photon.codes/projects/{id}/users/?type=shared`, Basic auth with those credentials) and sends the introduction with `spectrum-ts`. These plans use shared numbers: each client texts the assistant from a one-to-one conversation (`any;-;<client phone>`) at the number Photon assigned to them, and group chats are unavailable. A Photon user can be connected to only one project at a time. Project setup does not require a Bridgify invitation; the Photon user is the client identity.

Activation requires that Photon accepted the introduction. Accepted is not proof the client's device displayed it, so confirm with the client. An uncertain send blocks retries; choosing the client again resets the conversation so the introduction can be resent. Apply `supabase/migrations/202610170005_photon_pro_people.sql` and `supabase/migrations/202610170006_photon_users_only.sql` after the other onboarding migrations.

### Dedicated instance (Business plan)

The installed HTTP SDK is pinned. Settings' connection check still uses a dedicated instance if you have one: configure `PHOTON_HTTP_ADDRESS`, `PHOTON_TOKEN`, `PHOTON_INSTANCE_ID` and `PHOTON_BOT_SENDER_ID` only then. Project setup does not use these values.

**Native Photon webhook verification and event payloads remain an external provisioning dependency.** The public SDK does not establish your account's webhook authentication mechanism. This repository deliberately does not guess that mechanism or treat an unsigned native webhook as trusted. Dedicated-instance projects still need that echo path; Photon Pro project setup activates from the accepted introduction send instead.

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

Before calling this feature operational, test immediate owner signup without a confirmation email, repeat password sign-in and password recovery emails; refresh/sign-out/resume of all saved setup steps; real text PDF extraction with your Gemini model; client invitation acceptance with a second mailbox; wrong-mailbox and expired invitation failures; real Photon group read/send/echo; membership-change holds; and cross-organization access against the deployed Supabase policies. Those external checks cannot run without your provisioned credentials and consented test group.

The dependency audit currently reports pre-existing development-tool advisories in the shadcn/ESLint glob chain; no SDK/runtime advisory was introduced by this feature. Avoid automatic major-version downgrades offered by `npm audit fix --force`.

References checked during implementation: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [email authentication](https://supabase.com/docs/guides/auth/passwords), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Photon SDK](https://github.com/photon-hq/advanced-imessage-ts).

## Agreement setup review (202610170003)

`/app/projects/new` now uses the existing authenticated setup wizard. Save Basics creates a server draft before uploading anything. Saved server projects appear above the existing device-only project list with Resume setup links. Old device-only records remain on the device; they are not automatically promoted to confirmed database baselines.

The Agreement step reuses the private `agreements` bucket, `documents`, `document_spans`, durable `jobs`, the PDF parser, and server-side Gemini extraction. Gemini returns validated structured fields for deliverables, exclusions, milestones/deadlines, responsibilities, price/currency, and revision allowance plus requests/rounds/ambiguous/unspecified. Exact citations are checked against the source. Missing categories and ambiguous commercial terms create review issues that require an explicit owner resolution or acknowledgment; missing values remain null.

Review drafts live in `documents.review_draft` with independent optimistic `review_version` checks. `POST /api/v1/projects/:id/agreement` saves reviews or retries extraction through the existing guarded `onboarding_command`. Confirmation uses `/scope/confirm`, stores terms in `scope_versions.terms` and the complete reviewed commercial fields, conflict choices and issue resolutions in `scope_versions.agreement`, and advances setup to step 3. Conflicting price/date fields require an explicit keep-Basics or update-from-agreement choice. Confirming does not activate the project, send a message, or create tasks. Rounds and unspecified revision allowances block automatic policy mode later.

`projects.current_agreement_document_id` identifies the current upload. Replacement imports invalidate the current baseline/policy and cancel pending/processing jobs for older uploads; the finish RPC locks the project and refuses stale documents or leases. Historical documents and baselines remain private and retained. The original command is retained as an internal implementation with browser execution revoked; no alternate public confirmation path bypasses review checks.

Verification: Postgres tests cover review persistence, idempotency/version conflicts, cross-user denial, warning/evidence validation, commercial conflicts, failed retry, stale job publication and inactive confirmation. Domain tests use the real installed PDF parser and mock only Gemini responses. The Playwright Agreement test bundles the production wizard components with isolated transport/navigation fixtures to exercise Basics → paste → review/edit → refresh → confirm → People & chat. It does not prove hosted Supabase Auth/Storage or live Gemini. Configure Supabase URL/public key/service-role key, apply the migration, set `GEMINI_API_KEY`, `GEMINI_MODEL`, `WORKER_ENABLED=true`, and start both web and worker processes for a live verification.

## Immediate Analyze / Retry (202610170004)

Apply `supabase/migrations/202610170004_immediate_agreement_analysis.sql` after the preceding onboarding migrations. It adds an execution mode to the existing jobs and two service-only functions: `claim_agreement_job(project,document)` claims exactly that project’s current draft document, and `finish_agreement_attempt` delegates to the existing lease/source guards while making an interactive error terminal. A click no longer waits for worker polling or 5/30-second background retries. Authenticated browser roles cannot call either elevated function. Historical background jobs retain their existing worker behavior.

Upload/paste still persists the original source and durable job first. The same HTTP request then reads that scoped source, calls Gemini, validates all structured output and citations, commits the result, and responds. The UI displays an immediate analyzing state while that request is in flight and loads the saved result when it returns. Saved queued agreements have Analyze now; failures have Retry extraction, which starts another request immediately with a fresh command key. A refresh or lost HTTP response retains the private source; a currently held lease prevents duplicate generation, and an expired lease can be resumed with Analyze now. Replacement uploads cannot publish old results. The web host must allow the route’s configured 60-second duration; at most two 20-second Gemini calls are made per request.

The extraction adapter uses the installed SDK’s official Interactions API with validated JSON Schema, `store:false`, low thinking, and SDK retries disabled. On quota, timeout, or temporary server failure it tries the configured fallback once. Authentication errors and invalid citations are never bypassed. The actual model and fallback reason are retained in the extraction; the wizard identifies the model used. Both models may be unavailable or out of quota: in that case the agreement remains saved and the UI shows a specific safe failure instead of claiming a result. Paid billing is not enabled by this code.

Verification includes same-request execution before responding, cross-user API denial, duplicate lease suppression, worker exclusion, expiry/replacement guards, explicit retry without hidden scheduling, safe provider errors, fallback, and persistence failure. Tests use isolated Gemini responses plus actual Postgres migration functions. Live synthetic checks must be reported separately from hosted project verification; a successful tiny model probe is not proof that a full contract extraction succeeded.

### Gemini output schema compatibility

The application schema and the provider's generation schema are separate. `geminiOutputSchema` sends only object/array structure, required fields, enums and nullable alternatives to Gemini; UUID/date formats, regex patterns, length/range bounds and other validation metadata are enforced on the returned object by the original Zod schema. Exact source citations are also rechecked. This avoids sending validation keywords that Gemini's schema decoder may reject. A rejected or malformed extraction never becomes a confirmed baseline. In controlled synthetic checks, the pared generation schema completed successfully while the original full Zod JSON schema returned an invalid-argument error with the same prompt and model settings.
