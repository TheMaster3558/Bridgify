export const SETTINGS_TEST_TEXT =
  "Bridgify settings test. The server reached the configured test destination. This does not confirm that a client received a message.";

export type ConnectionState =
  | "reachable"
  | "unknown"
  | "unavailable"
  | "unconfigured";
export type GeminiState =
  | "available"
  | "rate_limited"
  | "unavailable"
  | "unknown"
  | "unconfigured";
export type TestState = "none" | "sending" | "sent" | "unknown" | "unavailable";
export type WebhookState = "verified" | "configured" | "unconfigured";

export type IntegrationHealth = {
  refreshedAt: string;
  photon: {
    configured: boolean;
    connection: ConnectionState;
    connectionLabel: string;
    checkedAt: string | null;
    maskedInstanceId: string | null;
    maskedBotIdentity: string | null;
    webhook: WebhookState;
    webhookLabel: string;
    lastInboundAt: string | null;
    testDestinationConfigured: boolean;
    maskedTestDestination: string | null;
    lastTest: TestState;
    lastTestLabel: string;
    lastTestAt: string | null;
    deliveryUnknown: number;
    deliveryPending: number;
  };
  gemini: {
    configured: boolean;
    status: GeminiState;
    statusLabel: string;
    checkedAt: string | null;
    model: string | null;
  };
};

type Environment = Record<string, string | undefined>;

export function maskIdentifier(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 6) return "••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}

export function photonConfigured(env: Environment) {
  return Boolean(
    env.PHOTON_HTTP_ADDRESS?.trim() &&
    env.PHOTON_TOKEN?.trim() &&
    env.PHOTON_INSTANCE_ID?.trim() &&
    env.PHOTON_BOT_SENDER_ID?.trim(),
  );
}

export function geminiConfigured(env: Environment) {
  return Boolean(env.GEMINI_API_KEY?.trim());
}

export function webhookConfigured(env: Environment) {
  return (
    env.PHOTON_WEBHOOK_MODE === "normalized-gateway-v1" &&
    (env.PHOTON_GATEWAY_SECRET?.length ?? 0) >= 32
  );
}

export function configuredTestChat(env: Environment) {
  const chat = env.PHOTON_TEST_CHAT_GUID?.trim();
  return chat || null;
}

export function settingsTestInput(env: Environment, dedupeKey: string) {
  const chatGuid = configuredTestChat(env);
  if (!chatGuid) return null;
  return { chatGuid, text: SETTINGS_TEST_TEXT, dedupeKey };
}

export function classifyGeminiFailure(input: {
  status?: number;
  message?: string;
}): Exclude<GeminiState, "available" | "unconfigured"> {
  const message = input.message || "";
  if (
    input.status === 429 ||
    /RESOURCE_EXHAUSTED|rate limit/i.test(message)
  ) {
    return "rate_limited";
  }
  if (
    input.status === 401 ||
    input.status === 403 ||
    input.status === 400 ||
    (input.status !== undefined && input.status >= 500)
  ) {
    return "unavailable";
  }
  if (/timeout|aborted|network|fetch failed|ECONN/i.test(message)) {
    return "unknown";
  }
  return "unknown";
}

export function classifyPhotonFailure(kind: "rejected" | "uncertain") {
  return kind === "rejected" ? "unavailable" : "unknown";
}

export const SETTINGS_TEST_RECEIPT_KEY = "bridgify-settings-test";

export type SettingsTestRecord = {
  state: Exclude<TestState, "none">;
  checkedAt: string;
  requestKey: string;
};

export function decideSettingsTest(
  current: SettingsTestRecord | null,
  requestKey: string,
  now: number,
):
  | { action: "send" }
  | { action: "replay"; state: SettingsTestRecord["state"] }
  | { action: "expire"; message: string }
  | { action: "reject"; message: string } {
  if (!current) return { action: "send" };
  if (current.requestKey === requestKey) {
    return { action: "replay", state: current.state };
  }
  if (current.state === "sent" || current.state === "unavailable") {
    return { action: "send" };
  }
  if (current.state === "sending") {
    const checkedAt = new Date(current.checkedAt).getTime();
    if (!Number.isNaN(checkedAt) && now - checkedAt > 120_000) {
      return {
        action: "expire",
        message:
          "The previous test delivery is unknown. Inspect provider records before sending again.",
      };
    }
  }
  return {
    action: "reject",
    message:
      "Test delivery is pending or unknown. Inspect provider records before sending again.",
  };
}

const connectionLabels: Record<ConnectionState, string> = {
  reachable: "Reachable",
  unknown: "Unknown",
  unavailable: "Unavailable",
  unconfigured: "Unconfigured",
};
const geminiLabels: Record<GeminiState, string> = {
  available: "Available",
  rate_limited: "Rate-limited",
  unavailable: "Unavailable",
  unknown: "Unknown",
  unconfigured: "Unconfigured",
};
const testLabels: Record<TestState, string> = {
  none: "Not sent",
  sending: "Sending",
  sent: "Sent",
  unknown: "Unknown",
  unavailable: "Unavailable",
};
const webhookLabels: Record<WebhookState, string> = {
  verified: "Signature verified",
  configured: "Configured",
  unconfigured: "Not configured",
};

export function buildIntegrationHealth(input: {
  now: string;
  env: Environment;
  lastInboundAt: string | null;
  webhookVerified: boolean;
  deliveryUnknown: number;
  deliveryPending: number;
  photonConnection: "unknown" | "reachable" | "unavailable";
  photonCheckedAt: string | null;
  geminiStatus: "unknown" | "available" | "rate_limited" | "unavailable";
  geminiCheckedAt: string | null;
  testState: TestState;
  testCheckedAt: string | null;
}): IntegrationHealth {
  const photonReady = photonConfigured(input.env);
  const geminiReady = geminiConfigured(input.env);
  const connection: ConnectionState = photonReady
    ? input.photonConnection
    : "unconfigured";
  const geminiStatus: GeminiState = geminiReady
    ? input.geminiStatus
    : "unconfigured";
  const webhook: WebhookState = input.webhookVerified
    ? "verified"
    : webhookConfigured(input.env)
      ? "configured"
      : "unconfigured";
  const model = input.env.GEMINI_MODEL?.trim() || null;
  return {
    refreshedAt: input.now,
    photon: {
      configured: photonReady,
      connection,
      connectionLabel: connectionLabels[connection],
      checkedAt: photonReady ? input.photonCheckedAt : null,
      maskedInstanceId: maskIdentifier(input.env.PHOTON_INSTANCE_ID),
      maskedBotIdentity: maskIdentifier(input.env.PHOTON_BOT_SENDER_ID),
      webhook,
      webhookLabel: webhookLabels[webhook],
      lastInboundAt: input.lastInboundAt,
      testDestinationConfigured: Boolean(configuredTestChat(input.env)),
      maskedTestDestination: maskIdentifier(configuredTestChat(input.env)),
      lastTest: input.testState,
      lastTestLabel: testLabels[input.testState],
      lastTestAt: input.testCheckedAt,
      deliveryUnknown: input.deliveryUnknown,
      deliveryPending: input.deliveryPending,
    },
    gemini: {
      configured: geminiReady,
      status: geminiStatus,
      statusLabel: geminiLabels[geminiStatus],
      checkedAt: geminiReady ? input.geminiCheckedAt : null,
      model,
    },
  };
}
