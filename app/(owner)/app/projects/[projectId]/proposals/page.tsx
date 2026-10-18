import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import {
  queryList,
  listInput,
  type SearchParams,
} from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
import { ProposalsWorkspace } from "@/components/dashboard/proposals-workspace";
import type { ProposalRevisionRecord } from "@/lib/dashboard/work-management-types";
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
  const result = await queryList(client, "proposals", input);
  return (
    <ProposalsWorkspace
      key={JSON.stringify(input)}
      proposals={result.items as unknown as ProposalRevisionRecord[]}
      serverManaged
      title="Proposals"
      description="Extra work offered to this client. Approved proposals update scope, tasks and value together."
      action={
        <Link
          href={`/app/projects/${projectId}/proposals/new`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
        >
          <Plus aria-hidden className="size-4" />
          New proposal
        </Link>
      }
      toolbar={
        <ListControls
          embedded
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
          ]}
        />
      }
    />
  );
}
