import { TaskEditor } from "@/components/tasks/task-editor";
import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  projectOptions,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
import { loadClientPhotos } from "@/lib/clients/photo-urls";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { client } = await requireOwner();
  const raw = await searchParams;
  const input = listInput({ ...raw });
  const [result, projects] = await Promise.all([
    queryList(client, "tasks", input),
    projectOptions(client),
  ]);
  const rows = result.items as unknown as DashboardTask[];
  return (
    <>
      <ListControls
        input={input}
        total={result.total}
        statuses={[
          "all",
          "ready",
          "in_progress",
          "blocked",
          "done",
          "cancelled",
        ]}
        projects={projects}
      />
      <TasksWorkspace
        key={JSON.stringify(input)}
        creationForm={<TaskEditor projects={projects.filter(p => ["active","review_only"].includes(p.status))}/>}
        tasks={rows}
        serverManaged
        clientPhotos={await loadClientPhotos(
          client,
          rows.map((r) => r.client_name),
        )}
      />
    </>
  );
}
