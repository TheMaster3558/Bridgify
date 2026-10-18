import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { ListControls } from "@/components/dashboard/list-controls";
import {
  queryList,
  listInput,
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
  const result = await queryList(client, "projects", input);
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
    <>
      <ListControls
        input={input}
        total={result.total}
        statuses={["all", "active", "draft", "paused", "completed", "archived"]}
      />
      <ProjectsList
        key={JSON.stringify(input)}
        serverManaged
        workspaceProjects={projects}
        pendingDecisions={pendingDecisions}
        clientPhotos={await loadClientPhotos(
          client,
          projects.map((project) => project.client_name),
        )}
      />
    </>
  );
}
