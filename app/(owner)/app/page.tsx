import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { Button } from "@/components/ui/button";
export default async function Page() {
  const { client } = await requireOwner();
  const projects =
    checked(
      await client
        .from("projects")
        .select("id,name,status,setup_step")
        .order("updated_at", { ascending: false })
        .limit(5),
    ) || [];
  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-semibold">Your workspace</h1>
        <p className="mt-3 text-muted-foreground">
          Confirm the agreement and client identities before connecting
          automation.
        </p>
      </div>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">
          {projects.length ? "Recent projects" : "Create your first project"}
        </h2>
        {projects.length ? (
          <ul className="mb-5 grid gap-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  className="underline"
                  href={
                    p.status === "draft"
                      ? `/app/projects/${p.id}/setup?step=${p.setup_step}`
                      : `/app/projects/${p.id}`
                  }
                >
                  {p.name}
                </Link>
                <span className="ml-3 text-sm text-muted-foreground">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-muted-foreground">
            Start with project basics. Save each step and return whenever you
            are ready.
          </p>
        )}
        <Button asChild>
          <Link href="/app/projects/new">Create project</Link>
        </Button>
      </section>
    </main>
  );
}
