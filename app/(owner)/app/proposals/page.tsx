import Link from "next/link";
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
import { clientKey } from "@/lib/clients/photos";
import { ProposalsWorkspace } from "@/components/dashboard/proposals-workspace";
import type { ProposalRevisionRecord } from "@/lib/dashboard/work-management-types";
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
    ["draft", "Draft"],
    ["awaiting_client", "Awaiting client"],
    ["approved", "Approved"],
    ["closed", "Closed"],
  ] as const;
  const [result, projects, counts] = await Promise.all([
    queryList(client, "proposals", input),
    projectOptions(client),
    optionCounts(
      client,
      "proposals",
      input,
      "status",
      statuses.map(([id]) => id),
    ),
  ]);
  const projectPhotos = await loadClientPhotos(
    client,
    projects.map((p) => p.client_name),
  );
  const rows = result.items as unknown as ProposalRevisionRecord[];
  return (
    <ProposalsWorkspace
      key={JSON.stringify(input)}
      proposals={rows}
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
          search={{ placeholder: "Search proposals" }}
          selects={[
            {
              param: "project",
              label: "Project filter",
              options: [
                { id: "all", label: "All projects" },
                ...projects.map((p) => ({
                  id: p.id,
                  label: p.name,
                  avatar: {
                    name: p.client_name,
                    src: projectPhotos[clientKey(p.client_name)],
                  },
                })),
              ],
            },
          ]}
          page={input.page}
          pageSize={PAGE_SIZE}
          total={result.total}
          aside={
            <Link
              href="/app/projects"
              className="text-sm text-neutral-500 underline-offset-4 hover:text-foreground hover:underline dark:text-neutral-400"
            >
              New proposals start from a project
            </Link>
          }
        />
      }
      clientPhotos={await loadClientPhotos(
        client,
        rows.map((r) => r.client_name),
      )}
    />
  );
}
