import { requireOwner } from "@/lib/auth/session";
import { ProjectConversation } from "@/components/projects/project-conversation";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireOwner();
  const { projectId } = await params;
  return <ProjectConversation key={projectId} projectId={projectId} />;
}
