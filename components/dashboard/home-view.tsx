"use client";

import Link from "next/link";
import { DecisionResolutionPanel } from "@/components/requests/decision-panel";
import { DecisionList } from "@/components/requests/decision-list";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { TaskList } from "@/components/tasks/task-list";
import { useReviewSelection } from "@/components/dashboard/use-review-selection";

function QueueCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function HomeView() {
  const review = useReviewSelection();
  const healthLabel = review.integrationHealthy ? "All systems operational" : "iMessage disconnected";

  const cards = [
    {
      href: "/app/tasks",
      value: String(review.actionableTasks.length),
      label: "Actionable Tasks",
    },
    {
      href: "/app/decisions",
      value: String(review.decisions.length),
      label: "Needs Your Decision",
    },
    {
      href: "/app/proposals",
      value: String(review.awaitingApprovalCount),
      label: "Awaiting Client Approval",
    },
    {
      href: "/app/settings",
      value: healthLabel,
      label: "Integration Health",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-sm text-muted-foreground">
          Daily digest for {review.project.clientName}. Counts come from the selected project.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border bg-card px-4 py-3 hover:border-primary focus-visible:border-primary"
          >
            <p className="font-display text-2xl font-semibold">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.label}</p>
          </Link>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <QueueCard title="Actionable tasks" description="Ready, in progress, and blocked work.">
          <TaskList
            tasks={review.actionableTasks}
            onSelect={review.openTask}
            emptyLabel="No actionable tasks for this project."
          />
        </QueueCard>
        <QueueCard title="Needs attention" description="Exceptions waiting for an owner decision.">
          <DecisionList
            decisions={review.decisions}
            onSelect={review.openDecision}
            emptyLabel="Nothing needs a decision."
          />
        </QueueCard>
      </div>
      <TaskDetailPanel task={review.task} onClose={review.closePanel} />
      <DecisionResolutionPanel decision={review.decision} onClose={review.closePanel} />
    </div>
  );
}

export function TasksView() {
  const review = useReviewSelection();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Actionable Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {review.project.name}. Open a task to compare the internal target with the client-agreed date.
        </p>
      </div>
      <QueueCard title="Tasks" description="Includes completed work so the source message stays available.">
        <TaskList
          tasks={review.tasks}
          onSelect={review.openTask}
          emptyLabel="No tasks for this project."
        />
      </QueueCard>
      <TaskDetailPanel task={review.task} onClose={review.closePanel} />
    </div>
  );
}

export function DecisionsView() {
  const review = useReviewSelection();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Needs Attention</h1>
        <p className="text-sm text-muted-foreground">
          {review.project.name}. Resolutions on this screen are a preview and do not send a message.
        </p>
      </div>
      <QueueCard title="Decisions" description="Filter is the project selected in the header.">
        <DecisionList
          decisions={review.decisions}
          onSelect={review.openDecision}
          emptyLabel="Nothing needs a decision."
        />
      </QueueCard>
      <DecisionResolutionPanel decision={review.decision} onClose={review.closePanel} />
    </div>
  );
}
