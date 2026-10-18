import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { client } = await requireOwner();
  const { taskId } = await params;
  const row = checked(
    await client
      .from("project_tasks")
      .select("*,projects!inner(name,client_name)")
      .eq("id", taskId)
      .maybeSingle(),
  );
  if (!row) notFound();
  const task = {
    ...row,
    project_name: row.projects.name,
    client_name: row.projects.client_name,
  } as DashboardTask;
  return <TasksWorkspace tasks={[task]} initialTaskId={task.id} />;
}
