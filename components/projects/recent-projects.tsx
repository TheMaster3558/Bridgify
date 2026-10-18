import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { queryList, listInput } from "@/lib/dashboard/list-query";
export async function RecentProjects() {
  const { client } = await requireOwner();
  const result = await queryList(client, "projects", listInput());
  const projects = result.items.slice(0, 5) as {
    id: string;
    name: string;
    status: string;
  }[];
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="mb-4 text-xl font-semibold">
        {projects.length ? "Recent projects" : "Create your first project"}
      </h2>
      <ul className="mb-5 grid gap-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              className="underline"
              href={`/app/projects/${p.id}${p.status === "draft" ? "/setup" : ""}`}
            >
              {p.name}
            </Link>
            <span className="ml-3 text-sm text-muted-foreground">
              {p.status}
            </span>
          </li>
        ))}
      </ul>
      <Link className="underline" href="/app/projects/new">
        Create project
      </Link>
    </section>
  );
}
