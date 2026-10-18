# Project iMessage conversation history

Open a project and select **View iMessage conversation**, or use the conversation link after saving a client in **People & chat**. Draft projects can view history too. The project must have a saved Photon shared-user connection.

The page reads the existing client/agent conversation from Photon, including available messages before project activation. It shows both directions, timestamps in the project timezone, provider message references, delivery/read state, and current edit/deletion markers. Attachment names/types are shown; attachment downloads and historical versions of edited text are not implemented.

The latest 50 messages load first. **Load older messages** uses provider pagination. The page refreshes every five seconds while visible; **Refresh messages** reloads the latest page and resets pagination. Provider errors are displayed with a retry option, retaining previously loaded messages until a successful refresh. Changing the saved connection replaces the displayed conversation.

## Configuration and boundaries

- Existing Supabase authentication and owner RLS authorize the project before contacting Photon. The API accepts only a project ID and a signed pagination cursor; it gets the client address, Photon user, chat GUID, and instance from saved project People data.
- Set `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` on the server. These are the same credentials used by the existing Photon user picker. Restart the app after changing environment variables.
- The saved Photon user is checked against the current provider user and assigned agent before fetching messages. Changed mappings require reconnecting the client in People & chat.
- The adapter uses the installed SDK's `cloud.issueImessageTokens` and `@photon-ai/advanced-imessage/grpc` `messages.listInChat`, following the shared gateway routing in the installed Spectrum iMessage provider. [Official SDK repository](https://github.com/photon-hq/advanced-imessage-ts).
- Pagination cursors are signed, expire after an hour, and are bound to the project and saved connection. Server tokens and credentials never reach the browser.
- History remains stored by Photon. This change adds no database cache or migration and does not replace the legacy durable intake/domain operations. Provider availability and retention determine the available history.
- Viewing history does not send messages, mark messages read, subscribe a listener, call Gemini, create tasks, or activate automation. The existing listener is still responsible for AI replies.

## Verification

Domain tests cover project authorization before provider access, missing connections, connection validation, wrong-chat/wrong-sender filtering, deletion/edit normalization, signed cursor tampering/context/expiry, and sanitized provider errors. An isolated browser fixture exercises the production conversation component for both message directions, pagination/deduplication, refresh, recoverable errors, and changed/unlinked connections. Fixtures do not send real messages.

A read-only live Photon history request was verified using the configured project and an existing saved client connection. No outbound test message was sent.
