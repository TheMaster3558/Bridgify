import { TaskEditor } from "@/components/tasks/task-editor";
import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  projectOptions,
  optionCounts,
  PAGE_SIZE,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListToolbar } from "@/components/dashboard/list-toolbar";
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
  const statuses = [
    ["all", "All"],
    ["ready", "Ready"],
    ["in_progress", "In progress"],
    ["blocked", "Blocked"],
    ["done", "Done"],
    ["cancelled", "Cancelled"],
  ] as const;
  const [result, projects, counts] = await Promise.all([
    queryList(client, "tasks", input),
    projectOptions(client),
    optionCounts(
      client,
      "tasks",
      input,
      "status",
      statuses.map(([id]) => id),
    ),
  ]);
  const rows = result.items as unknown as DashboardTask[];
  return (
    <TasksWorkspace
      key={JSON.stringify(input)}
      creationForm={
        <TaskEditor
          projects={projects.filter((p) =>
            ["active", "review_only"].includes(p.status),
          )}
        />
      }
      tasks={rows}
      serverManaged
      toolbar={
        <ListToolbar
          values={input}
          pills={{
            param: "status",
            label: "Filter by status",
            options: statuses.map(([id, label]) => ({
              id,
              label,
              count: counts[id],
            })),
          }}
          search={{ placeholder: "Search tasks" }}
          compact
          selects={[
            {
              param: "project",
              label: "Project filter",
              options: [
                { id: "all", label: "All projects" },
                ...projects.map((p) => ({ id: p.id, label: p.name })),
              ],
            },
          ]}
          page={input.page}
          pageSize={PAGE_SIZE}
          total={result.total}
        />
      }
      clientPhotos={await loadClientPhotos(
        client,
        rows.map((r) => r.client_name),
      )}
    />
  );
}
