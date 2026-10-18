import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { checked } from "@/lib/api";
import { requestStates } from "@/lib/dashboard/request-labels";
import { ListControls } from "@/components/dashboard/list-controls";
import {
  RequestsInbox,
  type InboxRequest,
} from "@/components/projects/requests-inbox";
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
  const [result, project, ...counts] = await Promise.all([
    queryList(client, "requests", input),
    client
      .from("projects")
      .select("client_name,people")
      .eq("id", projectId)
      .maybeSingle(),
    ...requestStates.map((s) =>
      client
        .from("automation_requests")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("state", s.id),
    ),
  ]);
  const row = checked(project) as {
    client_name: string;
    people: { client_name?: string } | null;
  } | null;
  return (
    <RequestsInbox
      projectId={projectId}
      clientName={row?.people?.client_name || row?.client_name || "the client"}
      requests={result.items as unknown as InboxRequest[]}
      counts={Object.fromEntries(
        requestStates.map((s, i) => {
          checked(counts[i]);
          return [s.id, counts[i].count ?? 0];
        }),
      )}
      status={input.status}
      query={input.q}
      toolbar={
        <ListControls
          embedded
          hideStatus
          input={input}
          total={result.total}
          statuses={[]}
        />
      }
    />
  );
}
