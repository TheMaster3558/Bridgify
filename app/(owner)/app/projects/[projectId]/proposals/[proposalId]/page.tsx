import { RecordResponse } from "@/components/proposals/record-response";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { ProposalEditor } from "@/components/proposals/proposal-editor";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; proposalId: string }>;
  searchParams: Promise<{ revision?: string; evidencePage?: string }>;
}) {
  const { client } = await requireOwner();
  const { projectId, proposalId } = await params;
  const { revision, evidencePage } = await searchParams;
  const evidenceIndex = Math.max(
    1,
    Math.min(100000, Number(evidencePage) || 1),
  );
  let query = client
    .from("proposal_revisions")
    .select("*")
    .eq("project_id", projectId)
    .eq("proposal_id", proposalId);
  if (revision) query = query.eq("revision", Number(revision));
  const row = checked(
    await query.order("revision", { ascending: false }).limit(1).maybeSingle(),
  );
  if (!row) notFound();
  const project = checked(
    await client
      .from("projects")
      .select("version,scope_version")
      .eq("id", projectId)
      .single(),
  );
  if (!project) notFound();
  const scope = checked(
    await client
      .from("scope_versions")
      .select("terms")
      .eq("project_id", projectId)
      .eq("version", project.scope_version)
      .single(),
  );
  if (!scope) notFound();
  const messages = row.sent_at
    ? checked(
        await client
          .from("automation_messages")
          .select("id,text,occurred_at")
          .eq("project_id", projectId)
          .eq("role", "requester")
          .gte(
            "occurred_at",
            new Date(Date.parse(row.sent_at) - 3000).toISOString(),
          )
          .order("occurred_at", { ascending: false })
          .range((evidenceIndex - 1) * 100, evidenceIndex * 100 - 1),
      )
    : [];
  const response = checked(
    await client
      .from("proposal_responses")
      .select("*")
      .eq("project_id", projectId)
      .eq("proposal_id", proposalId)
      .eq("revision", row.revision)
      .maybeSingle(),
  );
  const outbox = checked(
    await client
      .from("automation_outbox")
      .select("id,state,provider_guid")
      .eq("project_id", projectId)
      .eq("purpose", `proposal:${proposalId}:r${row.revision}`)
      .maybeSingle(),
  );
  return (
    <main className="grid gap-4 p-6">
      <h1 className="text-2xl font-semibold">
        Proposal · revision {row.revision}
      </h1>
      <p>
        Business status: {row.status} · Delivery:{" "}
        {outbox?.state ?? "Not submitted"}
      </p>
      <Link
        className="underline"
        href={`/app/projects/${projectId}/automation`}
      >
        Inspect delivery and recovery
      </Link>
      <ProposalEditor
        key={`${row.revision}-${row.version}`}
        projectId={projectId}
        baselineTerms={(scope.terms as { text: string }[]).map((t) => t.text)}
        proposal={row}
      />
      {row.status === "awaiting_client" && row.terms_hash && (
        <RecordResponse
          proposalId={proposalId}
          revision={row.revision}
          version={row.version}
          projectVersion={project.version}
          termsHash={row.terms_hash}
          messages={messages ?? []}
        />
      )}
      <nav className="flex gap-4 text-sm">
        {evidenceIndex > 1 && (
          <Link
            className="underline"
            href={`?revision=${row.revision}&evidencePage=${evidenceIndex - 1}`}
          >
            Newer client evidence
          </Link>
        )}
        {messages?.length === 100 && (
          <Link
            className="underline"
            href={`?revision=${row.revision}&evidencePage=${evidenceIndex + 1}`}
          >
            Older client evidence
          </Link>
        )}
      </nav>
      {response && (
        <section className="rounded border p-4">
          <h2 className="font-semibold">Recorded {response.outcome}</h2>
          <p>{response.note}</p>
          <p>
            Recorded by {response.recorded_by} at {response.created_at}
          </p>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(response.evidence, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
