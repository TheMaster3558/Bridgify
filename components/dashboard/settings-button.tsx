"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { ProfileForm } from "@/components/settings/profile-form";
import type { IntegrationHealth } from "@/lib/settings/health";

type HealthState =
  | { kind: "loading" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; health: IntegrationHealth };

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
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const request = useRef(0);
  if (pathname !== "/app/settings" && hideRouteDialog)
    setHideRouteDialog(false);
  const open =
    menuSettings || (pathname === "/app/settings" && !hideRouteDialog);

  async function loadHealth() {
    const id = ++request.current;
    setHealth({ kind: "loading" });
    try {
      const response = await fetch("/api/v1/integrations/health", {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (id !== request.current) return;
      if (response.status === 401 || response.status === 403) {
        setHealth({
          kind: "denied",
          message:
            body.error?.message ||
            "You do not have access to integration settings.",
        });
        return;
      }
      if (!response.ok) {
        setHealth({
          kind: "error",
          message: body.error?.message || "Integration health is unavailable.",
        });
        return;
      }
      setHealth({ kind: "ready", health: body.data as IntegrationHealth });
    } catch {
      if (id !== request.current) return;
      setHealth({
        kind: "error",
        message: "Integration health is unavailable.",
      });
    }
  }

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
            className="fixed top-1/2 left-1/2 z-40 max-h-[min(90vh,920px)] w-[min(960px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-lg outline-none"
            onOpenAutoFocus={() => {
              void loadHealth();
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
            <div className="settings-dialog-scroll max-h-[min(90vh,920px)] overflow-y-auto overscroll-contain p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="font-display text-2xl font-semibold">
                    Settings
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Save your profile, timezone, and organization. Integration
                    status is read from the server and never includes provider
                    keys.
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label="Close settings"
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <ProfileForm
                  email={email || "Signed-in account"}
                  name={name}
                  timezone={timezone}
                  organization={organization}
                />
                {health.kind === "loading" ? (
                  <section
                    className="rounded-xl border bg-card p-6 shadow-sm"
                    aria-busy="true"
                  >
                    <h2 className="text-xl font-semibold">Integrations</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Loading integration health…
                    </p>
                  </section>
                ) : (
                  <IntegrationsPanel
                    timezone={timezone || "UTC"}
                    initialHealth={
                      health.kind === "ready" ? health.health : null
                    }
                    initialError={
                      health.kind === "error" || health.kind === "denied"
                        ? health.message
                        : ""
                    }
                  />
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
