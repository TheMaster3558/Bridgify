"use client";
import { useRef, useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PhotonUser } from "@/lib/photon/spectrum";
export function DeletePhotonUser({
  projectId,
  user,
  disabled,
  connected,
  onDeleted,
  onBusyChange,
}: {
  projectId: string;
  user: PhotonUser;
  disabled: boolean;
  connected: boolean;
  onDeleted: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [phone, setPhone] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    trigger = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            type="button"
            disabled={disabled}
            aria-label={`User actions for ${user.name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={5}
            className="z-50 min-w-44 max-w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            onCloseAutoFocus={(e) => {
              if (open) e.preventDefault();
            }}
          >
            <DropdownMenu.Item
              disabled={connected}
              className="cursor-pointer rounded-sm px-3 py-2 text-sm text-destructive outline-none focus:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50"
              onSelect={() => {
                setPhone("");
                setError("");
                setOpen(true);
              }}
            >
              Delete user
            </DropdownMenu.Item>
            {connected && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Switch this project&apos;s client before deleting this user.
              </p>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
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
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <Dialog.Title className="text-xl font-semibold">
            Delete {user.name} from Photon?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            Remove {user.phoneNumber} from your Photon users list. This affects
            your Photon project, not just this draft. Users linked to any
            Bridgify project must be disconnected first. This does not erase
            existing iMessage messages.
          </Dialog.Description>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                busy.current ||
                disabled ||
                connected ||
                phone !== user.phoneNumber
              )
                return;
              busy.current = true;
              setPending(true);
              onBusyChange(true);
              setError("");
              try {
                const response = await fetch(
                  `/api/v1/integrations/photon/users/${encodeURIComponent(user.id)}`,
                  {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId, phoneNumber: phone }),
                  },
                );
                const result = await response.json();
                if (!response.ok)
                  throw new Error(
                    result.error?.message ||
                      "Deletion could not be confirmed. Refresh the list or retry.",
                  );
                setOpen(false);
                onDeleted(user.id);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Deletion could not be confirmed. Refresh the list or retry.",
                );
              } finally {
                busy.current = false;
                setPending(false);
                onBusyChange(false);
              }
            }}
          >
            <label className="grid gap-2 text-sm">
              Type {user.phoneNumber} to confirm
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                autoComplete="off"
                disabled={pending}
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
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  pending || disabled || connected || phone !== user.phoneNumber
                }
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {pending ? "Deleting user…" : "Delete from Photon"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
