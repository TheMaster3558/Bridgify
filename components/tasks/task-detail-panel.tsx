"use client";

import { SlideOver } from "@/components/dashboard/slide-over";
import { taskPriorityLabel, taskStatusLabel } from "@/lib/fixtures/dashboard";
import type { Task } from "@/lib/fixtures/types";

function DateFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export function TaskDetailPanel({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <SlideOver
      open={task !== null}
      title={task?.title ?? "Task"}
      description={task ? `${task.id} · ${taskStatusLabel[task.status]}` : undefined}
      onClose={onClose}
    >
      {task ? (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1 text-sm font-medium">{taskStatusLabel[task.status]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Priority</dt>
              <dd className="mt-1 text-sm font-medium">{taskPriorityLabel[task.priority]}</dd>
            </div>
          </dl>
          <div className="grid gap-3">
            <DateFact label="Internal target" value={task.internalTargetDate ?? "No internal target"} />
            <DateFact label="Client-agreed date" value={task.clientAgreedDate ?? "No date agreed"} />
          </div>
          <section>
            <h3 className="text-sm font-semibold">Client message history</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Simulated preview. These messages are fixture copy, not a live iMessage thread.
            </p>
            <ol className="mt-3 space-y-3">
              {task.messageHistory.map((message) => (
                <li key={message.id} className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {message.author} · {message.at}
                  </p>
                  <p className="mt-1 text-sm">{message.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </SlideOver>
  );
}
