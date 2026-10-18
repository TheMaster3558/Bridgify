import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { loadClientPhotos } from "@/lib/clients/photo-urls";
import {
  ProjectsList,
  type WorkspaceProject,
} from "@/components/projects/projects-list";

export const metadata: Metadata = { title: "Projects" };

export default async function Page() {
  const { client } = await requireOwner();
  const projects =
    (checked(
      await client
        .from("projects")
        .select(
          "id,name,client_name,status,setup_step,original_amount_cents,currency,agreed_due_date,policy,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(25),
    ) as WorkspaceProject[] | null) || [];
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
      workspaceProjects={projects}
      pendingDecisions={pendingDecisions}
      clientPhotos={await loadClientPhotos(
        client,
        projects.map((project) => project.client_name),
      )}
    />
  );
}
