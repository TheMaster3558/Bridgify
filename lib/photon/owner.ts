import "server-only";
import { ApiError } from "@/lib/api";
import type { db } from "@/lib/db/server";
export async function requirePhotonOwner(
  client: Awaited<ReturnType<typeof db>>,
  userId: string,
) {
  const membership = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (membership.error || !membership.data)
    throw new ApiError(403, "FORBIDDEN", "Owner access required.");
}
