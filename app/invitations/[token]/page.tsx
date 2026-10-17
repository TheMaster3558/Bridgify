import { requireUser } from "@/lib/auth/session";
import { AcceptInvite } from "@/components/setup/accept-invite";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { user } = await requireUser(`/invitations/${token}`);
  return (
    <main className="mx-auto grid max-w-lg gap-5 p-8 py-20">
      <h1 className="text-2xl font-semibold">Accept your project invitation</h1>
      <p>
        Signed in as {user.email}. Access is checked against the signed-in
        account email and the invitation. No terms are shown until access is
        confirmed.
      </p>
      {/^[a-f0-9]{64}$/.test(token) ? (
        <AcceptInvite token={token} />
      ) : (
        <p role="alert">
          Invitation unavailable. Ask the owner for a new link.
        </p>
      )}
      <form action="/auth/signout" method="post">
        <button className="underline">
          Sign out and use a different email
        </button>
      </form>
    </main>
  );
}
