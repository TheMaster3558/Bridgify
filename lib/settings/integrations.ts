import "server-only";
import { GoogleGenAI } from "@google/genai";
import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  createHttpClient,
} from "@photon-ai/advanced-imessage/http";
import { ApiError, checked } from "@/lib/api";
import { readPhotonConfig } from "@/lib/assistant/config";
import { adminDb } from "@/lib/db/admin";
import { db } from "@/lib/db/server";
import { createPhotonSender } from "@/lib/photon/sender";
import {
  SETTINGS_TEST_RECEIPT_KEY,
  buildIntegrationHealth,
  classifyGeminiFailure,
  classifyPhotonFailure,
  geminiConfigured,
  photonConfigured,
  settingsTestInput,
  type ConnectionState,
  type GeminiState,
  type IntegrationHealth,
  type SettingsTestRecord,
} from "@/lib/settings/health";

type Client = Awaited<ReturnType<typeof db>>;
type ProbeMemory = {
  at: number;
  photonConnection: "unknown" | "reachable" | "unavailable";
  photonCheckedAt: string | null;
  geminiStatus: "unknown" | "available" | "rate_limited" | "unavailable";
  geminiCheckedAt: string | null;
};

const FRESH_MS = 60_000;
const probes = new Map<string, ProbeMemory>();

export class SettingsIntegrationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function failureFacts(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : "" };
  }
  const record = error as {
    status?: number;
    code?: number;
    message?: string;
    error?: { code?: number; status?: string; message?: string };
  };
  const status = record.status || record.code || record.error?.code;
  return {
    status: typeof status === "number" ? status : undefined,
    message: [record.message, record.error?.status, record.error?.message]
      .filter((part) => typeof part === "string")
      .join(" "),
  };
}

export async function probePhoton(): Promise<
  Exclude<ConnectionState, "unconfigured">
> {
  if (!photonConfigured(process.env)) return "unavailable";
  let client: ReturnType<typeof createHttpClient> | undefined;
  try {
    const config = readPhotonConfig();
    client = createHttpClient({
      address: config.PHOTON_HTTP_ADDRESS,
      token: config.PHOTON_TOKEN,
      server: config.PHOTON_INSTANCE_ID,
      timeout: 8_000,
      retry: false,
    });
    await client.chats.count();
    return "reachable";
  } catch (error) {
    if (
      error instanceof AuthenticationError ||
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof RateLimitError
    ) {
      return classifyPhotonFailure("rejected");
    }
    return classifyPhotonFailure("uncertain");
  } finally {
    await client?.close().catch(() => undefined);
  }
}

export async function probeGemini(): Promise<
  Exclude<GeminiState, "unconfigured">
> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return "unavailable";
  try {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 8_000, retryOptions: { attempts: 1 } },
    });
    const models = await client.models.list({ config: { pageSize: 1 } });
    await models[Symbol.asyncIterator]().next();
    return "available";
  } catch (error) {
    return classifyGeminiFailure(failureFacts(error));
  }
}

export async function sendSettingsTest(dedupeKey: string) {
  const input = settingsTestInput(process.env, dedupeKey);
  if (!input) {
    throw new SettingsIntegrationError(
      "TEST_DESTINATION",
      "Set PHOTON_TEST_CHAT_GUID on the server. Settings cannot choose a destination.",
    );
  }
  let config: ReturnType<typeof readPhotonConfig>;
  try {
    config = readPhotonConfig();
  } catch {
    throw new SettingsIntegrationError(
      "UNCONFIGURED",
      "Photon is not configured on the server.",
    );
  }
  const client = createHttpClient({
    address: config.PHOTON_HTTP_ADDRESS,
    token: config.PHOTON_TOKEN,
    server: config.PHOTON_INSTANCE_ID,
    timeout: 10_000,
    retry: false,
    autoIdempotency: true,
  });
  try {
    return await createPhotonSender(client).sendText(input);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function serverDb() {
  try {
    return adminDb();
  } catch {
    throw new ApiError(
      503,
      "UNAVAILABLE",
      "Server recording is not configured.",
    );
  }
}

export async function readSettingsTest(userId: string) {
  const row = checked(
    await serverDb()
      .from("command_receipts")
      .select("result")
      .eq("user_id", userId)
      .eq("key", SETTINGS_TEST_RECEIPT_KEY)
      .maybeSingle(),
  ) as { result: SettingsTestRecord } | null;
  const result = row?.result;
  if (!result || typeof result.state !== "string" || !result.requestKey) return null;
  return result;
}

export async function writeSettingsTest(userId: string, record: SettingsTestRecord) {
  checked(
    await serverDb().from("command_receipts").upsert(
      {
        user_id: userId,
        key: SETTINGS_TEST_RECEIPT_KEY,
        fingerprint: record.state,
        result: record,
      },
      { onConflict: "user_id,key" },
    ),
  );
}

export async function loadIntegrationHealth(
  client: Client,
  userId: string,
  options?: { refresh?: boolean },
): Promise<IntegrationHealth> {
  const inbound = checked(
    await client
      .from("inbox_events")
      .select("received_at")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { received_at: string } | null;
  const bindings =
    (checked(
      await client.from("chat_bindings").select("webhook_verified_at, test_state"),
    ) as { webhook_verified_at: string | null; test_state: string }[] | null) ||
    [];
  let test: SettingsTestRecord | null = null;
  try {
    test = await readSettingsTest(userId);
  } catch {
    test = null;
  }
  let cached = probes.get(userId);
  const stale = !cached || Date.now() - cached.at > FRESH_MS;
  if (options?.refresh || stale) {
    const now = new Date().toISOString();
    const [photon, gemini] = await Promise.all([
      photonConfigured(process.env) ? probePhoton() : Promise.resolve(null),
      geminiConfigured(process.env) ? probeGemini() : Promise.resolve(null),
    ]);
    cached = {
      at: Date.now(),
      photonConnection: photon ?? "unknown",
      photonCheckedAt: photon ? now : null,
      geminiStatus: gemini ?? "unknown",
      geminiCheckedAt: gemini ? now : null,
    };
    probes.set(userId, cached);
  }
  const settingsUnknown = test?.state === "unknown" ? 1 : 0;
  const settingsPending = test?.state === "sending" ? 1 : 0;
  return buildIntegrationHealth({
    now: new Date().toISOString(),
    env: process.env,
    lastInboundAt: inbound?.received_at ?? null,
    webhookVerified: bindings.some((binding) => binding.webhook_verified_at),
    deliveryUnknown:
      bindings.filter((binding) => binding.test_state === "unknown").length +
      settingsUnknown,
    deliveryPending:
      bindings.filter((binding) => binding.test_state === "sending").length +
      settingsPending,
    photonConnection: cached?.photonConnection ?? "unknown",
    photonCheckedAt: cached?.photonCheckedAt ?? null,
    geminiStatus: cached?.geminiStatus ?? "unknown",
    geminiCheckedAt: cached?.geminiCheckedAt ?? null,
    testState: test?.state ?? "none",
    testCheckedAt: test?.checkedAt ?? null,
  });
}
