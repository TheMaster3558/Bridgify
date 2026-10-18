import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import {
  queryList,
  listInput,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
import {
  ActivityTimeline,
  type ActivityEvent,
} from "@/components/projects/activity-timeline";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { client, user } = await requireOwner();
  const { projectId } = await params;
  const input = listInput({ ...(await searchParams), project: projectId });
  const [result, project] = await Promise.all([
    queryList(client, "activity", input),
    client.from("projects").select("timezone").eq("id", projectId).maybeSingle(),
  ]);
  const timezone = (checked(project) as { timezone?: string } | null)?.timezone || "UTC";
  return (
    <ActivityTimeline
      projectId={projectId}
      events={result.items as unknown as ActivityEvent[]}
      viewerId={user.id}
      timezone={timezone}
      now={new Date().toISOString()}
      toolbar={
        <ListControls embedded input={input} total={result.total} statuses={[]} />
      }
    />
  );
}
