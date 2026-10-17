import "server-only";

export const DEMO_REPLY = "Hi! Bridgify here. I got your message — the iMessage connection is working.";

type DemoMessage = {
  id: string; direction: string; sender?: { id: string }; timestamp: Date;
  content: { type: string; text?: string };
  read?: () => Promise<void>;
};

/** Personal connection test only. Does not run the dashboard acceptance pipeline. */
export function createReplyDemo(options: {
  startedAt: number;
  respond?: (conversationKey: string, text: string) => Promise<string>;
  onReadFailure?: () => void;
  onTypingFailure?: () => void;
}) {
  const attempted = new Set<string>();
  return async (space: {
    id: string; type: string; send(text: string): Promise<unknown>;
    startTyping?: () => Promise<void>; stopTyping?: () => Promise<void>;
  }, message: DemoMessage) => {
    if (space.type !== "dm" || message.direction !== "inbound" || message.content.type !== "text" || !message.content.text?.trim()) return "ignored";
    // Photon project credentials control incoming routing. This connection demo
    // keeps no second local user list and grants no dashboard/work authority.
    if (!message.sender?.id) return "unidentified_sender";
    const timestamp = message.timestamp.getTime();
    if (!Number.isFinite(timestamp) || timestamp < options.startedAt || timestamp > Date.now() + 300_000) return "old_or_invalid_message";
    const key = JSON.stringify([space.id, message.id]);
    if (attempted.has(key)) return "duplicate";
    // Keep this personal test bounded and never blindly retry uncertain sends.
    if (attempted.size >= 1000) return "session_limit";
    attempted.add(key);
    // Photon's remote iMessage read() sends the chat-level read receipt.
    // Do this before generating the answer so the user sees it was received.
    try { await message.read?.(); }
    catch { options.onReadFailure?.(); }
    const showTyping = Boolean(options.respond && space.startTyping && space.stopTyping);
    if (showTyping) {
      try { await space.startTyping!(); }
      catch { options.onTypingFailure?.(); }
    }
    try {
      let reply = DEMO_REPLY;
      let generationFailed = false;
      if (options.respond) {
        try {
          reply = await options.respond(JSON.stringify([space.id, message.sender.id]), message.content.text);
          if (!reply.trim() || reply.length > 4000) throw new Error("invalid_chat_reply");
        } catch {
          generationFailed = true;
          reply = "I'm having trouble responding right now. Please try again in a moment.";
        }
      }
      try {
        await space.send(reply);
        return generationFailed ? "generation_failed" : "reply_sent";
      } catch {
        return "send_uncertain";
      }
    } finally {
      // Always clear the indicator, including after generation or send failure.
      if (showTyping) {
        try { await space.stopTyping!(); }
        catch { options.onTypingFailure?.(); }
      }
    }
  };
}
