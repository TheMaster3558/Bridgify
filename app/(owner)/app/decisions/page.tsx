import { checked } from "@/lib/api";
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
  const selectedId=typeof raw.decision==="string"?raw.decision:undefined;
  if(selectedId&&!rows.some(r=>r.id===selectedId)){
    const selected=checked(await client.from("owner_decisions").select("*,projects!inner(name,client_name)").eq("id",selectedId).maybeSingle());
    if(selected)rows.unshift({...selected,project_name:selected.projects.name,client_name:selected.projects.client_name} as OwnerDecisionRecord);
  }
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
        initialDecisionId={selectedId}
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
