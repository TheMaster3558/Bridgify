import Link from "next/link";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { proposals } from "@/lib/sample";

export function ProposalTable({
  rows = proposals,
  showProject = true,
}: {
  rows?: typeof proposals;
  showProject?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Title</TableHead>
          {showProject ? <TableHead>Project</TableHead> : null}
          <TableHead>Revision</TableHead>
          <TableHead>Additional price</TableHead>
          <TableHead>Business status</TableHead>
          <TableHead>Delivery</TableHead>
          <TableHead>Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((proposal) => (
          <TableRow key={`${proposal.id}-${proposal.revision}`}>
            <TableCell className="font-mono text-xs">{proposal.id}</TableCell>
            <TableCell className="whitespace-normal">
              <Link
                href={`/app/projects/${proposal.projectId}/proposals/${proposal.id}`}
                className="font-medium hover:underline"
              >
                {proposal.title}
              </Link>
            </TableCell>
            {showProject ? <TableCell>{proposal.project}</TableCell> : null}
            <TableCell className="font-mono text-xs">{proposal.revision}</TableCell>
            <TableCell>{proposal.amount}</TableCell>
            <TableCell>
              <StatusPill tone={proposal.businessTone}>{proposal.business}</StatusPill>
            </TableCell>
            <TableCell>
              <StatusPill tone={proposal.deliveryTone}>{proposal.delivery}</StatusPill>
            </TableCell>
            <TableCell className="text-muted-foreground">{proposal.sent}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
