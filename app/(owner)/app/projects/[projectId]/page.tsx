import { workSummary,revisionSummary } from "@/lib/dashboard/summary";
import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import { ProjectOverview } from "@/components/projects/project-overview";
import type { Bundle } from "@/lib/domain/types";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { client, user } = await requireOwner();
  const bundle = (await projectBundle(
    client,
    (await params).projectId,
  )) as Bundle;
  const name = user.user_metadata?.display_name;
  return (
    <ProjectOverview
      bundle={bundle}
      summary={await workSummary(client,bundle.project.id)}
      accounting={await revisionSummary(client,bundle.project.id)}
      owner={typeof name === "string" ? name : user.email || ""}
    />
  );
}
