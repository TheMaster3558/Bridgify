import type { Metadata } from "next";
import { ProposalsWorkspace } from "@/components/dashboard/proposals-workspace";
import { requireOwner } from "@/lib/auth/session";
import { listProposalRevisions } from "@/lib/dashboard/work-management";
import { loadClientPhotos } from "@/lib/clients/photo-urls";

export const metadata: Metadata = { title: "Proposals" };

export default async function Page() {
  const { client } = await requireOwner();
  const proposals = await listProposalRevisions(client);
  const clientPhotos = await loadClientPhotos(
    client,
    proposals.map((proposal) => proposal.client_name),
  );
  return (
    <ProposalsWorkspace proposals={proposals} clientPhotos={clientPhotos} />
  );
}
