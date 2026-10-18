"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2 } from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";
import {
  iconButton,
  menuContent,
  menuItem,
} from "@/components/dashboard/table-ui";
import {
  settingsButton,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";
export function DeleteProject({
  id,
  name,
  menu = false,
  icon = false,
  menuItems,
}: {
  id: string;
  name: string;
  menu?: boolean;
  icon?: boolean;
  menuItems?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [deleted, setDeleted] = useState<{ cleanupPending: boolean } | null>(
    null,
  );
  const busy = useRef(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  function beginDelete() {
    setConfirmation("");
    setError("");
    setDeleted(null);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    if (deleted) {
      router.push("/app/projects");
      router.refresh();
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        if (!value) {
          close();
          return;
        }
        beginDelete();
      }}
    >
      {menu ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            ref={menuTrigger}
            type="button"
            aria-label={`Project actions for ${name}`}
            className={iconButton}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              onClick={(event) => event.stopPropagation()}
              onCloseAutoFocus={(event) => {
                if (open) event.preventDefault();
              }}
              className={menuContent}
            >
              {menuItems}
              {menuItems ? (
                <DropdownMenu.Separator className="my-1 h-px bg-sidebar-border" />
              ) : null}
              <DropdownMenu.Item
                onSelect={beginDelete}
                className={cn(menuItem, "text-rose-600 dark:text-rose-400")}
              >
                <Trash2 aria-hidden className="size-4" />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <Dialog.Trigger asChild>
          {icon ? (
            <button
              type="button"
              title="Delete project"
              aria-label={`Delete project ${name}`}
              className={cn(
                settingsButton,
                "size-9 px-0 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-300",
              )}
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              className={cn(settingsButton, "text-crit hover:text-crit")}
              aria-label={`Delete project ${name}`}
            >
              Delete
            </button>
          )}
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[28px] border bg-card p-6 text-card-foreground shadow-xl outline-none dark:bg-background"
          onCloseAutoFocus={(event) => {
            if (menu) {
              event.preventDefault();
              menuTrigger.current?.focus();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
          >
            <Trash2 className="size-5" />
          </span>
          <Dialog.Title className="-mt-1 text-lg font-medium">
            {deleted ? "Project deleted" : `Delete ${name}?`}
          </Dialog.Title>
          <Dialog.Description className="-mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {deleted
              ? deleted.cleanupPending
                ? "The project was deleted. Private agreement file cleanup is pending."
                : "The project and its related records and private agreement files have been deleted."
              : "This permanently deletes the project, agreements, tasks, decisions and saved setup. This cannot be undone. Existing messages in Photon and iMessage are not deleted."}
          </Dialog.Description>
          {deleted ? (
            <button
              type="button"
              onClick={close}
              className={cn(settingsPrimaryButton, "h-9")}
            >
              Back to projects
            </button>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (confirmation !== name || busy.current) return;
                busy.current = true;
                setPending(true);
                setError("");
                try {
                  const response = await fetch(`/api/v1/projects/${id}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: confirmation }),
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(
                      result.error?.message ||
                        "Project could not be deleted. Try again.",
                    );
                  setDeleted({
                    cleanupPending: !!result.data.storageCleanupPending,
                  });
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Project could not be deleted. Try again.",
                  );
                } finally {
                  busy.current = false;
                  setPending(false);
                }
              }}
            >
              <label className="grid gap-2 text-sm font-medium">
                Type the project name to confirm
                <input
                  className="h-10 rounded-xl bg-card px-3 text-[15px] font-normal ring-1 ring-sidebar-border outline-none focus-visible:ring-[3px] focus-visible:ring-rose-500/30 disabled:opacity-60 dark:bg-sidebar"
                  placeholder={name}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={pending}
                  autoComplete="off"
                  required
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={cn(settingsButton, "h-9 px-3.5")}
                  onClick={close}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || confirmation !== name}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-600 px-3.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(225,29,72,0.35)] outline-none hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-rose-500/40 disabled:pointer-events-none disabled:opacity-50"
                >
                  {pending ? "Deleting…" : "Delete project permanently"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
