import assert from "node:assert/strict";
import test from "node:test";
import { createReplyDemo, DEMO_REPLY } from "../../lib/photon/reply-demo";

test("personal demo replies to a fresh direct text once, using its originating chat", async () => {
  let calls = 0;
  const now = Date.now();
  const handle = createReplyDemo({ startedAt: now });
  const space = { id: "original-chat", type: "dm", async send(text: string) { calls++; assert.equal(text, DEMO_REPLY); } };
  const message = { id: "message", direction: "inbound", sender: { id: "my-sender" }, timestamp: new Date(now), content: { type: "text", text: "Hello" } };
  assert.equal(await handle(space, message), "reply_sent");
  assert.equal(await handle(space, message), "duplicate");
  assert.equal(calls, 1);
});

test("demo ignores unidentified senders, group chats, bot echoes and messages from before startup", async () => {
  const now = Date.now();
  const handle = createReplyDemo({ startedAt: now });
  const space = { id: "chat", type: "dm", async send() { assert.fail("must not send"); } };
  const message = { id: "message", direction: "inbound", sender: { id: "me" }, timestamp: new Date(now), content: { type: "text", text: "Hello" } };
  assert.equal(await handle(space, { ...message, sender: undefined }), "unidentified_sender");
  assert.equal(await handle({ ...space, type: "group" }, message), "ignored");
  assert.equal(await handle(space, { ...message, direction: "outbound" }), "ignored");
  assert.equal(await handle(space, { ...message, timestamp: new Date(now - 1) }), "old_or_invalid_message");
});

test("uncertain demo sends are not automatically repeated", async () => {
  const now = Date.now();
  let calls = 0;
  const handle = createReplyDemo({ startedAt: now });
  const space = { id: "chat", type: "dm", async send() { calls++; throw new Error("timeout"); } };
  const message = { id: "message", direction: "inbound", sender: { id: "me" }, timestamp: new Date(now), content: { type: "text", text: "Hello" } };
  assert.equal(await handle(space, message), "send_uncertain");
  assert.equal(await handle(space, message), "duplicate");
  assert.equal(calls, 1);
});

test("Photon-delivered users need no additional local registration", async () => {
  const now = Date.now();
  const handle = createReplyDemo({ startedAt: now });
  let calls = 0;
  const space = { id: "chat", type: "dm", async send() { calls++; } };
  for (const sender of ["photon-user-one", "photon-user-two"]) {
    assert.equal(await handle(space, { id: sender, direction: "inbound", sender: { id: sender },
      timestamp: new Date(now), content: { type: "text", text: "Hi" } }), "reply_sent");
  }
  assert.equal(calls, 2);
});

test("marks an incoming text read before Gemini generation and sending, once per message", async () => {
  const now = Date.now();
  const order: string[] = [];
  const handle = createReplyDemo({ startedAt: now, async respond() { order.push("generate"); return "Hello"; } });
  const space = { id: "dm", type: "dm", async send() { order.push("send"); } };
  const message = { id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now),
    content: { type: "text", text: "Hi" }, async read() { order.push("read"); } };
  assert.equal(await handle(space, message), "reply_sent");
  assert.equal(await handle(space, message), "duplicate");
  assert.deepEqual(order, ["read", "generate", "send"]);
  assert.equal(await handle(space, { ...message, id: "echo", direction: "outbound" }), "ignored");
  assert.deepEqual(order, ["read", "generate", "send"]);
});

test("a read receipt failure does not prevent the answer", async () => {
  const now = Date.now();
  let failed = false;
  let sent = false;
  const handle = createReplyDemo({ startedAt: now, onReadFailure() { failed = true; } });
  const result = await handle({ id: "dm", type: "dm", async send() { sent = true; } }, {
    id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now),
    content: { type: "text", text: "Hi" }, async read() { throw new Error("provider unavailable"); },
  });
  assert.equal(result, "reply_sent");
  assert.equal(failed, true);
  assert.equal(sent, true);
});

test("typing is active during Gemini generation and clears after the reply, without duplicate indicators", async () => {
  const now = Date.now();
  const order: string[] = [];
  const handle = createReplyDemo({ startedAt: now, async respond() { order.push("generate"); return "Hi"; } });
  const space = { id: "dm", type: "dm", async send() { order.push("send"); },
    async startTyping() { order.push("typing-start"); }, async stopTyping() { order.push("typing-stop"); } };
  const message = { id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now),
    content: { type: "text", text: "Hi" }, async read() { order.push("read"); } };
  assert.equal(await handle(space, message), "reply_sent");
  assert.equal(await handle(space, message), "duplicate");
  assert.equal(await handle(space, { ...message, id: "echo", direction: "outbound" }), "ignored");
  assert.deepEqual(order, ["read", "typing-start", "generate", "send", "typing-stop"]);
});

test("typing clears after Gemini failure and an uncertain send", async () => {
  const now = Date.now();
  for (const sendFails of [false, true]) {
    let cleared = false;
    const handle = createReplyDemo({ startedAt: now, async respond() { throw new Error("model unavailable"); } });
    const result = await handle({ id: "dm", type: "dm", async startTyping() {}, async stopTyping() { cleared = true; },
      async send(text) { assert.match(text, /trouble responding/); if (sendFails) throw new Error("timeout"); } }, {
      id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now), content: { type: "text", text: "Hi" },
    });
    assert.equal(result, sendFails ? "send_uncertain" : "generation_failed");
    assert.equal(cleared, true);
  }
});

test("typing API failures do not prevent Gemini replies", async () => {
  const now = Date.now();
  let sent = false;
  let failures = 0;
  const handle = createReplyDemo({ startedAt: now, async respond() { return "Hi"; }, onTypingFailure() { failures++; } });
  assert.equal(await handle({ id: "dm", type: "dm", async send() { sent = true; },
    async startTyping() { throw new Error("unavailable"); }, async stopTyping() { throw new Error("unavailable"); } }, {
    id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now), content: { type: "text", text: "Hi" },
  }), "reply_sent");
  assert.equal(sent, true);
  assert.equal(failures, 2);
});
