import Link from "next/link";
import { AutomationManagement } from "@/components/automation/management";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <main className="grid gap-5 p-5 lg:p-8">
      <h1 className="text-2xl font-semibold">Scope & Revisions</h1>
      <Link
        className="underline"
        href={`/app/projects/${projectId}/scope/history`}
      >
        Read confirmed agreement and scope history
      </Link>
      <AutomationManagement projectId={projectId} accountingOnly />
    </main>
  );
}
