"use client";

import { taskPriorityLabel, taskStatusLabel } from "@/lib/fixtures/dashboard";
import type { Task, TaskStatus } from "@/lib/fixtures/types";
import { cn } from "@/lib/utils";

const statusClass: Record<TaskStatus, string> = {
  ready: "bg-accent text-foreground",
  in_progress: "bg-info-soft text-info",
  blocked: "bg-crit-soft text-crit",
  done: "bg-ok-soft text-ok",
  cancelled: "bg-secondary text-muted-foreground",
};

export function TaskList({
  tasks,
  onSelect,
  emptyLabel,
}: {
  tasks: Task[];
  onSelect: (taskId: string) => void;
  emptyLabel: string;
}) {
  if (tasks.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id} className="border-b last:border-b-0">
          <button
            type="button"
            onClick={() => onSelect(task.id)}
            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span>
              <span className="block font-medium">{task.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {task.id} · {taskPriorityLabel[task.priority]} priority ·{" "}
                {task.clientAgreedDate ? `Agreed ${task.clientAgreedDate}` : "No date agreed"}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                statusClass[task.status],
              )}
            >
              {taskStatusLabel[task.status]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
