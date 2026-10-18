"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Dialog } from "radix-ui";
import { useIntegrationHealth } from "@/components/settings/integrations-panel";
import { SettingsPanel } from "@/components/settings/settings-panel";

export function SettingsButton({
  email,
  name,
  timezone,
  organization,
  className,
}: {
  email: string;
  name: string;
  timezone: string;
  organization: string;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuSettings, setMenuSettings] = useState(false);
  const [hideRouteDialog, setHideRouteDialog] = useState(false);
  const health = useIntegrationHealth();
  if (pathname !== "/app/settings" && hideRouteDialog)
    setHideRouteDialog(false);
  const open =
    menuSettings || (pathname === "/app/settings" && !hideRouteDialog);

  function handleOpenChange(next: boolean) {
    if (next) {
      setMenuSettings(true);
      return;
    }
    setMenuSettings(false);
    if (pathname === "/app/settings") {
      setHideRouteDialog(true);
      router.push("/app");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuSettings(true)}
        className={className}
      >
        <Settings aria-hidden className="size-[18px] shrink-0" />
        Settings
      </button>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-40 h-[min(614px,calc(100dvh-2rem))] w-[min(870px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border bg-card shadow-xl dark:bg-background outline-none"
            onOpenAutoFocus={() => {
              void health.load();
            }}
            onInteractOutside={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest("[data-slot='select-content']")
              ) {
                event.preventDefault();
              }
            }}
          >
            <SettingsPanel
              email={email}
              name={name}
              timezone={timezone}
              organization={organization}
              health={health}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
