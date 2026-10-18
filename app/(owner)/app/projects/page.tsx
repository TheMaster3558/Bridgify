import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
import {
  queryList,
  listInput,
  optionCounts,
  PAGE_SIZE,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { checked } from "@/lib/api";
import { loadClientPhotos } from "@/lib/clients/photo-urls";
import {
  ProjectsList,
  type WorkspaceProject,
} from "@/components/projects/projects-list";

export const metadata: Metadata = { title: "Projects" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { client } = await requireOwner();
  const input = listInput(await searchParams);
  const states = ["all", "active", "draft", "paused", "completed", "archived"];
  const [result, counts] = await Promise.all([
    queryList(client, "projects", input),
    optionCounts(client, "projects", input, "status", states),
  ]);
  const projects = result.items as unknown as WorkspaceProject[];
  const ids = projects.map((project) => project.id);
  const openDecisions = ids.length
    ? ((checked(
        await client
          .from("owner_decisions")
          .select("project_id")
          .in("project_id", ids)
          .in("status", ["open", "reviewing"])
          .is("deleted_at", null),
      ) as { project_id: string }[] | null) ?? [])
    : [];
  const pendingDecisions: Record<string, number> = {};
  for (const { project_id } of openDecisions)
    pendingDecisions[project_id] = (pendingDecisions[project_id] ?? 0) + 1;
  return (
    <ProjectsList
      key={JSON.stringify(input)}
      serverManaged
      toolbar={
        <ListToolbar
          values={input}
          pills={{
            param: "status",
            label: "Filter by state",
            options: states.map((id) => ({
              id,
              label: id.charAt(0).toUpperCase() + id.slice(1),
              count: counts[id],
            })),
          }}
          search={{ placeholder: "Search by name" }}
          page={input.page}
          pageSize={PAGE_SIZE}
          total={result.total}
        />
      }
      workspaceProjects={projects}
      pendingDecisions={pendingDecisions}
      clientPhotos={await loadClientPhotos(
        client,
        projects.map((project) => project.client_name),
      )}
    />
  );
}
