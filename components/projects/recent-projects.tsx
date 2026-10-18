"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { projectTitle } from "@/lib/projects/draft";
import { useHydrated, useProjectList } from "@/lib/projects/use-projects";

export function RecentProjects() {
  const hydrated = useHydrated();
  const list = useProjectList();
  const projects = list.ok
    ? [...list.data].sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? "")).slice(0, 5)
    : [];
  const heading = !hydrated || !list.ok || projects.length ? "Recent projects" : "Create your first project";

  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="mb-4 text-xl font-semibold">{heading}</h2>
      {!hydrated ? <div className="mb-5 h-16 animate-pulse rounded-md bg-muted" /> : null}
      {hydrated && !list.ok ? (
        <p className="mb-5 text-sm" role="alert">
          {list.error}
        </p>
      ) : null}
      {hydrated && list.ok && projects.length > 0 ? (
        <ul className="mb-5 grid gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link className="underline" href={`/app/projects/new?project=${project.id}`}>
                {projectTitle(project)}
              </Link>
              <span className="ml-3 text-sm text-muted-foreground">{project.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {hydrated && list.ok && projects.length === 0 ? (
        <p className="mb-5 text-muted-foreground">
          Start with project basics. Save each step and return whenever you are ready.
        </p>
      ) : null}
      <Button asChild>
        <Link href="/app/projects/new">Create project</Link>
      </Button>
    </section>
  );
}
