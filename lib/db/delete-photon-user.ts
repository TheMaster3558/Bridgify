import "server-only";
import { ApiError, checked } from "@/lib/api";
import type { db } from "./server";
import { adminDb } from "./admin";
import { deletePhotonUser } from "../photon/delete-user";
import { listPhotonUsers, readSpectrumCredentials } from "../photon/spectrum";
export async function deleteDraftPhotonUser(
  client: Awaited<ReturnType<typeof db>>,
  ownerId: string,
  projectId: string,
  userId: string,
  phoneNumber: string,
) {
  const { projectId: instanceId } = readSpectrumCredentials();
  const users = await listPhotonUsers();
  const user = users.find((user) => user.id === userId);
  if (user && user.phoneNumber !== phoneNumber)
    throw new ApiError(
      409,
      "PHOTON_USER_CHANGED",
      "The user's phone number changed. Refresh the list before deleting.",
    );
  // Configure provider-result persistence before starting the deletion intent.
  const admin = adminDb();
  const claim = await client.rpc("begin_photon_user_deletion", {
    p_project: projectId,
    p_instance: instanceId,
    p_user: userId,
    p_phone: phoneNumber,
  });
  if (claim.error?.code === "PGRST202")
    throw new ApiError(
      503,
      "MIGRATION_REQUIRED",
      "Apply migration 202610170011_photon_user_deletion.sql before deleting Photon users.",
    );
  const state = checked(claim);
  if (state !== "pending" && state !== "deleted")
    throw new ApiError(
      503,
      "DATABASE",
      "User deletion could not be reserved. No deletion was attempted.",
    );
  // The current provider list wins over an older receipt (for example, a restored user).
  if (user) await deletePhotonUser(userId);
  // Only the trusted provider result may finalize the session-authorized receipt.
  const saved = checked(
    await admin
      .from("photon_user_deletions")
      .update({
        state: "deleted",
        phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .eq("instance_id", instanceId)
      .eq("user_id", userId)
      .eq("requested_by", ownerId)
      .select("user_id")
      .maybeSingle(),
  );
  if (!saved)
    throw new ApiError(
      503,
      "DATABASE",
      "User deletion could not be recorded. Refresh or retry deletion.",
    );
  return { deleted: true, userId };
}
