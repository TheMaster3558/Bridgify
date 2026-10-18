import type { WorkSummary } from "@/lib/dashboard/summary";
import { DeleteProject } from "./delete-project";
import Link from "next/link";
import type { Bundle } from "@/lib/domain/types";
import { LifecycleControls } from "@/components/setup/lifecycle-controls";
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
export function ProjectOverview({
  bundle,
  owner,
  summary,
  accounting,
}: {
  bundle: Bundle;
  owner: string;
  summary?:WorkSummary;
  accounting?:{requestsUsed:number;roundsUsed:number;grossRequests:number;requestRefunds:number};
}) {
  const p = bundle.project,
    root = `/app/projects/${p.id}`;
  const baseline = bundle.scope.find((s) => s.version === p.scope_version);
  const revisions = baseline?.agreement?.commercial.revision;
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency,
  }).format(p.original_amount_cents / 100);
  const due = p.agreed_due_date
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(`${p.agreed_due_date}T00:00:00Z`))
    : "No date agreed";
  const linkClass =
    "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted";
  return (
    <main className="grid gap-6 p-5 lg:p-8">
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <Panel title="Project">
          <dl className="text-sm">
            <Row label="Client">{p.client_name}</Row>
            <Row label="Connected requester">
              {p.people?.client_name || "Not connected"}
            </Row>
            <Row label="Owner">{owner || "Workspace owner"}</Row>
            <Row label="Agreed launch">{due}</Row>
            <Row label="Timezone">{p.timezone}</Row>
            <Row label="Scope">
              {p.scope_version
                ? `v${p.scope_version} (confirmed baseline)`
                : "Not confirmed"}
            </Row>
            <Row label="Automation">
              {p.policy?.mode?.replaceAll("_", " ") || "Not configured"}
            </Row>
          </dl>
        </Panel>
        <Panel title="Approved value">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Original price</dt>
              <dd>{price}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Approved additions</dt>
              <dd>{new Intl.NumberFormat("en-US",{style:"currency",currency:p.currency}).format((p.approved_additions_cents??0)/100)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
              <dt>Approved total</dt>
              <dd>{new Intl.NumberFormat("en-US",{style:"currency",currency:p.currency}).format((p.original_amount_cents+(p.approved_additions_cents??0))/100)}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Approved additions include only recorded client approvals. Pending proposals do not change this total.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Agreed work value. Not an invoice or payment.
          </p>
        </Panel>
        <Panel
          title="Revisions"
          action={
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {revisions?.allowance != null
                ? `${revisions.allowance} ${revisions.unit}`
                : "Not specified"}
            </span>
          }
        >
          {accounting && <p className="mb-3">{p.policy?.allowance ?? 0} included {p.policy?.allowance_mode === "manual_rounds" ? "rounds" : "requests"} · {p.policy?.allowance_mode === "manual_rounds" ? accounting.roundsUsed : accounting.requestsUsed} used · {Math.max(0,(p.policy?.allowance??0)-(p.policy?.allowance_mode === "manual_rounds"?accounting.roundsUsed:accounting.requestsUsed))} remaining · {accounting.requestRefunds} request refunds</p>}
          <p className="text-sm text-muted-foreground">
            {accounting ? "Acceptance uses a revision. Cancellation preserves usage unless explicitly refunded." : revisions?.allowance != null
              ? "Allowance from the owner-confirmed agreement. Revision consumption and reservations are not connected yet."
              : "No revision allowance is available from a confirmed agreement."}
          </p>
          <div className="mt-7 grid gap-3 border-t pt-5 text-sm">
            <span className="text-muted-foreground">iMessage connection</span>
            <p>
              {p.people
                ? `Linked to ${p.people.client_name}`
                : "No Photon client linked"}
            </p>
            <p className="text-xs text-muted-foreground">
              Introduction: {bundle.binding?.test_state || "Not sent"}. Live
              connection health has not been checked here.
            </p>
            <Link
              className="w-fit text-primary hover:underline"
              href={`${root}/conversation`}
            >
              Open conversation →
            </Link>
          </div>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Ready work and blockers"
          action={
            <Link className={linkClass} href={`${root}/work`}>
              Open Work
            </Link>
          }
        >
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
            <p className="font-medium">{summary ? `${summary.ready} ready · ${summary.inProgress} in progress · ${summary.blocked} blocked` : "No work summary available"}</p>
          </div>
        </Panel>
        <Panel
          title="Open decisions"
          action={
            <Link className={linkClass} href={`/app/decisions?project=${p.id}`}>
              Review decisions
            </Link>
          }
        >
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
            <p className="font-medium">{summary ? `${summary.decisions} open decisions · ${summary.proposals} proposals awaiting response` : "No decision summary available"}</p>
            {summary && <p className="text-sm">{summary.queued} replies queued · {summary.unknown + summary.failed} delivery or processing issues</p>}
          </div>
        </Panel>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <Link
          className="text-primary hover:underline"
          href={`${root}/scope/history`}
        >
          View confirmed agreement & source history
        </Link>
        <Link
          className="text-primary hover:underline"
          href={p.activation_cutoff ? `${root}/automation` : `${root}/setup?step=3`}
        >
          Manage client connection
        </Link>
      </div>
      <details className="rounded-xl border bg-card p-5">
        <summary className="cursor-pointer font-medium">
          Project lifecycle controls
        </summary>
        <div className="mt-4">
          <LifecycleControls
            id={p.id}
            version={p.version}
            status={p.status}
            mode={p.policy?.mode || "review_only"}
          />
        </div>
      </details>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 p-5">
        <div>
          <h2 className="font-medium">Delete project</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently remove this project and its saved records.
          </p>
        </div>
        <DeleteProject id={p.id} name={p.name} />
      </div>
    </main>
  );
}
