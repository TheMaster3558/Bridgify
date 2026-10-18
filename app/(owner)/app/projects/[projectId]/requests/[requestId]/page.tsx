import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { requestDetail } from "@/lib/requests/detail";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; requestId: string }>;
}) {
  const { client } = await requireOwner();
  const { projectId, requestId } = await params;
  const d = await requestDetail(client, projectId, requestId);
  const root = `/app/projects/${projectId}`;
  return (
    <main className="grid gap-5 p-6">
      <h1 className="text-2xl font-semibold">{d.request.summary}</h1>
      <p>
        {d.request.state.replaceAll("_", " ")} · clarification turns:{" "}
        {d.request.clarification_turns}
      </p>
      <nav className="flex gap-4">
        <Link className="underline" href={`${root}/conversation`}>
          Conversation
        </Link>
        <Link className="underline" href={`${root}/scope/history`}>
          Scope history
        </Link>
        {d.request.task_id && (
          <Link className="underline" href={`/app/tasks/${d.request.task_id}`}>
            Task
          </Link>
        )}
        {d.decision && (
          <Link
            className="underline"
            href={`/app/decisions?status=${d.decision.status === "reviewing" ? "open" : d.decision.status}&project=${projectId}&decision=${d.decision.id}`}
          >
            Decision
          </Link>
        )}
      </nav>
      {d.proposals?.map((p) => (
        <Link
          className="underline"
          key={`${p.proposal_id}-${p.revision}`}
          href={`${root}/proposals/${p.proposal_id}?revision=${p.revision}`}
        >
          Proposal revision {p.revision} · {p.status}
        </Link>
      ))}
      <h2 className="font-semibold">Source messages</h2>
      {d.messages?.map((m) => (
        <blockquote key={m.id} className="whitespace-pre-wrap border-l-2 pl-4">
          <p>{m.text}</p>
          <cite className="text-sm">
            {m.occurred_at} · {m.role} · {m.provider_guid}
          </cite>
        </blockquote>
      ))}
      <h2 className="font-semibold">Assessment and applied rule</h2>
      <pre className="overflow-auto whitespace-pre-wrap rounded border p-4">
        {JSON.stringify(d.request.intent, null, 2)}
      </pre>
      {d.appliedRules?.map((a, i) => (
        <p key={i}>
          Assessed under scope v{a.details?.scopeVersion ?? "—"}, policy v
          {a.details?.policyVersion ?? "—"} · {a.action} · {a.created_at}
        </p>
      ))}
      <p>
        Revision:{" "}
        {d.usage
          ? `Used under scope v${d.usage.scope_version}, policy v${d.usage.policy_version}${d.refund ? " · refunded" : ""}`
          : "No individual revision used"}
      </p>
      <p>
        Model: {d.job?.model ?? "Not recorded"} · prompt:{" "}
        {d.job?.prompt_version ?? "Not recorded"}
      </p>
      {d.decision?.history?.map((h: string, i: number) => (
        <p key={i}>{h}</p>
      ))}
    </main>
  );
}
