import { readJson } from "@/lib/body";
import { ApiError, api, idempotency } from "@/lib/api";
import { settingsActionSchema } from "@/lib/schemas/settings";
import { decideSettingsTest, photonConfigured, settingsTestInput } from "@/lib/settings/health";
import {
  SettingsIntegrationError,
  loadIntegrationHealth,
  readSettingsTest,
  sendSettingsTest,
  writeSettingsTest,
} from "@/lib/settings/integrations";
import { requireApiOwner } from "@/lib/settings/owner";

export async function POST(request: Request) {
  return api(request, async (client, user) => {
    await requireApiOwner(client);
    const key = idempotency(request);
    settingsActionSchema.parse(await readJson(request));
    if (!photonConfigured(process.env) || !settingsTestInput(process.env, key)) {
      throw new ApiError(
        422,
        "TEST_DESTINATION",
        "Photon and PHOTON_TEST_CHAT_GUID must be configured on the server. Settings cannot choose a destination.",
      );
    }
    const current = await readSettingsTest(user.id);
    const decision = decideSettingsTest(current, key, Date.now());
    if (decision.action === "expire") {
      await writeSettingsTest(user.id, {
        state: "unknown",
        checkedAt: new Date().toISOString(),
        requestKey: current?.requestKey || key,
      });
      throw new ApiError(503, "DELIVERY_UNKNOWN", decision.message);
    }
    if (decision.action === "reject") {
      throw new ApiError(409, "IN_PROGRESS", decision.message);
    }
    if (decision.action === "replay") return replay(client, user.id, decision.state);
    await writeSettingsTest(user.id, {
      state: "sending",
      checkedAt: new Date().toISOString(),
      requestKey: key,
    });
    let outcome: "sent" | "unknown" | "unavailable" = "unknown";
    try {
      const result = await sendSettingsTest(key);
      if (result.state === "sent") outcome = "sent";
      else if (result.state === "failed") outcome = "unavailable";
    } catch (error) {
      outcome = error instanceof SettingsIntegrationError ? "unavailable" : "unknown";
    }
    await writeSettingsTest(user.id, {
      state: outcome,
      checkedAt: new Date().toISOString(),
      requestKey: key,
    });
    if (outcome === "unknown") {
      throw new ApiError(
        503,
        "DELIVERY_UNKNOWN",
        "Test delivery is unknown. Inspect provider records before sending again. Reachable does not mean a message was delivered.",
      );
    }
    return {
      health: await loadIntegrationHealth(client, user.id),
      state: outcome,
      message:
        outcome === "sent"
          ? "Sent to the configured test destination. Sent means the provider accepted the message, not that a client device showed it."
          : "Unavailable. Photon rejected the test before accepting a message.",
    };
  });
}

async function replay(
  client: Parameters<typeof loadIntegrationHealth>[0],
  userId: string,
  state: string,
) {
  const health = await loadIntegrationHealth(client, userId);
  if (state === "unknown") {
    throw new ApiError(
      503,
      "DELIVERY_UNKNOWN",
      "Test delivery is unknown. Inspect provider records before sending again.",
    );
  }
  if (state === "sending") {
    throw new ApiError(409, "IN_PROGRESS", "A test is already in progress.");
  }
  return { health, state, message: "This test was already recorded." };
}
