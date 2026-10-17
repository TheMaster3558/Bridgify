import Link from "next/link";
import { Banner, Field, PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { lineItems, proposals } from "@/lib/sample";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;
  return { title: `Proposal ${proposalId}` };
}

export default async function ProposalEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; proposalId: string }>;
}) {
  const { projectId, proposalId } = await params;
  const proposal = proposals.find((item) => item.id === proposalId) ?? proposals[0];

  return (
    <PageBody>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {proposal.id} · {proposal.revision}
          </p>
          <h1 className="text-2xl font-semibold">{proposal.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={proposal.businessTone}>{proposal.business}</StatusPill>
            <StatusPill tone={proposal.deliveryTone}>{proposal.delivery}</StatusPill>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline">
            Supersede
          </Button>
          <Button type="button" variant="outline">
            Withdraw
          </Button>
        </div>
      </div>
      <Banner tone="info">
        Sent terms are frozen. A new price or date creates the next revision and makes this one unapprovable.
      </Banner>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          <Panel title="Terms">
            <div className="space-y-3">
              <Field label="Title">
                <Input defaultValue={proposal.title} />
              </Field>
              <Field label="Client-facing explanation" hint="Generate wording drafts only. You decide the commercial terms.">
                <Textarea defaultValue="You asked whether customers can create accounts. This adds email-and-password accounts. Online ordering and social sign-in are not included." />
              </Field>
              <Button type="button" variant="outline" size="sm">
                Generate wording
              </Button>
            </div>
          </Panel>
          <Panel title="Deliverables" description="Additional project price · USD" bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Deliverable</TableHead>
                  <TableHead>Done means</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map(([key, title, criteria, price]) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs">{key}</TableCell>
                    <TableCell className="whitespace-normal">{title}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{criteria}</TableCell>
                    <TableCell className="text-right">{price}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={2} className="font-semibold">
                    Additional project price
                  </TableCell>
                  <TableCell className="text-right font-semibold">{proposal.amount}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Panel>
          <Panel title="Boundaries">
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="font-medium">Not included</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li>Social login</li>
                  <li>Online ordering or checkout</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Schedule</p>
                <p className="mt-1 text-muted-foreground">Agreed launch moves Nov 20 → Dec 4, 2026</p>
                <p className="mt-2">Approver: Maya Chen</p>
              </div>
            </div>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Outgoing iMessage">
            <p className="rounded-xl bg-muted p-3 text-sm">
              Amogh has prepared a proposal ({proposal.amount}). Please review and confirm the exact terms.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href={`/proposals/${proposalId}?revision=2`}>Preview client page</Link>
            </Button>
          </Panel>
          <Panel title="Value if approved">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Original price</dt><dd>$3,000</dd></div>
              <div className="flex justify-between"><dt>This proposal</dt><dd>{proposal.amount}</dd></div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Approved total after approval</dt>
                <dd>$3,600</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Project {projectId}. Agreed work value, not payment received.</p>
          </Panel>
          <div className="flex gap-2">
            <Button type="button" variant="outline">
              Save draft
            </Button>
            <Button type="button">Send</Button>
          </div>
        </div>
      </div>
    </PageBody>
  );
}
