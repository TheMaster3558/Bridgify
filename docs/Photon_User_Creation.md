# Add a Photon user during project setup

In **New Project → People & chat**, choose **Add user**. Enter a first name, optional last name, email, and an international phone number with its country code. Select **Create Photon user**. The returned user is selected in the existing client picker; select **Connect this client** (or Switch/Reconnect for an existing selection) to persist the draft project's client binding. The introduction remains a separate action.

The create operation uses the real Photon provider as the user source of truth. It adds no local user directory or database migration. The existing `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` stay server-side. No new package or agent framework is introduced.

## Provider contract

This repository uses **Stable Spectrum**, not Photon 2.0. The request was checked against the official deployed [Spectrum OpenAPI](https://spectrum.photon.codes/openapi/json), linked from [Stable API documentation](https://photon.codes/docs/api-reference/introduction), on 2026-10-17:

- `POST https://spectrum.photon.codes/projects/{projectId}/users/`.
- Basic authentication with the configured project ID and project secret.
- JSON body `{type:"shared",phoneNumber,firstName,lastName,email}`. Phone numbers follow the provider's `^\+[1-9]\d{6,14}$` format. The form accepts common punctuation around a country-coded number and normalizes it before submission; it never guesses a country code.
- The verified response is `{succeed:true,data:{id,projectId,type,firstName,lastName,email,phoneNumber,assignedPhoneNumber,...}}`. The adapter checks the returned project, shared-user type and phone number, and exposes only the same contact fields already used by the picker.
- The provider identifies shared users by phone number within the project. Repeating creation for that number returns the same user; supplied profile fields may be updated by Photon. Bridgify checks the existing list first and selects a matching user without posting an update. Concurrent provider creation retains Photon's own idempotency semantics.
- No invitation flag or introduction-send call is included in this request.

The installed `@spectrum-ts/core` package has no project-user creation helper, so this operation uses the documented REST API alongside the existing REST user-list integration. It does not depend on the newer Beta credentials or API host.

## Authorization, retry and persistence

`POST /api/v1/integrations/photon/users` requires the existing Supabase owner session, same-origin guard, and an accessible draft `projectId`. Activated/closed projects cannot use this setup action. The browser cannot supply a Photon project ID, credentials, assigned agent number or user type. Server-side Zod validation runs before the provider mutation.

Names, email, phone, and pending/error state stay in the form until completion or cancellation. A successful response selects the actual provider user. The existing guarded chat-binding command persists the connection after the owner chooses Connect. Refresh then reads the saved binding and provider list normally. Cancelling/leaving the form does not persist a local contact draft.

A timed-out, failed, or unreadable create response is reconciled with a fresh provider list. If no matching user can be confirmed, the form preserves its values and offers retry with the same phone number. There are no automatic POST retries; repeat submissions are safe under the verified provider phone-number contract. Provider errors and quota/permission failures are displayed without leaking raw responses or credentials.

Tests cover the exact request/response adapter, duplicate reuse, lost-response reconciliation, malformed provider responses, validation, authentication/origin/project authorization, creation/selection, retry and saved binding across reload. Provider fixtures exist only in tests. No live Photon contact was created, and no live invitation or message was sent during verification.

## Introduction and recipient authorization errors

Photon's user directory and iMessage gateway authorization are separate checks.
A user can appear in the picker with an assigned shared number while the gateway
returns `Target not allowed for this project`. If a fresh project token can read
an existing client's history but is denied for this client, check the affected
recipient's shared-line assignment with Photon. If the user is already listed
correctly, ask Photon support to check authorization for that project and user.
Changing Supabase credentials does not repair a Photon recipient restriction.

Bridgify reports a typed Photon authorization rejection as a failed introduction,
with an actionable error. Timeouts and missing receipts remain unknown; confirm
with the client before reconnecting or retrying an unknown send. A later history
permission error does not prove that an earlier introduction was never delivered.
The app does not resend introductions or reset unknown receipts automatically.

## Delete a Photon user

Open the three-dot menu on a user in **People & chat**, select **Delete user**, and type the displayed phone number to confirm. Cancelling makes no request. A confirmed deletion removes the provider user from the list and clears an unsaved selection. Provider failures keep the user and confirmation dialog available for retry.

Apply `supabase/migrations/202610170011_photon_user_deletion.sql` after the existing onboarding migrations before using deletion. The server also needs the existing `SUPABASE_SERVICE_ROLE_KEY` to record provider results. Creating and listing users still use the existing configuration and need no new migration.

Deletion follows the same Stable Spectrum [official OpenAPI](https://spectrum.photon.codes/openapi/json): `DELETE /projects/{projectId}/users/{userId}/`, Basic project authentication, success `{succeed:true,data:{userId}}`. Photon **soft-deletes** the user so they stop appearing in active listings. Bridgify does not claim to erase Photon's retained data or participants' existing iMessage messages.

The authenticated DELETE endpoint requires an accessible unfinished draft and owner access, plus the exact current phone number. The configured Photon project comes exclusively from server credentials. The database checks whether **any** Bridgify project or chat binding uses the user/phone, including other workspaces and retained projects, and rejects deletion without exposing those project details. Switch the linked project to another client or delete that project first. The current connected client is also protected in the UI.

Before the provider DELETE, `begin_photon_user_deletion` durably reserves the user. It shares a per-user transaction lock with the existing people-binding domain operation. Pending/deleted IDs cannot be newly linked, including through generic project PATCH commands, so concurrent setup cannot bind a user being deleted. Only the trusted server records confirmed deletion; completed receipts retain identifiers, actor, status, and timestamp, with the phone cleared. Private receipts are readable only by the requesting owner. A newly provisioned user with a new provider ID can be linked normally.

Unknown delivery, a timeout, malformed responses, and a 404 alone do not count as successful deletion. The adapter reconciles against a fresh provider list. If absence cannot be confirmed, the durable reservation stays in place; refresh or retry deletion with the same user from an unfinished draft. A failed deletion does not silently release the reservation and permit a race with a late provider response. There is no automatic delete retry worker. No invitation, introduction, project deletion, or client message is sent by this operation.

Deletion tests cover actual Postgres guards for cross-workspace links, draft ownership, pending/deleted binding protection and receipt privacy; HTTP authorization/origin checks; the provider DELETE contract and uncertain outcomes; and browser confirmation, cancellation, errors, retry, selection clearing, and connected-client protection. No live Photon user was deleted during verification.
