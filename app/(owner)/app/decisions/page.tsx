import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  projectOptions,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";
import { loadClientPhotos } from "@/lib/clients/photo-urls";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { client } = await requireOwner();
  const raw = await searchParams;
  const input = listInput({ status: "open", ...raw });
  const [result, projects] = await Promise.all([
    queryList(client, "decisions", input),
    projectOptions(client),
  ]);
  const rows = result.items as unknown as OwnerDecisionRecord[];
  return (
    <>
      <ListControls
        input={input}
        total={result.total}
        statuses={["open", "all", "resolved", "dismissed"]}
        projects={projects}
      />
      <NeedsAttention
        key={JSON.stringify(input)}
        decisions={rows}
        serverManaged
        clientPhotos={await loadClientPhotos(
          client,
          rows.map((r) => r.client_name),
        )}
      />
    </>
  );
}
