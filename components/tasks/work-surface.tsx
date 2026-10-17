"use client";

import { useState } from "react";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { tasks } from "@/lib/sample";
import { cn } from "@/lib/utils";

const filters = ["All", "Ready", "In progress", "Blocked", "Done"] as const;
const columns = ["Ready", "In progress", "Blocked", "Done"] as const;

export function WorkSurface({
  heading,
  showProject = false,
}: {
  heading: { title: string; description: string } | null;
  showProject?: boolean;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [view, setView] = useState<"list" | "board">("list");
  const rows = tasks.filter((task) => filter === "All" || task.status === filter);

  return (
    <PageBody>
      {heading ? (
        <div>
          <h1 className="text-2xl font-semibold">{heading.title}</h1>
          <p className="text-sm text-muted-foreground">{heading.description}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                filter === item ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>
            List
          </Button>
          <Button type="button" variant={view === "board" ? "default" : "outline"} onClick={() => setView("board")}>
            Board
          </Button>
          <Button type="button">New task</Button>
        </div>
      </div>
      {view === "list" ? (
        <Panel bodyClassName="p-0">
          <TaskTable rows={rows} showProject={showProject} />
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {rows.length} tasks · proposed work stays in Proposals until approved
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-4">
          {columns.map((column) => (
            <div key={column} className="min-w-48 rounded-lg bg-muted p-3">
              <h2 className="mb-2 flex justify-between text-sm">
                {column}
                <span className="text-muted-foreground">
                  {tasks.filter((task) => task.status === column).length}
                </span>
              </h2>
              <div className="space-y-2">
                {tasks
                  .filter((task) => task.status === column)
                  .map((task) => (
                    <div key={task.id} className="rounded-md border bg-card p-3 text-sm">
                      <p>{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{task.origin}</p>
                      <StatusPill tone={task.tone} className="mt-2">
                        {task.status}
                      </StatusPill>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageBody>
  );
}
