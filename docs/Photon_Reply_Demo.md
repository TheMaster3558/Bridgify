# Run the project facilitator

`npm run photon:demo` now starts the same durable project facilitator as
`npm run automation:worker`. It no longer runs a separate general chatbot.
Clients receive confirmations and saved request/task status, while work remains
subject to the project owner's agreement and automation settings.

Configure `DATABASE_URL`, `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`,
`GEMINI_API_KEY` and `GEMINI_MODEL` in `.env.local`, install the automation
migrations with `npm run automation:install`, and finish the project's People &
chat, agreement and activation setup. Only connected, activated project chats
are processed; there is no invented status or chatbot fallback for unlinked chats.

Run one of these commands and keep it running:

```sh
AUTOMATION_WORKER_ENABLED=true npm run automation:worker
# Compatibility entry point:
npm run photon:demo
```

The worker imports authenticated Photon history, interprets client requests,
saves tasks or owner review items, and delivers persisted replies. Manual approval
settings remain manual approval. Outbound echoes cannot authorize new work.
Status questions can report pending review, missing details, queued work, progress
and completion from real records. The assistant does not perform website edits.

See [Project Automation](./Project_Automation.md) for delivery safety, saved
permissions and setup, and [Remaining Todos](./Automation_Remaining_Todos.md) for
functionality that has not been implemented.

The old standalone chat responder and isolated tests remain as legacy helpers,
but neither production worker command uses their conversational response path.
Stop older demos or other apps using the same Photon agent number, including on
other developers' machines. A separate responder bypasses this project's outbox
and can send a second chatbot answer even when this worker sends exactly once.
