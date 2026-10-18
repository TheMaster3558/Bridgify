"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OwnerMessageResult } from "@/lib/photon/history-contract";

type Attempt = { key: string; text: string };
export function OwnerMessageComposer({
  projectId,
  connectionKey,
  clientName,
  onSent,
}: {
  projectId: string;
  connectionKey: string;
  clientName: string;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState(false);
  const busy = useRef(false);
  async function send() {
    if (busy.current || (!attempt && !text.trim())) return;
    busy.current = true;
    setSending(true);
    const current = attempt || { key: crypto.randomUUID(), text: text.trim() };
    setAttempt(current);
    setNotice("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": current.key,
        },
        body: JSON.stringify({ text: current.text, connectionKey }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if ([400, 401, 403, 404, 409, 422].includes(response.status))
          setAttempt(null);
        throw new Error(
          payload.error?.message ||
            "Send status could not be confirmed. Check send status before trying a new message.",
        );
      }
      const result = payload.data as OwnerMessageResult;
      if (result.state === "sent") {
        setText("");
        setAttempt(null);
        setProblem(false);
        setNotice(
          "Message sent. It will appear in the conversation when Photon updates history.",
        );
        onSent();
      } else if (result.state === "failed") {
        setAttempt(null);
        setProblem(true);
        setNotice(
          "The message was not sent. Check your Photon connection and try again.",
        );
      } else {
        setProblem(true);
        setNotice(
          "Delivery is unconfirmed. Check the conversation or with the client before composing another message. Checking status will not send it again.",
        );
        onSent();
      }
    } catch (error) {
      setProblem(true);
      setNotice(
        error instanceof Error
          ? error.message
          : "Send status is unknown. Check status before trying a new message.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <section className="grid gap-2" aria-label="Send a message">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="owner-message" className="text-sm font-medium">
          Message {clientName}
        </label>
        <p className="text-xs text-muted-foreground">
          Send directly to the client from the same Photon address as your
          assistant.
        </p>
      </div>
      <Textarea
        id="owner-message"
        placeholder="Sure, will do"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        disabled={sending || !!attempt}
        rows={2}
        className="min-h-16 resize-y rounded-2xl border-sidebar-border bg-background px-4 py-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="rounded-full px-5"
          disabled={sending || (!attempt && !text.trim())}
          onClick={() => void send()}
        >
          {sending
            ? "Sending…"
            : attempt
              ? "Check send status"
              : "Send message"}
        </Button>
        {attempt && !sending && (
          <Button
            variant="outline"
            className="rounded-full"
            type="button"
            onClick={() => {
              setAttempt(null);
              setText("");
              setNotice("");
            }}
          >
            Compose another message
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {text.length}/4,000
        </span>
      </div>
      {notice && (
        <p role={problem ? "alert" : "status"} className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
