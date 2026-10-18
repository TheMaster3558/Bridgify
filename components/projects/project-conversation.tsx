"use client";
import Link from "next/link";
import { OwnerMessageComposer } from "./owner-message-composer";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  ProjectChatHistory,
  ProjectChatMessage,
} from "@/lib/photon/history-contract";

function ordered(messages: ProjectChatMessage[]) {
  return [
    ...new Map(messages.map((message) => [message.id, message])).values(),
  ].sort(
    (a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id),
  );
}
function formatTime(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
export function ProjectConversation({ projectId }: { projectId: string }) {
  const [history, setHistory] = useState<ProjectChatHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pending = useRef(false),
    loadedOlder = useRef(false),
    request = useRef<AbortController | null>(null),
    lastConnection = useRef<string | null>(null);
  const load = useCallback(
    async (cursor?: string, reset = false) => {
      if (pending.current) return;
      pending.current = true;
      const controller = new AbortController();
      request.current = controller;
      if (cursor) setLoadingOlder(true);
      else setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/projects/${projectId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (
            response.status === 401 ||
            response.status === 403 ||
            response.status === 404
          )
            setHistory(null);
          throw new Error(
            result.error?.message ||
              "Conversation could not be loaded. Try Refresh.",
          );
        }
        if (controller.signal.aborted) return;
        const next = result.data as ProjectChatHistory;
        const changed = lastConnection.current !== next.connectionKey;
        if (changed || reset) loadedOlder.current = false;
        lastConnection.current = next.connectionKey;
        if (cursor) loadedOlder.current = true;
        const keepCursor = !cursor && loadedOlder.current;
        setHistory((previous) => {
          if (!previous || changed || reset)
            return { ...next, messages: ordered(next.messages) };
          return {
            ...next,
            messages: ordered([...previous.messages, ...next.messages]),
            nextCursor: keepCursor ? previous.nextCursor : next.nextCursor,
          };
        });
        setError("");
      } catch (caught) {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "Conversation could not be loaded.",
          );
      } finally {
        if (!controller.signal.aborted) {
          pending.current = false;
          setLoading(false);
          setLoadingOlder(false);
        }
      }
    },
    [projectId],
  );
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      request.current?.abort();
      pending.current = false;
    };
  }, [load]);
  const setup = `/app/projects/${projectId}/setup?step=3`;
  const dayLabel = (value: string, timezone: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(new Date(value));
    } catch {
      return value.slice(0, 10);
    }
  };
  const clockTime = (value: string, timezone: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };
  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-4 p-5 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            iMessage conversation
          </h1>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Messages between the connected client and your Photon agent. Use the
            message box below to reply to the client yourself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            href={`/app/projects/${projectId}`}
          >
            Project overview
          </Link>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={loading || loadingOlder}
            onClick={() => void load(undefined, true)}
          >
            Refresh messages
          </Button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-crit-soft px-4 py-3 text-sm text-crit"
        >
          <p>{error}</p>
          {history?.messages.length ? (
            <p className="mt-1">
              Previously loaded messages remain below. The latest messages could
              not be refreshed.
            </p>
          ) : null}
          <Link className="mt-1 inline-block font-medium underline" href={setup}>
            Check client connection
          </Link>
        </div>
      )}
      {history && !history.connected && (
        <section className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-sidebar-border bg-card/60 px-6 py-14 text-center">
          <h2 className="font-semibold">Connect a Photon client first</h2>
          <p className="max-w-[48ch] text-sm text-muted-foreground">
            Choose the project&apos;s client in People & chat. Their existing
            iMessage conversation will appear here after you connect them.
          </p>
          <Link className="mt-1 text-sm font-medium text-primary hover:underline" href={setup}>
            Connect client in People & chat
          </Link>
        </section>
      )}
      {(history?.connected || (loading && !history)) && (
        <section
          aria-label="Conversation"
          className="mx-auto grid w-full max-w-[880px] overflow-hidden rounded-[28px] border border-sidebar-border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar/60 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {history ? `${history.clientName} ↔ Bridgify agent` : "Loading conversation"}
              </p>
              {history?.agentAddress && (
                <p className="text-xs text-muted-foreground">
                  Agent address: {history.agentAddress}
                </p>
              )}
            </div>
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              {loading && !history ? (
                "Loading iMessage history…"
              ) : history?.fetchedAt ? (
                <>
                  <span
                    aria-hidden
                    className="size-2 animate-pulse rounded-full bg-ok motion-reduce:animate-none"
                  />
                  <span>
                    Last updated {formatTime(history.fetchedAt, history.timezone)}{" "}
                    · Updates every 5 seconds while this page is visible.
                  </span>
                </>
              ) : (
                ""
              )}
            </p>
          </div>
          <div className="grid gap-1 px-4 py-5 sm:px-6">
            {history && (
              <p className="mb-3 text-center text-xs text-muted-foreground">
                Times shown in {history.timezone}. Includes existing messages
                available from Photon, including messages before project
                activation.
              </p>
            )}
            {history?.nextCursor && (
              <Button
                className="mb-3 justify-self-center rounded-full"
                variant="outline"
                size="sm"
                disabled={loadingOlder || loading}
                onClick={() => void load(history.nextCursor!)}
              >
                {loadingOlder ? "Loading older messages…" : "Load older messages"}
              </Button>
            )}
            {history && !history.messages.length && !error && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. Once the client texts the Photon agent, their
                messages and the agent&apos;s replies will appear here.
              </p>
            )}
            {history && (
              <ol aria-label="iMessage history" className="grid gap-1">
                {history.messages.map((message, index) => {
                  const previous = history.messages[index - 1];
                  const outbound = message.direction === "outbound";
                  const newDay =
                    !previous ||
                    dayLabel(previous.sentAt, history.timezone) !==
                      dayLabel(message.sentAt, history.timezone);
                  const grouped =
                    !newDay &&
                    previous?.direction === message.direction &&
                    previous?.sender === message.sender;
                  return (
                    <li
                      key={message.id}
                      id={`message-${message.id}`}
                      className="grid gap-1"
                    >
                      {newDay && (
                        <p className="my-3 text-center text-xs font-medium text-muted-foreground">
                          {dayLabel(message.sentAt, history.timezone)}
                        </p>
                      )}
                      <div
                        className={`group/msg grid max-w-[78%] gap-1 ${outbound ? "justify-self-end justify-items-end" : "justify-self-start justify-items-start"} ${grouped ? "" : "mt-2"}`}
                      >
                        {!grouped && (
                          <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                            <strong className="font-medium text-foreground">
                              {message.sender === "agent"
                                ? "Bridgify"
                                : message.sender === "client"
                                  ? history.clientName
                                  : "Unidentified participant"}
                            </strong>
                            <time dateTime={message.sentAt}>
                              {clockTime(message.sentAt, history.timezone)}
                            </time>
                          </p>
                        )}
                        <div
                          className={`rounded-[20px] px-4 py-2.5 ${outbound ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-sidebar-accent text-foreground"}`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {message.deleted
                              ? "Message was deleted in iMessage."
                              : message.text ||
                                (!message.attachments.length
                                  ? "Non-text message"
                                  : "")}
                          </p>
                          {message.attachments.map((attachment, i) => (
                            <p key={i} className="mt-1 text-sm opacity-80">
                              Attachment: {attachment.name} (
                              {attachment.mimeType || "file"})
                            </p>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                          {grouped && (
                            <time dateTime={message.sentAt}>
                              {clockTime(message.sentAt, history.timezone)}
                            </time>
                          )}
                          {message.editedAt && <span>Edited</span>}
                          {message.delivery && (
                            <span className="capitalize">{message.delivery}</span>
                          )}
                          <details className="relative opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100 open:opacity-100">
                            <summary className="cursor-pointer list-none opacity-70 hover:opacity-100">
                              Message reference
                            </summary>
                            <p className="mt-1 max-w-64 break-all">{message.id}</p>
                          </details>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          {history?.connectionKey && (
            <div className="sticky bottom-0 border-t border-sidebar-border bg-card/95 p-4 backdrop-blur">
              <OwnerMessageComposer
                key={history.connectionKey}
                projectId={projectId}
                connectionKey={history.connectionKey}
                clientName={history.clientName || "client"}
                onSent={() => void load()}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
