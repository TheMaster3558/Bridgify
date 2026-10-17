import { requireOwner } from "@/lib/auth/session";
export default async function Page() {
  const { user, membership } = await requireOwner();
  const org = membership.organizations as unknown as { name: string } | null;
  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-8">
      <h1 className="text-3xl font-semibold">Account & integrations</h1>
      <section className="grid gap-3 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          {org?.name || "Your workspace"}
        </h2>
        <p>{user.email}</p>
        <p className="text-sm text-muted-foreground">
          Recover access by requesting another email sign-in link. Workspace
          access belongs to this verified account.
        </p>
        <form method="post" action="/auth/signout">
          <button className="underline">Sign out</button>
        </form>
      </section>
      <section className="grid gap-3 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Server integration configuration
        </h2>
        <p>
          Photon credentials:{" "}
          {process.env.PHOTON_TOKEN && process.env.PHOTON_HTTP_ADDRESS
            ? "Configured"
            : "Missing"}
        </p>
        <p>
          Verified webhook gateway:{" "}
          {process.env.PHOTON_WEBHOOK_MODE === "normalized-gateway-v1" &&
          process.env.PHOTON_GATEWAY_SECRET
            ? "Configured; each project must pass its echo test"
            : "Not configured"}
        </p>
        <p>
          Gemini:{" "}
          {process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL
            ? "Configured"
            : "Missing"}
        </p>
        <p className="text-sm text-muted-foreground">
          Configuration does not prove availability or delivery. Test the exact
          linked group in project setup. Credentials are managed on the server.
        </p>
      </section>
    </main>
  );
}
