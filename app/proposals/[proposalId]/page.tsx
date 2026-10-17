import { ClientProposal } from "@/components/proposals/client-proposal";

export const metadata = { title: "Proposal" };

export default async function ClientProposalPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;
  return <ClientProposal proposalId={proposalId} />;
}
