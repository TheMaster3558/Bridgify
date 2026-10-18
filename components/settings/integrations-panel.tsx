"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntegrationHealth } from "@/lib/settings/health";

type LoadState =
  | { kind: "loading" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; health: IntegrationHealth };

function formatWhen(value: string | null, timeZone: string) {
  if (!value) return "None yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }
}

function tone(label: string) {
  if (["Reachable", "Sent", "Available", "Signature verified", "Configured"].includes(label)) {
    return "bg-ok-soft text-ok";
  }
  if (["Unknown", "Rate-limited", "Sending"].includes(label)) {
    return "bg-warn-soft text-warn";
  }
  if (label === "Unavailable") return "bg-crit-soft text-crit";
  return "bg-secondary text-muted-foreground";
}

function Status({ label }: { label: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tone(label))}>
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-b py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-mono text-xs break-all">{children}</dd>
    </div>
  );
}

export function IntegrationsPanel({
  timezone,
  initialHealth,
  initialError,
}: {
  timezone: string;
  initialHealth: IntegrationHealth | null;
  initialError: string;
}) {
  const [state, setState] = useState<LoadState>(
    initialHealth
      ? { kind: "ready", health: initialHealth }
      : { kind: "error", message: initialError || "Integration health is unavailable." },
  );
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const zone = timezone || "UTC";

  async function load() {
    const response = await fetch("/api/v1/integrations/health", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      setState({
        kind: "denied",
        message: body.error?.message || "You do not have access to integration settings.",
      });
      return;
    }
    if (!response.ok) {
      setState({
        kind: "error",
        message: body.error?.message || "Integration health is unavailable.",
      });
      return;
    }
    setState({ kind: "ready", health: body.data as IntegrationHealth });
  }

  async function checkConnection() {
    setChecking(true);
    setNotice("");
    try {
      const response = await fetch("/api/v1/integrations/photon/check", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Connection check failed.");
      setState({ kind: "ready", health: body.data as IntegrationHealth });
      setNotice("Connection check finished. Reachable does not mean a message was delivered.");
    } catch (cause) {
      const message = (cause as Error).message;
      setNotice(message);
      setState((current) =>
        current.kind === "ready" ? current : { kind: "error", message },
      );
    } finally {
      setChecking(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/v1/integrations/photon/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID().replaceAll("-", ""),
        },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok) {
        await load();
        throw new Error(body.error?.message || "Test message failed.");
      }
      setState({ kind: "ready", health: body.data.health as IntegrationHealth });
      setNotice(body.data.message);
    } catch (cause) {
      setNotice((cause as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-sm" aria-busy="true">
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="mt-3 text-sm text-muted-foreground">Loading integration health…</p>
      </section>
    );
  }
  if (state.kind === "denied") {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">You do not have access</h2>
        <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
      </section>
    );
  }
  if (state.kind === "error") {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Integration health unavailable</h2>
        <p className="mt-3 text-sm text-crit" role="alert">
          {state.message}
        </p>
        <Button
          type="button"
          className="mt-4"
          variant="outline"
          onClick={() => {
            setState({ kind: "loading" });
            void load().catch(() => {
              setState({
                kind: "error",
                message: "Integration health is unavailable.",
              });
            });
          }}
        >
          Retry
        </Button>
      </section>
    );
  }

  const { health } = state;
  const testBlocked =
    !health.photon.testDestinationConfigured ||
    !health.photon.configured ||
    health.photon.lastTest === "unknown" ||
    health.photon.lastTest === "sending" ||
    sending;
  const testHint =
    health.photon.lastTest === "unknown"
      ? "The last test is unknown. Inspect provider records before sending again."
      : health.photon.lastTest === "sending"
        ? "A test is already in progress."
        : health.photon.testDestinationConfigured
          ? "The test goes only to the server-configured destination."
          : "Set PHOTON_TEST_CHAT_GUID on the server. This page cannot choose a destination.";

  return (
    <>
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">Photon · iMessage</h2>
          <Status label={health.photon.configured ? "Configured" : "Unconfigured"} />
        </div>
        <dl className="mt-4">
          <Row label="Instance">{health.photon.maskedInstanceId || "Not configured"}</Row>
          <Row label="Bot identity">{health.photon.maskedBotIdentity || "Not configured"}</Row>
          <Row label="Webhook">
            <Status label={health.photon.webhookLabel} />
          </Row>
          <Row label="Last inbound">
            {formatWhen(health.photon.lastInboundAt, zone)}
          </Row>
          <Row label="Connection">
            <Status label={health.photon.connectionLabel} />
            <span className="mt-1 block font-sans text-muted-foreground">
              Checked {formatWhen(health.photon.checkedAt, zone)}
            </span>
          </Row>
          <Row label="Test destination">
            {health.photon.maskedTestDestination || "Not configured"}
          </Row>
          <Row label="Last test">
            <Status label={health.photon.lastTestLabel} />
          </Row>
          <Row label="Delivery">
            <span className="font-sans">
              {health.photon.deliveryUnknown} unknown · {health.photon.deliveryPending} pending
            </span>
          </Row>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={checking} onClick={checkConnection}>
            {checking ? "Checking…" : "Check connection"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testBlocked}
            aria-describedby="test-hint"
            onClick={sendTest}
          >
            {sending ? "Sending…" : "Send test message"}
          </Button>
        </div>
        <p id="test-hint" className="mt-3 text-xs text-muted-foreground">
          {testHint} Reachable means the API answered. It does not prove a client message was delivered.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Last refreshed {formatWhen(health.refreshedAt, zone)}
        </p>
        {notice ? (
          <p role="status" className="mt-3 text-sm">
            {notice}
          </p>
        ) : null}
      </section>
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">Gemini</h2>
          <Status label={health.gemini.statusLabel} />
        </div>
        <dl className="mt-4">
          <Row label="Model">{health.gemini.model || "Not pinned"}</Row>
          <Row label="Status">
            <Status label={health.gemini.statusLabel} />
            <span className="mt-1 block font-sans text-muted-foreground">
              Checked {formatWhen(health.gemini.checkedAt, zone)}
            </span>
          </Row>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Provider keys stay in server environment variables and are never shown or accepted here.
        </p>
      </section>
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">Coming later</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Later
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Notification preferences, teammate roles, and owner-only iMessage alerts are not part of this release.
        </p>
      </section>
    </>
  );
}
