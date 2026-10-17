import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/server";
import { safeNext } from "@/lib/domain/security";

export async function requireUser(next = "/app") {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return { client, user };
}
export async function requireOwner() {
  const { client, user } = await requireUser();
  const { data, error } = await client
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (error)
    throw new Error(
      "Unable to load workspace. Check the database migrations and retry.",
    );
  if (!data) redirect("/onboarding");
  return { client, user, membership: data };
}
