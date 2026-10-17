import Link from "next/link";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { decisions, projectById, tasks } from "@/lib/sample";

export const metadata = { title: "Overview" };

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = projectById(projectId);

  return (
    <PageBody>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Project">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd>{project.client}</dd>
            <dt className="text-muted-foreground">Requester</dt>
            <dd>{project.contact}</dd>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>Amogh</dd>
            <dt className="text-muted-foreground">Agreed launch</dt>
            <dd>{project.nextDate}</dd>
            <dt className="text-muted-foreground">Scope</dt>
            <dd>v1 baseline</dd>
            <dt className="text-muted-foreground">Automation</dt>
            <dd>{project.automation}</dd>
          </dl>
        </Panel>
        <Panel title="Approved value">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Original price</dt><dd>{project.value}</dd></div>
            <div className="flex justify-between"><dt>Approved additions</dt><dd>$0</dd></div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <dt>Approved total</dt><dd>{project.value}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Agreed work value. Not an invoice or payment.</p>
        </Panel>
        <Panel title="Revisions" action={<StatusPill tone="crit">0 of 2 available</StatusPill>}>
          <div className="flex h-3 overflow-hidden rounded-full border">
            <span className="w-1/2 bg-muted-foreground" />
            <span className="w-1/2 bg-primary" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Consumed 1 · Reserved 1 · Available 0</p>
          <p className="mt-3 text-sm">Photon connected · last event 9:14 AM</p>
        </Panel>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          title="Ready work and blockers"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/projects/${projectId}/work`}>Open Work</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <TaskTable rows={tasks.filter((task) => task.status !== "Done")} showProject={false} />
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title="Open decisions" bodyClassName="p-0">
            <ul>
              {decisions.slice(0, 3).map((decision) => (
                <li key={decision.id} className="border-b px-4 py-3 text-sm last:border-b-0">
                  <p className="font-medium">{decision.title}</p>
                  <p className="text-xs text-muted-foreground">{decision.reason}</p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Pending proposals" bodyClassName="space-y-2 text-sm">
            <p>P-001 r2 · Customer accounts · $600</p>
            <p className="text-muted-foreground">P-002 r1 · Google sign-in · draft</p>
          </Panel>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/app/projects/${projectId}/scope`}>View scope</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/app/projects/${projectId}/automation`}>Configure automation</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageBody>
  );
}
