import { createHash } from "node:crypto";
import { readJson } from "@/lib/body";
import { ApiError, api, checked, idempotency } from "@/lib/api";
import { adminDb } from "@/lib/db/admin";
import { accountSettingsSchema, type AccountSettings } from "@/lib/schemas/settings";
import { requireApiOwner } from "@/lib/settings/owner";

function fingerprint(settings: AccountSettings) {
  return createHash("sha256")
    .update(`${settings.name}|${settings.timezone}|${settings.organization}`)
    .digest("hex");
}

export async function PATCH(request: Request) {
  return api(request, async (client, user) => {
    const membership = await requireApiOwner(client);
    const settings = accountSettingsSchema.parse(await readJson(request));
    const key = idempotency(request);
    const digest = fingerprint(settings);
    let admin: ReturnType<typeof adminDb>;
    try {
      admin = adminDb();
    } catch {
      throw new ApiError(
        503,
        "UNAVAILABLE",
        "Server recording is not configured. Settings were not saved.",
      );
    }
    const prior = checked(
      await admin
        .from("command_receipts")
        .select("fingerprint, result")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle(),
    ) as { fingerprint: string; result: unknown } | null;
    if (prior) {
      if (prior.fingerprint !== digest) {
        throw new ApiError(
          409,
          "CONFLICT",
          "This record changed. Refresh before retrying.",
        );
      }
      return prior.result;
    }
    const { error } = await client.auth.updateUser({
      data: { display_name: settings.name, timezone: settings.timezone },
    });
    if (error) {
      throw new ApiError(503, "UNAVAILABLE", "Unable to save your profile. Retry.");
    }
    const organization = checked(
      await admin
        .from("organizations")
        .update({ name: settings.organization })
        .eq("id", membership.organization_id)
        .select("name")
        .maybeSingle(),
    ) as { name: string } | null;
    if (!organization) {
      throw new ApiError(404, "NOT_FOUND", "Organization is unavailable.");
    }
    const result = {
      name: settings.name,
      timezone: settings.timezone,
      organization: organization.name,
    };
    const receipt = await admin.from("command_receipts").insert({
      user_id: user.id,
      key,
      fingerprint: digest,
      result,
    });
    if (receipt.error && receipt.error.code !== "23505") {
      throw new ApiError(
        503,
        "DATABASE",
        "Settings were saved, but the receipt could not be stored. Retry is safe.",
      );
    }
    return result;
  });
}
