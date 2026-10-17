import { Spectrum } from "@spectrum-ts/core";
import { imessage } from "@spectrum-ts/imessage";
import { createReplyDemo } from "../lib/photon/reply-demo";
import { createConfiguredGeminiChatResponder } from "../lib/ai/chat-reply";

async function main() {
  const projectId = process.env.SPECTRUM_PROJECT_ID?.trim();
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET?.trim();
  if (!projectId || !projectSecret) {
    console.error("Add SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET from Photon project Settings to .env.local, then run this command again.");
    process.exitCode = 1;
    return;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error("Add GEMINI_API_KEY from Google AI Studio to .env.local, then run npm run photon:demo again. GEMINI_MODEL is optional.");
    process.exitCode = 1;
    return;
  }
  const gemini = await createConfiguredGeminiChatResponder();
  // Verify a real generation succeeds before announcing the AI connection.
  await gemini.respond("startup-check", "Reply with exactly: Ready.");
  const startedAt = Date.now();
  const app = await Spectrum({
    projectId, projectSecret, providers: [imessage.config()],
    options: { logLevel: "error" }, telemetry: false,
  });
  const handle = createReplyDemo({ startedAt, respond: gemini.respond,
    onReadFailure: () => console.log("Could not send the iMessage read receipt; continuing with the reply."),
    onTypingFailure: () => console.log("Could not update the iMessage typing indicator; continuing with the reply."),
  });
  const stop = () => { void app.stop(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  console.log(`Photon + Gemini connected (model: ${gemini.model}). Text your agent's address. Keep this terminal running; Ctrl+C stops it.`);
  try {
    for await (const [space, message] of app.messages) {
      const dm = imessage(space);
      if (!dm) continue;
      const result = await handle(dm, message);
      if (result === "reply_sent") console.log("Reply submitted to Photon. Check Messages to confirm receipt.");
      else if (result === "generation_failed") console.log("Gemini could not produce a reply; a brief unavailable notice was sent. Check Gemini model access and quota.");
      else if (result === "send_uncertain") console.log("Reply submission failed or is uncertain. Check Messages before trying another fresh text.");
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await app.stop();
  }
}
main().catch(() => {
  console.error("Could not run Photon + Gemini. Check both API credentials, Gemini model access/quota, the assigned iMessage line, and network access. No credentials were logged.");
  process.exitCode = 1;
});
