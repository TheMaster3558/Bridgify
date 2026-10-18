"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function DeleteProject({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [deleted, setDeleted] = useState<{ cleanupPending: boolean } | null>(
    null,
  );
  const busy = useRef(false);
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
        setConfirmation("");
        setError("");
        setDeleted(null);
        setOpen(true);
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete project ${name}`}
        >
          Delete
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-xl"
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <Dialog.Title className="text-xl font-semibold">
            {deleted ? "Project deleted" : `Delete ${name}?`}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            {deleted
              ? deleted.cleanupPending
                ? "The project was deleted. Private agreement file cleanup is pending."
                : "The project and its related records and private agreement files have been deleted."
              : "This permanently deletes the project, agreements, tasks, decisions and saved setup. This cannot be undone. Existing messages in Photon and iMessage are not deleted."}
          </Dialog.Description>
          {deleted ? (
            <Button onClick={close}>Back to projects</Button>
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
              <label className="grid gap-2 text-sm">
                Type the project name to confirm
                <Input
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
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending || confirmation !== name}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {pending ? "Deleting…" : "Delete project permanently"}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
