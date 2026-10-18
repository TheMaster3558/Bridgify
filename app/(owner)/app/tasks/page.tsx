import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { listDashboardTasks } from "@/lib/dashboard/work-management";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { loadClientPhotos } from "@/lib/clients/photo-urls";

export const metadata: Metadata = { title: "Actionable Tasks" };

export default async function Page() {
  const { client } = await requireOwner();
  const tasks = await listDashboardTasks(client);
  const clientPhotos = await loadClientPhotos(
    client,
    tasks.map((task) => task.client_name),
  );
  return <TasksWorkspace tasks={tasks} clientPhotos={clientPhotos} />;
}
