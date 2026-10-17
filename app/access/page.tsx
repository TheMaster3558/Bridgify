export const dynamic = "force-dynamic";
import { requireUser } from "@/lib/auth/session";
export default async function Page() {
  const { user } = await requireUser("/access");
  return (
    <main className="mx-auto grid max-w-lg gap-5 p-8 py-20">
      <h1 className="text-2xl font-semibold">Client access</h1>
      <p>
        Signed in as {user.email}. If you just accepted an invitation, your
        identity is now registered for that project. Open the exact proposal
        link supplied by your owner to review its terms.
      </p>
      <p className="text-sm text-muted-foreground">
        For missing or expired access, request a new invitation from the project
        owner. Signing in alone does not grant access to private project data.
      </p>
      <form action="/auth/signout" method="post">
        <button className="underline">
          Sign out and use a different email
        </button>
      </form>
    </main>
  );
}
