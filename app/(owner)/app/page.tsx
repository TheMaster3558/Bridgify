import Link from "next/link";
import { Banner, PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { decisions, tasks } from "@/lib/sample";

export const metadata = { title: "Home" };

const handled = [
  ["Accepted", "Change homepage heading to green", "R-1 → T-107"],
  ["Clarifying", "Asked which homepage text and new wording", "R-4 · turn 1 of 2"],
  ["Answered", "Heading status: in progress, no date", "R-10 · from T-107"],
  ["Ignored", "Casual thanks", "No reply by policy"],
];

export default function HomePage() {
  const ready = tasks.filter((task) => task.status === "Ready").length;

  return (
    <PageBody>
      <div>
        <h1 className="text-2xl font-semibold">Good morning, Amogh</h1>
        <p className="text-sm text-muted-foreground">
          Friday, October 16 · 8 decisions need you. Routine accepted work is already on the task list.
        </p>
      </div>
      <Banner
        tone="crit"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/decisions">Inspect delivery</Link>
          </Button>
        }
      >
        <b>1 message may not have reached the client.</b> The acknowledgment for “finish by Nov 10”
        timed out after sending.
      </Banner>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["/app/tasks", String(ready), "Ready tasks", "ok"],
          ["/app/decisions", "8", "Decisions needed", "warn"],
          ["/app/proposals", "1", "Awaiting client approval", "neutral"],
          ["/app/settings", "2", "Automation / integration issues", "crit"],
        ].map(([href, value, label, tone]) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border bg-card px-4 py-3 hover:border-primary"
          >
            <p
              className={`font-display text-3xl font-semibold ${
                tone === "warn" ? "text-warn" : tone === "crit" ? "text-crit" : ""
              }`}
            >
              {value}
            </p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title="Needs your decision"
          description="Exceptions only. Routine accepted work goes to Actionable Tasks."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/decisions">Open all</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul>
            {decisions.map((decision) => (
              <li key={decision.id} className="flex items-start justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                <div>
                  <p className="font-medium">{decision.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {decision.reason} · Harbor & Pine · {decision.age} ago
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/decisions">Open decision</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title="Handled automatically"
          description="No response needed."
          bodyClassName="p-0"
        >
          <ul>
            {handled.map(([state, title, detail]) => (
              <li key={title} className="flex items-start justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
                <StatusPill tone={state === "Accepted" ? "ok" : "neutral"}>{state}</StatusPill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel
        title="Work next"
        description="Ready and in-progress tasks."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/tasks">Open Work</Link>
          </Button>
        }
        bodyClassName="p-0"
      >
        <TaskTable rows={tasks.filter((task) => task.status === "Ready" || task.status === "In progress")} />
      </Panel>
    </PageBody>
  );
}
