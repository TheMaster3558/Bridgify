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
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {history?.projectName || "Project"}
          </p>
          <h1 className="font-display text-3xl font-semibold">
            iMessage conversation
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="text-sm underline"
            href={`/app/projects/${projectId}`}
          >
            Project overview
          </Link>
          <Button
            variant="outline"
            disabled={loading || loadingOlder}
            onClick={() => void load(undefined, true)}
          >
            Refresh messages
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Messages between the connected client and your Photon agent. Use the
        message box below to reply to the client yourself.
      </p>
      {error && (
        <div role="alert" className="rounded-lg border border-destructive p-4">
          <p>{error}</p>
          {history?.messages.length ? (
            <p className="mt-2 text-sm">
              Previously loaded messages remain below. The latest messages could
              not be refreshed.
            </p>
          ) : null}
          <Link className="mt-2 inline-block text-sm underline" href={setup}>
            Check client connection
          </Link>
        </div>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {loading && !history
          ? "Loading iMessage history…"
          : history?.fetchedAt
            ? `Last updated ${formatTime(history.fetchedAt, history.timezone)} · Updates every 5 seconds while this page is visible.`
            : ""}
      </p>
      {history && !history.connected && (
        <section className="grid gap-3 rounded-lg border p-6">
          <h2 className="font-semibold">Connect a Photon client first</h2>
          <p>
            Choose the project&apos;s client in People & chat. Their existing
            iMessage conversation will appear here after you connect them.
          </p>
          <Link className="underline" href={setup}>
            Connect client in People & chat
          </Link>
        </section>
      )}
      {history?.connected && (
        <>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-medium">{history.clientName} ↔ Bridgify agent</p>
            {history.agentAddress && (
              <p className="text-sm text-muted-foreground">
                Agent address: {history.agentAddress}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Times shown in {history.timezone}. Includes existing messages
              available from Photon, including messages before project
              activation.
            </p>
          </div>
          {history.nextCursor && (
            <Button
              className="justify-self-center"
              variant="outline"
              disabled={loadingOlder || loading}
              onClick={() => void load(history.nextCursor!)}
            >
              {loadingOlder ? "Loading older messages…" : "Load older messages"}
            </Button>
          )}
          {!history.messages.length && !error && (
            <p className="rounded-lg border p-6">
              No messages yet. Once the client texts the Photon agent, their
              messages and the agent&apos;s replies will appear here.
            </p>
          )}
          <ol aria-label="iMessage history" className="grid gap-4">
            {history.messages.map((message) => (
              <li
                key={message.id}
                id={`message-${message.id}`}
                className={`max-w-[90%] rounded-2xl border p-4 ${message.direction === "outbound" ? "justify-self-end bg-primary text-primary-foreground" : "justify-self-start bg-card"}`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <strong>
                    {message.sender === "agent"
                      ? "Bridgify"
                      : message.sender === "client"
                        ? history.clientName
                        : "Unidentified participant"}
                  </strong>
                  <time dateTime={message.sentAt}>
                    {formatTime(message.sentAt, history.timezone)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words">
                  {message.deleted
                    ? "Message was deleted in iMessage."
                    : message.text ||
                      (!message.attachments.length ? "Non-text message" : "")}
                </p>
                {message.attachments.map((attachment, index) => (
                  <p key={index} className="mt-2 text-sm">
                    Attachment: {attachment.name} (
                    {attachment.mimeType || "file"})
                  </p>
                ))}
                <div className="mt-2 flex gap-3 text-xs opacity-80">
                  {message.editedAt && <span>Edited</span>}
                  {message.delivery && (
                    <span className="capitalize">{message.delivery}</span>
                  )}
                </div>
                <details className="mt-2 text-xs opacity-80">
                  <summary className="cursor-pointer">
                    Message reference
                  </summary>
                  <p className="mt-1 break-all">{message.id}</p>
                </details>
              </li>
            ))}
          </ol>
          {history.connectionKey && (
            <OwnerMessageComposer
              key={history.connectionKey}
              projectId={projectId}
              connectionKey={history.connectionKey}
              clientName={history.clientName || "client"}
              onSent={() => void load()}
            />
          )}
        </>
      )}
    </main>
  );
}
