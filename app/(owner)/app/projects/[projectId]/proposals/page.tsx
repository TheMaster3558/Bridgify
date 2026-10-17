import { Banner, PageBody } from "@/components/dashboard/panel";
import { ProposalTable } from "@/components/proposals/proposal-table";
import { Panel } from "@/components/dashboard/panel";
import { proposals } from "@/lib/sample";

export const metadata = { title: "Proposals" };

export default async function ProjectProposalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const rows = proposals.filter((proposal) => proposal.projectId === projectId);

  return (
    <PageBody>
      <Banner tone="warn">
        <b>P-001 r2 awaiting the client.</b> Follow-ups are owner-reviewed.
      </Banner>
      <Panel bodyClassName="p-0">
        <ProposalTable rows={rows.length ? rows : proposals.slice(0, 2)} showProject={false} />
      </Panel>
    </PageBody>
  );
}
