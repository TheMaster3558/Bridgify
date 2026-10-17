# Text the agent and get a Gemini answer

This is a personal connection demo using Photon's actual Spectrum messaging SDK.
It runs on your laptop, without deploying Next.js, setting up a webhook, or using
the database. It is separate from the durable dashboard intake pipeline.

1. Open your Photon project's **Settings**. Copy the Project ID and Secret Key
   into `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` in `.env.local`.
2. Keep user configuration in Photon. No phone numbers or user list need to be
   entered locally; the SDK connects using your project's routing configuration.
3. Add `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey)
   to `.env.local`. Optionally set `GEMINI_MODEL` to a text model available to that
   key. If blank, the runner queries the Models API and selects a returned stable
   Flash text model, preferring newer versions and excluding image/audio models.
4. Run `npm run photon:demo` and leave the terminal running. It first verifies a
   small Gemini generation succeeds, then connects Photon and prints the model.
5. From Messages, send a fresh question to the agent address assigned by Photon.
   The runner sends the text to Gemini and returns its answer to that same DM.
   It first calls Photon's remote `message.read()` to send an iMessage read
   receipt. This marks the chat read; whether Messages displays “Read” depends on
   the provider/account's read-receipt behavior. Receipt failure does not block replies.
   Press Ctrl+C to stop.

Missing project or Gemini credentials stop the runner. User and line configuration stays
in Photon; there is no additional local registration step.

New inbound text DMs delivered to this authenticated Photon project get a reply.
The demo does not separately fetch or validate a dashboard users list; Photon
controls which messages its transport routes to the project. Groups, outbound
echoes and old messages are ignored. Duplicate suppression is process-local;
uncertain sends are not retried within the session. This is not the production
outbox/recovery system. Stop other demo listeners to avoid competing responders.

Gemini receives the current text plus up to six recent user/assistant exchanges
from that same chat/sender. Context is kept only in process memory, expires after
30 minutes of inactivity, is bounded to 100 conversations, and resets on restart.
No other chat's history, project records or credentials are included in the prompt.
Responses are short plain text. Model failures send a brief unavailable notice
without exposing provider diagnostics. No tools or agent framework are used.

This is conversational AI, not work acceptance: no tasks, revision charges or
website edits are created. Live AI verification requires an actual configured key
and receiving a Gemini answer in Messages; unit tests do not establish that.
`.env.local` is ignored by git; never put its secrets in the example file or chat.

References: [Photon getting started](https://photon.codes/docs/spectrum-ts/getting-started),
[receiving messages and suppressing outbound echoes](https://photon.codes/docs/spectrum-ts/messages),
[Gemini text generation](https://ai.google.dev/gemini-api/docs/text-generation).
