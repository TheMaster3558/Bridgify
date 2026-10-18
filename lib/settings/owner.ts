import "server-only";
import { ApiError, checked } from "@/lib/api";
import { db } from "@/lib/db/server";

type Client = Awaited<ReturnType<typeof db>>;

export async function requireApiOwner(client: Client) {
  const membership = checked(
    await client
      .from("organization_members")
      .select("organization_id")
      .eq("role", "owner")
      .maybeSingle(),
  ) as { organization_id: string } | null;
  if (!membership) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only a workspace owner can use settings.",
    );
  }
  return membership;
}
