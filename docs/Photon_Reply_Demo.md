# Run the project facilitator

`npm run automation:sdk` starts a live Photon SDK listener feeding the durable
project facilitator. `npm run photon:demo` is a compatibility alias for this SDK
mode; it no longer runs a separate general chatbot.
Clients receive confirmations and saved request/task status, while work remains
subject to the project owner's agreement and automation settings.

Configure `DATABASE_URL`, `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`,
`GEMINI_API_KEY` and `GEMINI_MODEL` in `.env.local`, install the automation
migrations with `npm run automation:install`, and finish the project's People &
chat, agreement and activation setup. Only connected, activated project chats
are processed; there is no invented status or chatbot fallback for unlinked chats.

Run one of these commands and keep it running:

```sh
AUTOMATION_WORKER_ENABLED=true npm run automation:sdk
# Compatibility entry point:
npm run photon:demo
```

The SDK receives messages over an open connection, saves them, and wakes the
processor immediately. It catches up authenticated history at startup and whenever
the overall stream has to be reopened. The SDK also resumes interrupted streams
internally. It retries failed saves before advancing to the next event. Normal
incoming delivery does not poll message history. A two-second database recovery
check resumes saved work, due retries and owner-queued replies even without a new
client message. Keep your computer awake and the command running; Ctrl-C stops it.

No public URL or webhook signing variables are required locally. Keep
`AUTOMATION_WORKER_ENABLED=true` in `.env.local`; the dedicated `automation:sdk`
command selects SDK intake even if `AUTOMATION_INTAKE=webhook` is saved for later.
Alternatively, `AUTOMATION_INTAKE=sdk npm run automation:worker` selects it through
the general worker entry point. `history` remains an explicit 30-second polling
fallback, and `webhook` mode processes already-persisted webhook jobs.

Production uses signed Photon webhooks for immediate processing. Both intake
modes use the same project inbox, message GUID deduplication, task processor and
reply outbox. A brief overlap during cutover does not create a second task or
confirmation for the same source message. Stop the local listener after verifying
hosted delivery; see [Vercel deployment and cutover](Automation_Deployment.md).

The facilitator interprets client requests,
saves tasks or owner review items, and delivers persisted replies. Manual approval
settings remain manual approval. Outbound echoes cannot authorize new work.
Status questions can report pending review, missing details, queued work, progress
and completion from real records. The assistant does not perform website edits.

See [Project Automation](./Project_Automation.md) for delivery safety, saved
permissions and setup, and [Implementation Status](./Automation_Remaining_Todos.md).

The old standalone chat responder and isolated tests remain as legacy helpers,
but neither production worker command uses their conversational response path.
Stop older demos or other apps using the same Photon agent number, including on
other developers' machines. A separate responder bypasses this project's outbox
and can send a second chatbot answer even when this worker sends exactly once.
