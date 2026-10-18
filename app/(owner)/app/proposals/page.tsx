import type { Metadata } from "next";
import { ProposalsWorkspace } from "@/components/dashboard/proposals-workspace";
import { requireOwner } from "@/lib/auth/session";
import { listProposalRevisions } from "@/lib/dashboard/work-management";

export const metadata: Metadata = { title: "Proposals" };

export default async function Page() {
  const { client } = await requireOwner();
  const proposals = await listProposalRevisions(client);
  return <ProposalsWorkspace proposals={proposals} />;
}
