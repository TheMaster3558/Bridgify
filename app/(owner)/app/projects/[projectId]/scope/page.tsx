import { PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exclusions, inclusions } from "@/lib/sample";

export const metadata = { title: "Scope & Revisions" };

export default function ScopePage() {
  return (
    <PageBody>
      <Tabs defaultValue="agreement">
        <TabsList>
          <TabsTrigger value="agreement">Agreement</TabsTrigger>
          <TabsTrigger value="current">Current scope</TabsTrigger>
          <TabsTrigger value="revisions">Revision allowance</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>
        <TabsContent value="agreement" className="mt-4">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Agreement preview" description="Text PDF · baseline confirmed">
              <div className="space-y-2 font-mono text-xs leading-6">
                <p>Website design and development agreement.</p>
                <p>Fixed fee of $3,000 USD.</p>
                <p>Two revisions, each counted as one accepted change request.</p>
                <p>Target launch: November 20, 2026.</p>
              </div>
            </Panel>
            <Panel title="Confirmed extraction" action={<StatusPill tone="ok">Confirmed</StatusPill>}>
              <ul className="space-y-2 text-sm">
                {inclusions.map(([item, source]) => (
                  <li key={item} className="border-l-4 border-primary bg-muted px-3 py-2">
                    {item}
                    <span className="mt-1 block text-xs text-muted-foreground">{source}</span>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" size="sm" className="mt-3">
                Record audited correction
              </Button>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="current" className="mt-4 space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Included" bodyClassName="p-0">
              <ul>
                {inclusions.map(([item, source]) => (
                  <li key={item} className="flex justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                    <span>{item}</span>
                    <span className="font-mono text-xs text-muted-foreground">{source}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Explicitly excluded" bodyClassName="p-0">
              <ul>
                {exclusions.map(([item, source]) => (
                  <li key={item} className="flex justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                    <span>{item}</span>
                    <span className="font-mono text-xs text-muted-foreground">{source}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <Panel title="Confirmed automation targets" bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Operations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs">home.hero.heading</TableCell>
                  <TableCell>Home</TableCell>
                  <TableCell>change_color, replace_text</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">home.hero.subtext</TableCell>
                  <TableCell>Home</TableCell>
                  <TableCell>change_color, replace_text</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>
        <TabsContent value="revisions" className="mt-4">
          <Panel title="Revision allowance" description="Counting: per accepted request" action={<StatusPill tone="crit">0 available</StatusPill>}>
            <div className="flex h-3 overflow-hidden rounded-full border">
              <span className="w-1/2 bg-muted-foreground" />
              <span className="w-1/2 bg-primary" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Total 2 · Consumed 1 · Reserved 1 · Available 0</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" size="sm">
                Adjust entitlement
              </Button>
              <Button type="button" variant="outline" size="sm">
                Record waiver
              </Button>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="versions" className="mt-4">
          <Panel bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Confirmed by</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>v1</TableCell>
                  <TableCell>Agreement PDF</TableCell>
                  <TableCell>Amogh</TableCell>
                  <TableCell>Baseline inclusions and exclusions</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">v2</TableCell>
                  <TableCell className="text-muted-foreground">P-001 r2, if approved</TableCell>
                  <TableCell className="text-muted-foreground">Maya Chen</TableCell>
                  <TableCell className="text-muted-foreground">Customer accounts · +$600</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
