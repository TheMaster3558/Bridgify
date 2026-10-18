import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import type { Bundle } from "@/lib/domain/types";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { client } = await requireOwner();
  const b = (await projectBundle(client, (await params).projectId)) as Bundle;
  return (
    <main className="mx-auto grid max-w-4xl gap-5 p-8">
      <h1 className="text-3xl font-semibold">
        Scope history · {b.project.name}
      </h1>
      <Link className="underline" href={`/app/projects/${b.project.id}`}>
        Project overview
      </Link>
      <p>
        Confirmed versions and sources are retained. An activated baseline
        cannot be overwritten; material changes require explicit client approval
        through an amendment.
      </p>
      {b.scope.length ? (
        b.scope.map((s) => (
          <section className="grid gap-3 rounded-xl border p-5" key={s.version}>
            <h2 className="text-xl font-semibold">
              Version {s.version}
              {s.version === b.project.scope_version
                ? " · Current baseline"
                : " · Retained history"}
            </h2>
            {s.terms.map((t, i) => (
              <article key={i} className="rounded border p-3">
                <strong className="text-sm">{t.kind}</strong>
                <p>{t.text}</p>
                <blockquote className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">
                  Page {b.spans.find((span) => span.id === t.span_id)?.page}: “
                  {t.quote}”
                </blockquote>
              </article>
            ))}
          </section>
        ))
      ) : (
        <p>No baseline confirmed. Import and review your agreement in setup.</p>
      )}
    </main>
  );
}
