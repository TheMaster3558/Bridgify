import { requireOwner } from "@/lib/auth/session";
import {
  listInput,
  queryList,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { TaskEditor } from "@/components/tasks/task-editor";
import type { DashboardTask } from "@/lib/dashboard/work-management-types";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { client } = await requireOwner();
  const { projectId } = await params;
  const input = listInput({ ...(await searchParams), project: projectId });
  const result = await queryList(client, "tasks", input);
  return (
    <TasksWorkspace
      key={JSON.stringify(input)}
      tasks={result.items as unknown as DashboardTask[]}
      serverManaged
      title="Work"
      description="Tasks for this project. Status changes here are used in Bridgify’s client status replies."
      toolbar={
        <ListControls
          embedded
          taskFilters
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
        />
      }
      creationForm={<TaskEditor projectId={projectId} />}
    />
  );
}
