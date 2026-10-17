import assert from "node:assert/strict";
import test from "node:test";
import type { Content, Model } from "@google/genai";
import { createGeminiChatResponder, selectChatModel } from "../../lib/ai/chat-reply";
import { createReplyDemo } from "../../lib/photon/reply-demo";

test("Gemini replies include bounded conversation context and isolate conversations", async () => {
  const inputs: Content[][] = [];
  const respond = createGeminiChatResponder({ models: { async generateContent(input) {
    assert.equal(input.config?.tools, undefined);
    assert.match(String(input.config?.systemInstruction), /no project database/);
    inputs.push(input.contents as Content[]);
    return { text: "Hello from Gemini" };
  } } }, "test-model");
  assert.equal(await respond("conversation-a", "My name is Maya"), "Hello from Gemini");
  await respond("conversation-a", "What is my name?");
  assert.equal(inputs[1].length, 3);
  assert.equal(inputs[1][0].parts?.[0].text, "My name is Maya");
  await respond("conversation-b", "Hi");
  assert.equal(inputs[2].length, 1);
});

test("model selection uses returned text-capable Flash models, preferring stable versions", async () => {
  async function* models(): AsyncIterable<Model> {
    yield { name: "models/gemini-88-flash-image", supportedActions: ["generateContent"] };
    yield { name: "models/gemini-77-flash-preview", supportedActions: ["generateContent"] };
    yield { name: "models/gemini-4-flash", supportedActions: ["generateContent"] };
    yield { name: "models/gemini-3-flash", supportedActions: ["generateContent"] };
    yield { name: "models/gemini-99-flash", supportedActions: ["embedContent"] };
  }
  assert.equal(await selectChatModel(models()), "gemini-4-flash");
});

test("Gemini-generated text is sent back once to the originating conversation", async () => {
  const now = Date.now();
  const sent: string[] = [];
  let modelCalls = 0;
  const handle = createReplyDemo({ startedAt: now, async respond(key, text) {
    modelCalls++;
    assert.equal(key, JSON.stringify(["dm", "sender"]));
    assert.equal(text, "What's 2 + 2?");
    return "2 + 2 is 4.";
  } });
  const space = { id: "dm", type: "dm", async send(text: string) { sent.push(text); } };
  const message = { id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now), content: { type: "text", text: "What's 2 + 2?" } };
  assert.equal(await handle(space, message), "reply_sent");
  assert.equal(await handle(space, message), "duplicate");
  assert.deepEqual(sent, ["2 + 2 is 4."]);
  assert.equal(modelCalls, 1);
});

test("model failure sends a truthful unavailable notice without leaking the error", async () => {
  const now = Date.now();
  const handle = createReplyDemo({ startedAt: now, async respond() { throw new Error("SECRET provider diagnostic"); } });
  const sent: string[] = [];
  assert.equal(await handle({ id: "dm", type: "dm", async send(text) { sent.push(text); } }, {
    id: "m", direction: "inbound", sender: { id: "sender" }, timestamp: new Date(now), content: { type: "text", text: "Hi" },
  }), "generation_failed");
  assert.equal(sent.length, 1);
  assert.ok(!sent[0].includes("SECRET"));
  assert.match(sent[0], /trouble responding/);
});
