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
  const { client } = await requireOwner();
  const { projectId } = await params;
  const bundle = (await projectBundle(client, projectId)) as Bundle;
  return (
    <main className="mx-auto grid w-full max-w-[1280px] gap-5 p-5 md:p-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Automation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How Bridgify is running on this project, and anything it needs from
          you.
        </p>
      </header>
      <AutomationManagement projectId={projectId} />
      <ConnectionRecovery key={bundle.project.version} bundle={bundle} />
    </main>
  );
}
