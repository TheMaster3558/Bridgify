import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
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
  return <ProjectsList workspaceProjects={projects} />;
}
