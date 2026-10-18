import "server-only";
import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { Spectrum } from "@spectrum-ts/core";
import { imessage } from "@spectrum-ts/imessage";
import { z } from "zod";
import type { InboxWriter } from "../assistant/intake";
import {
  normalizedEventSchema,
  type NormalizedEvent,
} from "../assistant/contracts";
import { readSpectrumCredentials } from "./spectrum";

const id = z.string().min(1).max(256);
const spaceSchema = z.object({ id, __platform: z.literal("imessage") });
const messageSchema = z.object({
  id,
  platform: z.literal("imessage"),
  space: spaceSchema,
  direction: z.enum(["inbound", "outbound"]),
  sender: z.object({ id, kind: z.string().optional() }).optional(),
  timestamp: z.date().optional(),
  content: z.object({ type: z.string().min(1).max(100) }).passthrough(),
});

// Only authenticated SDK objects reach this adapter. Never expose it as an
// unsigned HTTP alternative to the signed webhook route. Do not serialize SDK
// objects: attachments and target messages contain methods/lazy binary data.
export function normalizeSpectrumSdkMessage(
  instanceId: string,
  rawSpace: unknown,
  rawMessage: unknown,
): NormalizedEvent | null {
  const space = spaceSchema.parse(rawSpace);
  const message = messageSchema.parse(rawMessage);
  if (space.id !== message.space.id) throw new Error("conflicting_sdk_chat");
  const content = message.content;
  if (["typing", "read", "reaction"].includes(content.type)) return null;
  const membership = ["addMember", "removeMember", "leaveSpace"].includes(
    content.type,
  );
  let kind: NormalizedEvent["kind"] = membership ? "membership" : "message";
  let messageGuid = message.id;
  if (["edit", "unsend", "delete"].includes(content.type)) {
    const target = z.object({ id, space: spaceSchema }).parse(content.target);
    if (target.space.id !== space.id) throw new Error("conflicting_sdk_target");
    messageGuid = target.id;
    kind = content.type === "edit" ? "edit" : "delete";
  }
  const text =
    content.type === "text"
      ? z.string().max(30_000).parse(content.text)
      : undefined;
  return normalizedEventSchema.parse({
    instanceId,
    // Separate provenance from spectrum: signed webhooks. Shared message GUIDs
    // still deduplicate SDK, webhook and authenticated history at the DB layer.
    eventKey: `sdk:${createHash("sha256")
      .update(JSON.stringify([space.id, message.id, kind]))
      .digest("hex")}`,
    kind,
    chatGuid: space.id,
    senderId: message.sender?.id ?? "unknown",
    messageGuid,
    ...(message.timestamp
      ? { occurredAt: message.timestamp.toISOString() }
      : {}),
    ...(text !== undefined ? { text } : {}),
    fromBot: message.sender?.kind === "agent",
    direction: message.direction,
    contentType: content.type,
  });
}

export type SpectrumSdkConnection = {
  messages: AsyncIterable<readonly [unknown, unknown]>;
  stop(): Promise<void>;
};

export async function connectSpectrumSdk(): Promise<SpectrumSdkConnection> {
  return Spectrum({
    ...readSpectrumCredentials(),
    providers: [imessage.config()],
    options: { logLevel: "error" },
    telemetry: false,
  });
}

type ListenerOptions = {
  instanceId: string;
  inbox: InboxWriter;
  signal: AbortSignal;
  catchUp(signal: AbortSignal): Promise<unknown>;
  onCommitted(): void;
  notice(message: string): void;
  connect?: () => Promise<SpectrumSdkConnection>;
  retryMs?: number;
};

async function pause(ms: number, signal: AbortSignal) {
  try {
    await sleep(ms, undefined, { signal });
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}

// Remove each abort subscription when an event arrives. Repeatedly racing
// against one never-resolved abort promise retains every prior event handler.
function untilAborted<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      resolve(undefined);
    };
    signal.addEventListener("abort", abort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}

