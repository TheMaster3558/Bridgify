import { describe, expect, it } from "vitest";
import { settingsActionSchema } from "@/lib/schemas/settings";
import {
  buildIntegrationHealth,
  classifyGeminiFailure,
  configuredTestChat,
  decideSettingsTest,
  maskIdentifier,
  settingsTestInput,
} from "@/lib/settings/health";

const secrets = {
  PHOTON_HTTP_ADDRESS: "https://photon.example",
  PHOTON_TOKEN: "super-secret-photon-token",
  PHOTON_INSTANCE_ID: "instance-identifier-7d2",
  PHOTON_BOT_SENDER_ID: "bridgify-bot@example.com",
  PHOTON_GATEWAY_SECRET: "super-secret-gateway-value-32chars",
  PHOTON_WEBHOOK_MODE: "normalized-gateway-v1",
  PHOTON_TEST_CHAT_GUID: "any;+;configured-test-destination-991",
  GEMINI_API_KEY: "super-secret-gemini-key",
  GEMINI_MODEL: "gemini-flash-test",
};

describe("settings health", () => {
  it("masks identifiers and keeps provider secrets out of the health payload", () => {
    const health = buildIntegrationHealth({
      now: "2026-10-17T20:00:00.000Z",
      env: secrets,
      lastInboundAt: "2026-10-17T19:00:00.000Z",
      webhookVerified: true,
      deliveryUnknown: 1,
      deliveryPending: 0,
      photonConnection: "reachable",
      photonCheckedAt: "2026-10-17T19:55:00.000Z",
      geminiStatus: "rate_limited",
      geminiCheckedAt: "2026-10-17T19:55:00.000Z",
      testState: "sent",
      testCheckedAt: "2026-10-17T19:40:00.000Z",
    });
    const payload = JSON.stringify(health);
    expect(payload).not.toContain(secrets.PHOTON_TOKEN);
    expect(payload).not.toContain(secrets.GEMINI_API_KEY);
    expect(payload).not.toContain(secrets.PHOTON_GATEWAY_SECRET);
    expect(payload).not.toContain(secrets.PHOTON_TEST_CHAT_GUID);
    expect(payload).not.toContain(secrets.PHOTON_INSTANCE_ID);
    expect(health.photon.connectionLabel).toBe("Reachable");
    expect(health.photon.lastTestLabel).toBe("Sent");
    expect(health.gemini.statusLabel).toBe("Rate-limited");
    expect(health.gemini.model).toBe("gemini-flash-test");
    expect(health.photon.webhookLabel).toBe("Signature verified");
    expect(health.photon.maskedInstanceId).toBe("inst••••7d2");
    expect(health.photon.maskedTestDestination).not.toBe(
      secrets.PHOTON_TEST_CHAT_GUID,
    );
  });

  it("distinguishes unconfigured, unknown, and unavailable without inventing a delivery", () => {
    const health = buildIntegrationHealth({
      now: "2026-10-17T20:00:00.000Z",
      env: {},
      lastInboundAt: null,
      webhookVerified: false,
      deliveryUnknown: 0,
      deliveryPending: 0,
      photonConnection: "reachable",
      photonCheckedAt: null,
      geminiStatus: "available",
      geminiCheckedAt: null,
      testState: "unknown",
      testCheckedAt: null,
    });
    expect(health.photon.connectionLabel).toBe("Unconfigured");
    expect(health.gemini.statusLabel).toBe("Unconfigured");
    expect(health.photon.lastTestLabel).toBe("Unknown");
    expect(health.photon.testDestinationConfigured).toBe(false);
    expect(health.photon.maskedInstanceId).toBeNull();
  });

  it("builds a test send only from the server-configured destination", () => {
    const callerDestination = "any;+;attacker-chosen-chat";
    expect(configuredTestChat({ PHOTON_TEST_CHAT_GUID: "  configured-chat  " })).toBe(
      "configured-chat",
    );
    expect(settingsTestInput({ PHOTON_TEST_CHAT_GUID: callerDestination }, "dedupe-key-12345678")).toMatchObject({
      chatGuid: callerDestination,
    });
    expect(
      settingsTestInput(
        { PHOTON_TEST_CHAT_GUID: "configured-chat" },
        "dedupe-key-12345678",
      )?.chatGuid,
    ).toBe("configured-chat");
    expect(settingsTestInput({}, "dedupe-key-12345678")).toBeNull();
    expect(settingsActionSchema.safeParse({ chatGuid: callerDestination }).success).toBe(
      false,
    );
    expect(settingsActionSchema.safeParse({}).success).toBe(true);
  });

  it("classifies Gemini failures separately from a successful answer", () => {
    expect(classifyGeminiFailure({ status: 429 })).toBe("rate_limited");
    expect(classifyGeminiFailure({ message: "RESOURCE_EXHAUSTED" })).toBe(
      "rate_limited",
    );
    expect(classifyGeminiFailure({ status: 401, message: secrets.GEMINI_API_KEY })).toBe(
      "unavailable",
    );
    expect(classifyGeminiFailure({ message: "The operation was aborted" })).toBe(
      "unknown",
    );
  });

  it("masks short values completely", () => {
    expect(maskIdentifier("ab")).toBe("••••");
    expect(maskIdentifier("   ")).toBeNull();
  });

  it("blocks another settings test while delivery is unknown", () => {
    const now = Date.parse("2026-10-17T20:00:00.000Z");
    expect(decideSettingsTest(null, "request-key-0001", now)).toEqual({ action: "send" });
    expect(
      decideSettingsTest(
        { state: "unknown", checkedAt: "2026-10-17T19:00:00.000Z", requestKey: "request-key-0001" },
        "request-key-0002",
        now,
      ).action,
    ).toBe("reject");
    expect(
      decideSettingsTest(
        { state: "unknown", checkedAt: "2026-10-17T19:00:00.000Z", requestKey: "request-key-0001" },
        "request-key-0001",
        now,
      ),
    ).toEqual({ action: "replay", state: "unknown" });
    expect(
      decideSettingsTest(
        { state: "sending", checkedAt: "2026-10-17T19:00:00.000Z", requestKey: "request-key-0001" },
        "request-key-0002",
        now,
      ).action,
    ).toBe("expire");
    expect(
      decideSettingsTest(
        { state: "sent", checkedAt: "2026-10-17T19:00:00.000Z", requestKey: "request-key-0001" },
        "request-key-0002",
        now,
      ),
    ).toEqual({ action: "send" });
  });
});
