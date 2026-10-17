import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ proposalId: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const id = (await params).proposalId,
    revision = Number((await searchParams).revision);
  const next = `/proposals/${id}?revision=${revision}`;
  const { client, user } = await requireUser(next);
  if (
    !z.uuid().safeParse(id).success ||
    !Number.isInteger(revision) ||
    revision < 1
  )
    notFound();
  const { data, error } = await client.rpc("shared_proposal", {
    p_proposal: id,
    p_revision: revision,
  });
  if (error || !data)
    return (
      <main className="mx-auto grid max-w-xl gap-4 p-8 py-20">
        <h1 className="text-2xl font-semibold">Proposal unavailable</h1>
        <p>
          Sign in with the invited account or ask the owner for a new
          invitation. No private terms are shown.
        </p>
        <form action="/auth/signout" method="post">
          <button className="underline">Sign out and switch accounts</button>
        </form>
      </main>
    );
  const expired = data.expires_at && new Date(data.expires_at) <= new Date();
  return (
    <main className="mx-auto grid max-w-2xl gap-5 p-8 py-16">
      <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
      <h1 className="text-3xl font-semibold">
        {data.project} · Proposal revision {data.revision}
      </h1>
      <p>Status: {expired ? "Expired" : data.status}</p>
      <pre className="whitespace-pre-wrap rounded-lg border p-5 font-sans text-sm">
        {JSON.stringify(data.terms, null, 2)}
      </pre>
      <p className="text-sm text-muted-foreground">
        This release establishes authorized proposal access. The proposal
        response and approval-to-work workflow is a separate feature and is not
        enabled here. An iMessage reply does not approve these terms.
      </p>
      <form action="/auth/signout" method="post">
        <button className="underline">Sign out</button>
      </form>
    </main>
  );
}
