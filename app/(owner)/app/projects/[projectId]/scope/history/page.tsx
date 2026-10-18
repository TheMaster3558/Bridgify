import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import type { Bundle } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const kindLabels: Record<string, string> = {
  inclusion: "Included",
  exclusion: "Not included",
  revision: "Revisions",
  date: "Deadline",
  responsibility: "Client provides",
};

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { client } = await requireOwner();
  const b = (await projectBundle(client, (await params).projectId)) as Bundle;
  const versions = [...b.scope].sort((x, y) => y.version - x.version);
  const confirmed = (value: string) =>
    new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: b.project.timezone || "UTC" }).format(new Date(value));
  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6 [&>*]:max-w-[880px]">
      <header className="grid gap-3">
        <Link
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          href={`/app/projects/${b.project.id}/scope`}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Scope & Revisions
        </Link>
        <h1 className="font-display text-2xl font-semibold">Scope history · {b.project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Every confirmed version is kept with its source. An activated baseline can’t be overwritten; material changes need the
          client’s approval through an amendment.
        </p>
      </header>
      {versions.length ? (
        <ol className="relative grid gap-6 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-sidebar-border">
          {versions.map((s) => {
            const current = s.version === b.project.scope_version;
            return (
              <li key={s.version} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3">
                <span aria-hidden className="relative z-10 mt-5 grid size-6 place-items-center rounded-full bg-background">
                  <span className={cn("size-3 rounded-full ring-4 ring-background", current ? "bg-primary" : "bg-neutral-400")} />
                </span>
                <section className={cn("grid gap-3 rounded-2xl border bg-card p-5", current ? "border-primary/40" : "border-sidebar-border")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      Version {s.version}
                      <span className={cn("ml-2 rounded-md px-2 py-0.5 text-xs font-medium", current ? "bg-accent text-primary" : "bg-sidebar-accent text-muted-foreground")}>
                        {current ? "Current baseline" : "Retained history"}
                      </span>
                    </h2>
                    {s.confirmed_at && <p className="text-sm text-muted-foreground">Confirmed {confirmed(s.confirmed_at)}</p>}
                  </div>
                  <ul className="grid gap-3">
                    {s.terms.map((t, i) => (
                      <li key={i} className="grid gap-1.5 border-t border-sidebar-border pt-3 first:border-t-0 first:pt-0">
                        <span className="text-xs font-medium text-muted-foreground">{kindLabels[t.kind] ?? t.kind}</span>
                        <p className="text-sm leading-relaxed">{t.text}</p>
                        <blockquote className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground">
                          “{t.quote}”
                          <cite className="mt-1 block text-xs not-italic">
                            Page {b.spans.find((span) => span.id === t.span_id)?.page ?? "—"}
                          </cite>
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                </section>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-sidebar-border bg-card/60 p-6 text-sm text-muted-foreground">
          No baseline confirmed. Import and review your agreement in setup.
        </p>
      )}
    </main>
  );
}
