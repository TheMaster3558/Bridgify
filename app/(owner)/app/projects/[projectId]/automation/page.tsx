import { AutomationManagement } from "@/components/automation/management";
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <main className="grid gap-5 p-5 lg:p-8">
      <h1 className="text-2xl font-semibold">Automation</h1>
      <AutomationManagement projectId={(await params).projectId} />
    </main>
  );
}
