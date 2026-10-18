import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  projectOptions,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
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
  const [result, projects] = await Promise.all([
    queryList(client, "proposals", input),
    projectOptions(client),
  ]);
  const rows = result.items as unknown as ProposalRevisionRecord[];
  return (
    <>
      <p className="px-6 pt-6 text-sm">
        Create proposals from a project’s Proposals tab or an owner decision.{" "}
        <Link className="underline" href="/app/projects">
          Choose project
        </Link>
      </p>
      <ListControls
        input={input}
        total={result.total}
        statuses={[
          "all",
          "draft",
          "awaiting_client",
          "approved",
          "declined",
          "changes_requested",
          "withdrawn",
          "superseded",
          "expired",
        ]}
        projects={projects}
      />
      <ProposalsWorkspace
        key={JSON.stringify(input)}
        proposals={rows}
        serverManaged
        clientPhotos={await loadClientPhotos(
          client,
          rows.map((r) => r.client_name),
        )}
      />
    </>
  );
}
