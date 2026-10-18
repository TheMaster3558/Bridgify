"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageUp, Loader2, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import {
  InitialsAvatar,
  menuContent,
  menuItem,
} from "@/components/dashboard/table-ui";
import { cn } from "@/lib/utils";

const OUTPUT_SIZE = 320;

// Center-crops to a square and re-encodes, so phone photos upload small.
async function toSquareJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode"))),
      "image/jpeg",
      0.88,
    ),
  );
}

export function ClientPhotoCard({
  clientName,
  src,
  onChange,
  children,
  aside,
}: {
  clientName: string;
  src?: string | null;
  onChange: (url: string | null) => void;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      let image: Blob;
      try {
        image = await toSquareJpeg(file);
      } catch {
        throw new Error(
          "That image couldn't be read. Use a PNG, JPEG or WebP.",
        );
      }
      const form = new FormData();
      form.set("clientName", clientName);
      form.set("file", image, "photo.jpg");
      const response = await fetch("/api/v1/client-photos", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error?.message ?? "Photo upload failed.");
      onChange(body.data?.url ?? null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/client-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error?.message ?? "Photo could not be removed.");
      onChange(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Photo could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 rounded-2xl bg-sidebar p-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={busy}
            aria-label={`${src ? "Change" : "Add"} photo for ${clientName}`}
            title={src ? "Change photo" : "Add photo"}
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
          >
            <InitialsAvatar name={clientName} size="lg" src={src} />
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white transition-opacity",
                busy
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </span>
            {!src && !busy && (
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-white ring-2 ring-sidebar"
              >
                <Camera className="size-3" />
              </span>
            )}
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className={menuContent}
            >
              <DropdownMenu.Item
                className={menuItem}
                onSelect={() => input.current?.click()}
              >
                <ImageUp aria-hidden className="size-4" />
                {src ? "Upload new photo" : "Upload photo"}
              </DropdownMenu.Item>
              {src && (
                <DropdownMenu.Item
                  className={cn(menuItem, "text-rose-600 dark:text-rose-400")}
                  onSelect={() => void remove()}
                >
                  <Trash2 aria-hidden className="size-4" />
                  Remove photo
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label={`Photo for ${clientName}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <div className="min-w-0 flex-1">{children}</div>
        {aside}
      </div>
      {error && (
        <p role="alert" className="px-1 text-sm text-crit">
          {error}
        </p>
      )}
    </div>
  );
}
