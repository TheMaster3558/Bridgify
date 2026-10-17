import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { Button } from "@/components/ui/button";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { client } = await requireOwner();
  const params = await searchParams;
  const page = Math.max(1, Math.min(Number(params.page) || 1, 10000));
  let query = client
    .from("projects")
    .select(
      "id,name,client_name,status,setup_step,original_amount_cents,agreed_due_date,updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (params.q)
    query = query.ilike(
      "name",
      `%${params.q.replace(/[%_]/g, "").slice(0, 120)}%`,
    );
  if (
    [
      "draft",
      "active",
      "paused",
      "review_only",
      "completed",
      "archived",
    ].includes(params.status || "")
  )
    query = query.eq("status", params.status!);
  const result = await query;
  const projects = checked(result) || [];
  return (
    <main className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="mb-8 flex justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a project or resume saved setup.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/projects/new">Create project</Link>
        </Button>
      </div>
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          className="rounded border p-2"
          aria-label="Search project name"
          name="q"
          defaultValue={params.q}
          placeholder="Search projects"
        />
        <select
          aria-label="Project state"
          name="status"
          defaultValue={params.status || ""}
          className="rounded border p-2"
        >
          <option value="">All states</option>
          {[
            "draft",
            "active",
            "paused",
            "review_only",
            "completed",
            "archived",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="grid gap-4">
        {projects.length ? (
          projects.map((p) => (
            <Link
              key={p.id}
              href={
                p.status === "draft"
                  ? `/app/projects/${p.id}/setup?step=${p.setup_step}`
                  : `/app/projects/${p.id}`
              }
              className="grid gap-2 rounded-xl border bg-card p-5 hover:bg-accent sm:grid-cols-[1fr_auto]"
            >
              <div>
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {p.client_name} ·{" "}
                  {p.status === "draft"
                    ? `Resume setup · step ${p.setup_step}`
                    : p.status}
                </p>
              </div>
              <div className="text-sm">
                <p>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(p.original_amount_cents / 100)}{" "}
                  original agreed price
                </p>
                <p>{p.agreed_due_date || "No date agreed"}</p>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-xl border p-10">
            <h2 className="text-xl font-semibold">
              {params.q || params.status
                ? "No matching projects"
                : "Your workspace is ready"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {params.q || params.status
                ? "Try another filter."
                : "Create your first project to import an agreement and connect your client."}
            </p>
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-5 text-sm">
        {page > 1 && (
          <Link
            className="underline"
            href={`?${new URLSearchParams({ ...params, page: String(page - 1) } as Record<string, string>)}`}
          >
            Previous
          </Link>
        )}
        {(result.count || 0) > page * 25 && (
          <Link
            className="underline"
            href={`?${new URLSearchParams({ ...params, page: String(page + 1) } as Record<string, string>)}`}
          >
            Next
          </Link>
        )}
      </div>
    </main>
  );
}
