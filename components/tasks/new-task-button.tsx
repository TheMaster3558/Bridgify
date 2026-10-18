"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Plus } from "lucide-react";
import { PanelClose } from "@/components/dashboard/table-ui";
import { TaskForm } from "./task-editor";

// Round "+" next to the Actionable Tasks filters; opens the new-task form.
export function NewTaskButton({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="New task"
        title="New task"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(37,99,235,0.35)] outline-none transition hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
      >
        <Plus aria-hidden className="size-[18px]" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="settings-dialog-scroll fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[min(560px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[28px] border bg-card p-6 shadow-xl outline-none dark:bg-background">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-medium">
                New task
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Add work to one of your active projects.
              </Dialog.Description>
            </div>
            <PanelClose label="Close" onClick={() => setOpen(false)} />
          </div>
          {projects.length ? (
            <TaskForm projects={projects} onDone={() => setOpen(false)} />
          ) : (
            <p className="rounded-xl bg-sidebar px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Activate a project before adding tasks to it.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