// SDK handles its own resumable stream reconnects. If the overall stream ends
// or a connection fails, reopen it and recover history again. A DB failure holds
// the current event and retries persistence before advancing the iterator.
export async function runSpectrumSdkListener(options: ListenerOptions) {
  const { signal } = options;
  const retryMs = options.retryMs ?? 5000;
  while (!signal.aborted) {
    let connection: SpectrumSdkConnection | undefined;
    let iterator: AsyncIterator<readonly [unknown, unknown]> | undefined;
    const close = () => {
      void connection?.stop().catch(() => undefined);
    };
    signal.addEventListener("abort", close, { once: true });
    try {
      let accepting = true;
      let connectTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        const opening = (options.connect ?? connectSpectrumSdk)().then(
          (app) => {
            if (!accepting || signal.aborted) {
              void app.stop().catch(() => undefined);
              throw new Error("sdk_connection_abandoned");
            }
            return app;
          },
        );
        connection = await untilAborted(
          Promise.race([
            opening,
            new Promise<never>((_, reject) => {
              connectTimer = setTimeout(
                () => reject(new Error("sdk_connect_timeout")),
                20_000,
              );
            }),
          ]),
          signal,
        );
      } finally {
        accepting = false;
        if (connectTimer) clearTimeout(connectTimer);
      }
      if (signal.aborted) break;
      if (!connection) throw new Error("sdk_connection_unavailable");
      iterator = connection.messages[Symbol.asyncIterator]();
      // Begin the live subscription before history catch-up. The outstanding
      // next() is handled immediately, even if it rejects during catch-up.
      const next = () =>
        iterator!.next().then(
          (value) => ({ value }),
          () => ({ failed: true as const }),
        );
      let pending = next();
      // Catch-up uses bounded provider calls. Abort can still stop the listener
      // promptly if the operator quits during a large history import.
      await untilAborted(options.catchUp(signal), signal);
      if (signal.aborted) break;
      options.onCommitted();
      options.notice(
        "Photon SDK listener connected; startup catch-up finished.",
      );
      while (!signal.aborted) {
        const result = await untilAborted(pending, signal);
        if (!result) break;
        if ("failed" in result || result.value.done)
          throw new Error("sdk_stream_ended");
        const [space, message] = result.value.value;
        let event: NormalizedEvent | null;
        try {
          event = normalizeSpectrumSdkMessage(
            options.instanceId,
            space,
            message,
          );
        } catch {
          options.notice(
            "Unsupported Photon SDK event ignored; no work or reply authorized.",
          );
          pending = next();
          continue;
        }
        if (event) {
          while (!signal.aborted) {
            try {
              await options.inbox.persistVerifiedEvent(event);
              options.onCommitted();
              break;
            } catch (error) {
              // Identity conflicts are not a transient database outage. Leave
              // the original durable record intact and continue other events.
              if (
                error instanceof Error &&
                error.message === "provider_event_identity_conflict"
              ) {
                options.notice(
                  "Photon SDK event identity conflict; original record retained.",
                );
                break;
              }
              options.notice(
                "SDK event could not be saved; retrying before reading another event.",
              );
              await pause(retryMs, signal);
            }
          }
        }
        if (!signal.aborted) pending = next();
      }
    } catch {
      if (!signal.aborted)
        options.notice(
          "Photon SDK connection or catch-up unavailable; reconnecting shortly.",
        );
    } finally {
      signal.removeEventListener("abort", close);
      // Provider shutdown closes the pending stream. Bound cleanup so Ctrl-C
      // still terminates if a broken transport never resolves its iterator.
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.allSettled([connection?.stop(), iterator?.return?.()]),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 5000);
        }),
      ]);
      if (timer) clearTimeout(timer);
    }
    if (!signal.aborted) await pause(retryMs, signal);
  }
}
