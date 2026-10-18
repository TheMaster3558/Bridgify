import { api, ApiError } from "@/lib/api";
import { loadPhotonUsers } from "@/lib/photon/people";

export async function GET(request: Request) {
  return api(request, async (client, user) => {
    const membership = await client
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();
    if (membership.error || !membership.data)
      throw new ApiError(403, "FORBIDDEN", "Owner access required.");
    return loadPhotonUsers();
  });
}
