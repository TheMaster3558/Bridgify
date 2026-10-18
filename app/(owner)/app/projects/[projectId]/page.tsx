import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import { LifecycleControls } from "@/components/setup/lifecycle-controls";
import type { Bundle } from "@/lib/domain/types";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { client } = await requireOwner();
  const b = (await projectBundle(client, (await params).projectId)) as Bundle;
  const p = b.project;
  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-6 md:p-10">
      <div className="flex justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {p.client_name} · {p.status}
          </p>
          <h1 className="font-display text-3xl font-semibold">{p.name}</h1>
        </div>
        <Link className="text-sm underline" href="/app/projects">
          All projects
        </Link>
      </div>
      <p className="rounded border bg-muted p-4 text-sm">
        Onboarding and verified intake are available in this release.
        Request-to-task automation and proposal responses are not enabled yet.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="grid gap-4 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Agreement & setup</h2>
          <p>
            Original agreed price:{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(p.original_amount_cents / 100)}
          </p>
          <p>
            Completion: {p.agreed_due_date || "No date agreed"} · {p.timezone}
          </p>
          <p>
            Baseline:{" "}
            {p.scope_version
              ? `Confirmed version ${p.scope_version}`
              : "Not confirmed"}
          </p>
          <p>Automation: {p.policy?.mode || "Not configured"}</p>
          <Link className="underline" href={`/app/projects/${p.id}/setup`}>
            {p.activation_cutoff ? "Inspect retained setup" : "Resume setup"}
          </Link>
          <Link className="underline" href={`/app/projects/${p.id}/scope`}>
            Inspect scope evidence and history
          </Link>
        </section>
        <section className="grid gap-3 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Client connection</h2>
          <p>
            Client:{" "}
            {b.members.length ? "Invitation accepted" : "Invitation required"}
          </p>
          <p>
            iMessage:{" "}
            {p.people
              ? `${p.people.client_name} (${p.people.client_sender_id})`
              : "Choose the client from your Photon users"}
          </p>
          <p>Introduction: {b.binding?.test_state || "Not sent"}</p>
          {b.binding?.hold_reason && (
            <p role="alert">{b.binding.hold_reason}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Cutoff:{" "}
            {p.activation_cutoff
              ? new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: p.timezone,
                }).format(new Date(p.activation_cutoff))
              : "Established at activation"}
          </p>
          <Link
            className="underline"
            href={`/app/projects/${p.id}/setup?step=3`}
          >
            Inspect connection
          </Link>
        </section>
      </div>
      <LifecycleControls
        id={p.id}
        version={p.version}
        status={p.status}
        mode={p.policy?.mode || "review_only"}
      />
    </main>
  );
}
