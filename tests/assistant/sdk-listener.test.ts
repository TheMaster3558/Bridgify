import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSpectrumSdkMessage,
  runSpectrumSdkListener,
  type SpectrumSdkConnection,
} from "../../lib/photon/sdk-listener";
import type { NormalizedEvent } from "../../lib/assistant/contracts";

const space = { id: "any;-;+12065550002", __platform: "imessage" };
const message = {
  id: "message-1",
  platform: "imessage",
  space,
  sender: { id: "+12065550002" },
  direction: "inbound",
  timestamp: new Date("2026-10-18T08:00:00Z"),
  content: { type: "text", text: "Make the heading green" },
};
const pair = [space, message] as const;
function stream(
  values: Array<readonly [unknown, unknown]>,
  onNext = () => {},
): SpectrumSdkConnection {
  return {
    messages: {
      async *[Symbol.asyncIterator]() {
        for (const value of values) {
          onNext();
          yield value;
        }
      },
    },
    async stop() {},
  };
}

test("SDK normalization uses authenticated instance and original routing, never SDK methods", () => {
  const event = normalizeSpectrumSdkMessage("project-id", space, message)!;
  assert.equal(event.instanceId, "project-id");
  assert.equal(event.chatGuid, space.id);
  assert.equal(event.senderId, message.sender.id);
  assert.equal(event.messageGuid, message.id);
  assert.equal(event.occurredAt, message.timestamp.toISOString());
  assert.equal(event.text, message.content.text);
  assert.match(event.eventKey, /^sdk:/);
  let reads = 0;
  const attachment = normalizeSpectrumSdkMessage("project-id", space, {
    ...message,
    content: {
      type: "attachment",
      name: "brief.pdf",
      read() {
        reads++;
        throw new Error();
      },
    },
  })!;
  assert.equal(reads, 0);
  assert.equal(attachment.contentType, "attachment");
  assert.equal(attachment.text, undefined);
  assert.equal(JSON.stringify(attachment).includes("brief.pdf"), false);
});

test("SDK rejects conflicting routes and invalid identity; missing time stays missing", () => {
  assert.throws(
    () =>
      normalizeSpectrumSdkMessage("p", space, {
        ...message,
        space: { ...space, id: "other-chat" },
      }),
    /conflicting_sdk_chat/,
  );
  for (const change of [
    { id: "" },
    { platform: "telegram" },
    { direction: undefined },
    { timestamp: new Date(NaN) },
  ])
    assert.throws(() =>
      normalizeSpectrumSdkMessage("p", space, { ...message, ...change }),
    );
  assert.equal(
    normalizeSpectrumSdkMessage("p", space, {
      ...message,
      timestamp: undefined,
    })!.occurredAt,
    undefined,
  );
  assert.equal(
    normalizeSpectrumSdkMessage("p", space, { ...message, sender: undefined })!
      .senderId,
    "unknown",
  );
  const echo = normalizeSpectrumSdkMessage("p", space, {
    ...message,
    direction: "outbound",
    sender: { id: "agent", kind: "agent" },
  })!;
  assert.equal(echo.fromBot, true);
  assert.equal(echo.direction, "outbound");
});

test("read/typing/reaction events stay silent; mutations retain their original target", () => {
  for (const type of ["read", "typing", "reaction"])
    assert.equal(
      normalizeSpectrumSdkMessage("p", space, {
        ...message,
        content: { type },
      }),
      null,
    );
  const edit = normalizeSpectrumSdkMessage("p", space, {
    ...message,
    content: { type: "edit", target: { id: "original-id", space } },
  })!;
  assert.equal(edit.kind, "edit");
  assert.equal(edit.messageGuid, "original-id");
  assert.equal(edit.text, undefined);
  assert.throws(
    () =>
      normalizeSpectrumSdkMessage("p", space, {
        ...message,
        content: {
          type: "edit",
          target: { id: "other", space: { ...space, id: "other-chat" } },
        },
      }),
    /conflicting_sdk_target/,
  );
});

test(
  "listener starts the live stream before catch-up and retries the same DB write before advancing",
  { timeout: 2000 },
  async () => {
    const stopping = new AbortController();
    const order: string[] = [];
    let attempts = 0,
      nextCalls = 0;
    const saved: NormalizedEvent[] = [];
    await runSpectrumSdkListener({
      instanceId: "p",
      signal: stopping.signal,
      retryMs: 1,
      connect: async () =>
        stream([pair, [space, { ...message, id: "message-2" }]], () => {
          nextCalls++;
          order.push("next");
        }),
      async catchUp() {
        order.push("catchup");
      },
      inbox: {
        async persistVerifiedEvent(event) {
          attempts++;
          assert.equal(nextCalls, 1);
          if (attempts === 1) throw new Error("database_down");
          saved.push(event);
          stopping.abort();
          return { inboxEventId: "event-id", duplicate: false };
        },
      },
      onCommitted() {
        order.push("wake");
      },
      notice() {},
    });
    assert.deepEqual(order.slice(0, 2), ["next", "catchup"]);
    assert.equal(attempts, 2);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].messageGuid, "message-1");
  },
);

test(
  "listener reconnects after a connection failure or ended stream and catches up again",
  { timeout: 2000 },
  async () => {
    const stopping = new AbortController();
    let connections = 0,
      catches = 0,
      writes = 0;
    await runSpectrumSdkListener({
      instanceId: "p",
      signal: stopping.signal,
      retryMs: 1,
      async connect() {
        connections++;
        if (connections === 1) throw new Error("offline");
        return stream(connections === 2 ? [] : [pair]);
      },
      async catchUp() {
        catches++;
      },
      inbox: {
        async persistVerifiedEvent() {
          writes++;
          stopping.abort();
          return { inboxEventId: "e", duplicate: false };
        },
      },
      onCommitted() {},
      notice() {},
    });
    assert.equal(connections, 3);
    assert.equal(catches, 2);
    assert.equal(writes, 1);
  },
);

test(
  "aborting an idle listener closes its stream and does not await another message",
  { timeout: 2000 },
  async () => {
    const stopping = new AbortController();
    let stopped = false;
    await runSpectrumSdkListener({
      instanceId: "p",
      signal: stopping.signal,
      async connect() {
        return {
          messages: {
            [Symbol.asyncIterator]() {
              return { next: () => new Promise(() => {}) };
            },
          },
          async stop() {
            stopped = true;
          },
        };
      },
      async catchUp() {
        setImmediate(() => stopping.abort());
      },
      inbox: {
        async persistVerifiedEvent() {
          assert.fail("no event was received");
        },
      },
      onCommitted() {},
      notice() {},
    });
    assert.equal(stopped, true);
  },
);

test(
  "a rejected SDK payload cannot reach persistence and does not block the next valid event",
  { timeout: 2000 },
  async () => {
    const stopping = new AbortController();
    let writes = 0;
    await runSpectrumSdkListener({
      instanceId: "p",
      signal: stopping.signal,
      connect: async () =>
        stream([
          [space, { ...message, space: { ...space, id: "other" } }],
          pair,
        ]),
      async catchUp() {},
      inbox: {
        async persistVerifiedEvent() {
          writes++;
          stopping.abort();
          return { inboxEventId: "e", duplicate: false };
        },
      },
      onCommitted() {},
      notice() {},
    });
    assert.equal(writes, 1);
  },
);
