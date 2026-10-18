import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/server";
import { checked } from "@/lib/api";
import { policySchema } from "@/lib/schemas/onboarding";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const client = await db();
  const project = checked(
    await client
      .from("projects")
      .select("id,status,policy,scope_version,policy_version")
      .eq("id", projectId)
      .maybeSingle(),
  );
  if (!project) notFound();
  const parsed = policySchema.safeParse(project.policy);
  const results = await Promise.all([
    client
      .from("automation_revision_uses")
      .select("request_id", { count: "exact", head: true })
      .eq("project_id", projectId),
    client
      .from("automation_jobs")
      .select("id,state,attempts,error_code,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
    client
      .from("automation_outbox")
      .select("id,state,text,error_code,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  results.forEach((result) => checked<unknown>(result));
  const policy = parsed.success ? parsed.data : null;
  return (
    <main className="grid gap-6 p-5 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Automation</h2>
        <Link
          className="rounded border px-3 py-2 text-sm"
          href={`/app/projects/${projectId}/setup?step=4`}
        >
          Project automation settings
        </Link>
      </header>
      <section className="grid gap-3 rounded-lg border bg-card p-5">
        <h3 className="font-semibold">
          Saved request handling · policy v{project.policy_version}
        </h3>
        <p>
          {policy?.mode === "enabled"
            ? "Accept permitted small changes automatically"
            : "Owner approves every request"}
          {project.status === "paused" ? " · Paused" : ""}
        </p>
        {policy ? (
          <>
            <p className="text-sm text-muted-foreground">
              {results[0].count ?? 0} accepted individual requests ·{" "}
              {policy.allowance} included{" "}
              {policy.allowance_mode === "manual_rounds"
                ? "rounds (manual accounting)"
                : "requests"}{" "}
              · up to {policy.max_open_tasks} automatic tasks open
            </p>
            <p className="text-sm">
              Permitted changes:{" "}
              {policy.operations
                .map((op) => op.replaceAll("_", " "))
                .join(", ") || "None"}
            </p>
            <p className="text-sm">
              Pages and elements: {policy.targets.join(", ") || "None selected"}
            </p>
            <p className="text-sm">Always needs review: {policy.exclusions}</p>
            <ul className="grid gap-1 text-sm">
              {(
                [
                  ["status_questions", "Task status answers"],
                  ["clarifications", "Missing detail follow-ups"],
                  ["review_acknowledgments", "Review acknowledgments"],
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  {label}: {policy.replies[key] ? "Enabled" : "Disabled"}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Finish automation setup to configure request handling.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Replies require the automation worker. Recent processing and delivery
          records appear below.
        </p>
      </section>
      <section className="grid gap-3 rounded-lg border bg-card p-5">
        <h3 className="font-semibold">Recent processing</h3>
        {results[1].data?.length ? (
          <ul className="divide-y">
            {results[1].data.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap justify-between gap-2 py-2 text-sm"
              >
                <span className="capitalize">
                  {job.state} · {job.attempts} attempts
                  {job.error_code
                    ? ` · ${job.error_code.replaceAll("_", " ")}`
                    : ""}
                </span>
                <time>{new Date(job.created_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No messages have been processed yet.
          </p>
        )}
      </section>
      <section className="grid gap-3 rounded-lg border bg-card p-5">
        <h3 className="font-semibold">Client reply delivery</h3>
        {results[2].data?.length ? (
          <ul className="divide-y">
            {results[2].data.map((reply) => (
              <li key={reply.id} className="grid gap-1 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="capitalize">{reply.state}</strong>
                  <time>{new Date(reply.created_at).toLocaleString()}</time>
                </div>
                <p className="whitespace-pre-wrap">{reply.text}</p>
                {reply.error_code && (
                  <p className="text-xs text-muted-foreground">
                    {reply.error_code.replaceAll("_", " ")} · Check Needs
                    Attention before sending again.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No automatic replies have been queued yet.
          </p>
        )}
      </section>
    </main>
  );
}
