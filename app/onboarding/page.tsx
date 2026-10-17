export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CreateWorkspace } from "@/components/setup/create-workspace";
export default async function Page() {
  const { client, user } = await requireUser("/onboarding");
  const { data, error } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Database is unavailable. Apply the Supabase migration and retry.",
    );
  if (data) redirect("/app");
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-8 py-20">
      <h1 className="font-display text-3xl font-semibold">
        Create your workspace
      </h1>
      <p>
        Signed in as {user.email}. Create a workspace to manage your own
        projects.
      </p>
      <CreateWorkspace />
      <p className="text-sm text-muted-foreground">
        Invited as a client? Return to the invitation link from your project
        owner. You can review proposals without creating a workspace.
      </p>
      <Link href="/access" className="underline">
        Client access
      </Link>
      <form method="post" action="/auth/signout">
        <button className="underline">Sign out</button>
      </form>
    </main>
  );
}
