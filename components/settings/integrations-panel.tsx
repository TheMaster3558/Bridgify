"use client";

import { useCallback, useRef, useState } from "react";
import type { IntegrationHealth } from "@/lib/settings/health";
import {
  SettingsGroup,
  SettingsRow,
  SettingsValue,
  StatusPill,
  settingsButton,
} from "@/components/settings/settings-ui";

export type HealthState =
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

export function useIntegrationHealth() {
  const [state, setState] = useState<HealthState>({ kind: "loading" });
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/v1/integrations/health", {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (id !== request.current) return;
      if (response.status === 401 || response.status === 403) {
        setState({
          kind: "denied",
          message:
            body.error?.message ||
            "You do not have access to integration settings.",
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
    } catch {
      if (id !== request.current) return;
      setState({
        kind: "error",
        message: "Integration health is unavailable.",
      });
    }
  }, []);

  return { state, setState, load };
}

type Health = ReturnType<typeof useIntegrationHealth>;

function HealthFallback({ state, load }: Pick<Health, "state" | "load">) {
  if (state.kind === "loading") {
    return (
      <SettingsGroup>
        <SettingsRow
          title="Loading integration health…"
          description="Reading status from the server."
        />
      </SettingsGroup>
    );
  }
  if (state.kind === "denied") {
    return (
      <SettingsGroup>
        <SettingsRow
          title="You do not have access"
          description={state.message}
        />
      </SettingsGroup>
    );
  }
  return (
    <SettingsGroup>
      <SettingsRow
        title="Integration health unavailable"
        description={
          <span role="alert" className="text-crit">
            {state.kind === "error" ? state.message : ""}
          </span>
        }
      >
        <button
          type="button"
          className={settingsButton}
          onClick={() => void load()}
        >
          Retry
        </button>
      </SettingsRow>
    </SettingsGroup>
  );
}

export function PhotonSettings({
  timezone,
  health: { state, setState, load },
}: {
  timezone: string;
  health: Health;
}) {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const zone = timezone || "UTC";

  async function checkConnection() {
    setChecking(true);
    setNotice("");
    try {
      const response = await fetch("/api/v1/integrations/photon/check", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message || "Connection check failed.");
      setState({ kind: "ready", health: body.data as IntegrationHealth });
      setNotice(
        "Connection check finished. Reachable does not mean a message was delivered.",
      );
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
      setState({
        kind: "ready",
        health: body.data.health as IntegrationHealth,
      });
      setNotice(body.data.message);
    } catch (cause) {
      setNotice((cause as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (state.kind !== "ready")
    return <HealthFallback state={state} load={load} />;

  const { photon, refreshedAt } = state.health;
  const testBlocked =
    !photon.testDestinationConfigured ||
    !photon.configured ||
    photon.lastTest === "unknown" ||
    photon.lastTest === "sending" ||
    sending;
  const testHint =
    photon.lastTest === "unknown"
      ? "The last test is unknown. Inspect provider records before sending again."
      : photon.lastTest === "sending"
        ? "A test is already in progress."
        : photon.testDestinationConfigured
          ? "The test goes only to the server-configured destination."
          : "Set PHOTON_TEST_CHAT_GUID on the server. This page cannot choose a destination.";

  return (
    <>
      <SettingsGroup>
        <SettingsRow
          title="Photon · iMessage"
          description="Bridgify sends and receives iMessages through Photon."
        >
          <StatusPill
            label={photon.configured ? "Configured" : "Unconfigured"}
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup label="Connection">
        <SettingsRow
          title="Connection"
          description={`Checked ${formatWhen(photon.checkedAt, zone)}. Reachable means the API answered, not that a client message was delivered.`}
        >
          <StatusPill label={photon.connectionLabel} />
          <button
            type="button"
            className={settingsButton}
            disabled={checking}
            onClick={checkConnection}
          >
            {checking ? "Checking…" : "Check connection"}
          </button>
        </SettingsRow>
        <SettingsRow
          title="Webhook"
          description={`Last inbound ${formatWhen(photon.lastInboundAt, zone)}`}
        >
          <StatusPill label={photon.webhookLabel} />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup label="Identity">
        <SettingsRow title="Instance" description="Photon instance ID">
          <SettingsValue>
            {photon.maskedInstanceId || "Not configured"}
          </SettingsValue>
        </SettingsRow>
        <SettingsRow
          title="Bot identity"
          description="The account that sends messages"
        >
          <SettingsValue>
            {photon.maskedBotIdentity || "Not configured"}
          </SettingsValue>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup label="Test message">
        <SettingsRow
          title="Test destination"
          description="Set on the server only"
        >
          <SettingsValue>
            {photon.maskedTestDestination || "Not configured"}
          </SettingsValue>
        </SettingsRow>
        <SettingsRow
          title="Last test"
          description={<span id="test-hint">{testHint}</span>}
        >
          <StatusPill label={photon.lastTestLabel} />
          <button
            type="button"
            className={settingsButton}
            disabled={testBlocked}
            aria-describedby="test-hint"
            onClick={sendTest}
          >
            {sending ? "Sending…" : "Send test message"}
          </button>
        </SettingsRow>
        <SettingsRow
          title="Delivery"
          description="Outbound messages awaiting confirmation"
        >
          <span className="text-sm text-foreground">
            {photon.deliveryUnknown} unknown · {photon.deliveryPending} pending
          </span>
        </SettingsRow>
      </SettingsGroup>
      {notice ? (
        <p role="status" className="px-3.5 text-sm">
          {notice}
        </p>
      ) : null}
      <p className="px-3.5 text-xs text-neutral-500 dark:text-neutral-400">
        Last refreshed {formatWhen(refreshedAt, zone)}
      </p>
    </>
  );
}

export function GeminiSettings({
  timezone,
  health: { state, load },
}: {
  timezone: string;
  health: Health;
}) {
  if (state.kind !== "ready")
    return <HealthFallback state={state} load={load} />;
  const { gemini } = state.health;

  return (
    <>
      <SettingsGroup>
        <SettingsRow
          title="Status"
          description={`Checked ${formatWhen(gemini.checkedAt, timezone || "UTC")}`}
        >
          <StatusPill label={gemini.statusLabel} />
        </SettingsRow>
        <SettingsRow title="Model" description="The Gemini model Bridgify uses">
          <SettingsValue>{gemini.model || "Not pinned"}</SettingsValue>
        </SettingsRow>
      </SettingsGroup>
      <p className="px-3.5 text-xs text-neutral-500 dark:text-neutral-400">
        Provider keys stay in server environment variables and are never shown
        or accepted here.
      </p>
    </>
  );
}

export function ComingLaterSettings() {
  return (
    <SettingsGroup label="Not part of this release">
      <SettingsRow
        title="Notification preferences"
        description="Choose which updates reach you and how."
      >
        <StatusPill label="Later" />
      </SettingsRow>
      <SettingsRow
        title="Teammate roles"
        description="Invite teammates and control what they can do."
      >
        <StatusPill label="Later" />
      </SettingsRow>
      <SettingsRow
        title="Owner-only iMessage alerts"
        description="Get private alerts without messaging the client chat."
      >
        <StatusPill label="Later" />
      </SettingsRow>
    </SettingsGroup>
  );
}
