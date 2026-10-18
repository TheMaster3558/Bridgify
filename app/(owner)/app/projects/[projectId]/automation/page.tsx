import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import type { Bundle } from "@/lib/domain/types";
import { ConnectionRecovery } from "@/components/setup/connection-recovery";
import { AutomationManagement } from "@/components/automation/management";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const {client}=await requireOwner();const {projectId}=await params;const bundle=await projectBundle(client,projectId) as Bundle;
  return (
    <main className="grid gap-5 p-5 lg:p-8">
      <h1 className="text-2xl font-semibold">Automation</h1>
      <ConnectionRecovery key={bundle.project.version} bundle={bundle}/><AutomationManagement projectId={projectId} />
    </main>
  );
}
