import Link from "next/link";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { ProposalTable } from "@/components/proposals/proposal-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Proposals" };

export default function ProposalsPage() {
  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            Additional work offered to clients. Same list as each project’s Proposals tab.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/projects/harbor-pine/proposals/P-002">New proposal</Link>
        </Button>
      </div>
      <Panel bodyClassName="p-0">
        <ProposalTable />
      </Panel>
    </PageBody>
  );
}
