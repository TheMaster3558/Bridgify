# Project iMessage conversation history

Open a project and select **View iMessage conversation**, or use the conversation link after saving a client in **People & chat**. Draft projects can view history too. The project must have a saved Photon shared-user connection.

The page reads the existing client/agent conversation from Photon, including available messages before project activation. It shows both directions, timestamps in the project timezone, provider message references, delivery/read state, and current edit/deletion markers. Attachment names/types are shown; attachment downloads and historical versions of edited text are not implemented.

The latest 50 messages load first. **Load older messages** uses provider pagination. The page refreshes every five seconds while visible; **Refresh messages** reloads the latest page and resets pagination. Provider errors are displayed with a retry option, retaining previously loaded messages until a successful refresh. Changing the saved connection replaces the displayed conversation.

## Configuration and boundaries

- Existing Supabase authentication and owner RLS authorize the project before contacting Photon. The history GET accepts only a project ID and a signed pagination cursor; it gets the client address, Photon user, chat GUID, and instance from saved project People data.
- Set `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` on the server. These are the same credentials used by the existing Photon user picker. Restart the app after changing environment variables.
- The saved Photon user is checked against the current provider user and assigned agent before fetching messages. Changed mappings require reconnecting the client in People & chat.
- The adapter uses the installed SDK's `cloud.issueImessageTokens` and `@photon-ai/advanced-imessage/grpc` `messages.listInChat`, following the shared gateway routing in the installed Spectrum iMessage provider. [Official SDK repository](https://github.com/photon-hq/advanced-imessage-ts).
- Pagination cursors are signed, expire after an hour, and are bound to the project and saved connection. Server tokens and credentials never reach the browser.
- History remains stored by Photon. This change adds no database cache or migration and does not replace the legacy durable intake/domain operations. Provider availability and retention determine the available history.
- Viewing history does not send messages, mark messages read, subscribe a listener, call Gemini, create tasks, or activate automation. The existing listener is still responsible for AI replies.

## Verification

Domain tests cover project authorization before provider access, missing connections, connection validation, wrong-chat/wrong-sender filtering, deletion/edit normalization, signed cursor tampering/context/expiry, and sanitized provider errors. An isolated browser fixture exercises the production conversation component for both message directions, pagination/deduplication, refresh, recoverable errors, and changed/unlinked connections. Fixtures do not send real messages.

A read-only live Photon history request was verified using the configured project and an existing saved client connection. No outbound test message was sent.

## Owner replies from the dashboard

The conversation page includes a **Message [client]** text box and **Send message** button. Messages contain 1–4,000 characters and are sent using the existing `sendPhotonText` adapter to the project's saved Photon client. They use the same Photon address as the assistant; outbound bubbles are labeled Bridgify because that address is shared by manual and AI replies. No AI generation, task creation, or automation activation occurs when the owner sends a message. Gemini responses still depend on the existing listener.

`POST /api/v1/projects/[projectId]/messages` requires the existing authenticated session, same-origin guard, workspace-owner membership for the project's organization, an `Idempotency-Key`, and `{text, connectionKey}`. The connection key comes from the history GET and prevents a stale browser from sending to a replacement client. Arbitrary recipient addresses are rejected. The server verifies the current Photon user and assigned agent before sending.

The server claims the attempt in the existing `command_receipts` table before calling Photon, using a namespaced key and a fingerprint of the project, connection, and message. Concurrent/repeated calls for that key return its saved state without sending again. Only the fingerprint, state, project ID, and provider message ID are stored in the receipt; message bodies remain in Photon. The standard `SUPABASE_SERVICE_ROLE_KEY` server configuration is required for receipt storage. No new migration is required.

After confirmed provider acceptance, the text box clears and history refreshes. A definite failure preserves the text for retry. If delivery is uncertain or the network response is lost, the box preserves the current attempt and offers **Check send status**, which uses the same key. Check the conversation or with the client before choosing **Compose another message**. There is no automatic resend. A server crash after claiming an attempt may leave its delivery unknown and requires checking Photon. Uncertain-attempt state in the browser lasts until navigating away or refreshing; do not retype an uncertain message without checking history.

Tests cover owner authorization, connection changes, validation, pre-send storage failure, duplicate attempts, provider exceptions, failed receipt updates, and successful/failed/unknown send UI states. No real client message was sent as part of this feature's verification.
