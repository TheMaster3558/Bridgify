import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectWizard } from "@/components/projects/project-wizard";

export const metadata: Metadata = { title: "New project" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
        </main>
      }
    >
      <ProjectWizard />
    </Suspense>
  );
}
