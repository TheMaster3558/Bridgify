import Link from "next/link";
import { Banner, Field, PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tasks } from "@/lib/sample";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return { title: taskId };
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const task = tasks.find((item) => item.id === taskId) ?? tasks[0];

  return (
    <PageBody className="max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{task.id}</p>
          <h1 className="text-2xl font-semibold">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusPill tone={task.tone}>{task.status}</StatusPill>
            <span>{task.priority} priority</span>
            <span>{task.assignee}</span>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/app/tasks">Close</Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button">{task.status === "Ready" ? "Start task" : "Mark done"}</Button>
        <Button type="button" variant="outline">
          Mark blocked
        </Button>
        <Button type="button" variant="outline">
          Cancel task
        </Button>
      </div>
      {task.status === "Ready" ? (
        <Banner tone="info">
          Starting moves this task’s revision unit from reserved to consumed. This happens once.
        </Banner>
      ) : null}
      <Panel title="Requested change">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Accepted via</dt>
          <dd>{task.origin}</dd>
          <dt className="text-muted-foreground">Agreed date</dt>
          <dd>{task.date ?? "No date agreed"}</dd>
          <dt className="text-muted-foreground">Acceptance</dt>
          <dd>Matches the requested change on the confirmed target.</dd>
        </dl>
      </Panel>
      <Panel title="Internal notes">
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Internal · never shared with the client.
        </p>
        <Textarea className="mt-3" placeholder="Add an internal note" />
      </Panel>
      <Panel title="Complete task">
        <div className="space-y-3">
          <Field label="What was done">
            <Textarea defaultValue="Record the owner’s statement of what changed." />
          </Field>
          <Field
            label="Public completion note"
            hint="The assistant says “marked complete by the project owner.”"
          >
            <Textarea defaultValue="This item is marked complete by the project owner." />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" />
            <span>Notify client in iMessage. Off by default.</span>
          </label>
          <Button type="button">Mark done</Button>
        </div>
      </Panel>
    </PageBody>
  );
}
