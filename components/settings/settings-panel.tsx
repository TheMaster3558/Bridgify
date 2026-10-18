"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Clock,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import {
  ComingLaterSettings,
  GeminiSettings,
  PhotonSettings,
  type useIntegrationHealth,
} from "@/components/settings/integrations-panel";
import { ProfileForm } from "@/components/settings/profile-form";
import {
  SettingsGroup,
  SettingsRow,
  settingsButton,
} from "@/components/settings/settings-ui";
import {
  applyTheme,
  readThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const sections = [
  { id: "profile", label: "Profile", icon: UserRound, group: "Account" },
  { id: "appearance", label: "Appearance", icon: Palette, group: "Account" },
  { id: "photon", label: "Photon", icon: MessageCircle, group: "Integrations" },
  { id: "gemini", label: "Gemini", icon: Sparkles, group: "Integrations" },
  { id: "later", label: "Coming later", icon: Clock, group: "Integrations" },
] as const;

type SectionId = (typeof sections)[number]["id"] | "signout";

const railItem =
  "flex w-full items-center gap-2 rounded-xl px-3 py-[7px] text-left text-[15px] font-medium whitespace-nowrap text-neutral-600 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-300";
const railItemActive = "bg-sidebar-accent text-sidebar-foreground";

function AppearanceSettings() {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    () => "system" as ThemePreference,
  );
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <SettingsGroup label="Theme">
      <SettingsRow
        title="Color mode"
        description="Choose light or dark, or match your device."
      >
        <div
          role="radiogroup"
          aria-label="Color mode"
          className="flex items-center gap-1 rounded-full bg-card p-1 ring-1 ring-black/5 dark:bg-background dark:ring-white/10"
        >
          {options.map((option) => {
            const Icon = option.icon;
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => applyTheme(option.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-neutral-500 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-400",
                  selected &&
                    "bg-sidebar-accent text-foreground dark:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </SettingsRow>
    </SettingsGroup>
  );
}

function SignOutSettings({ email }: { email: string }) {
  return (
    <SettingsGroup>
      <SettingsRow
        title="Sign out"
        description={`End your session on this device${email ? ` for ${email}` : ""}.`}
      >
        <form method="post" action="/auth/signout">
          <button
            type="submit"
            className={cn(settingsButton, "text-crit hover:text-crit")}
          >
            Sign out
          </button>
        </form>
      </SettingsRow>
    </SettingsGroup>
  );
}

export function SettingsPanel({
  email,
  name,
  timezone,
  organization,
  health,
}: {
  email: string;
  name: string;
  timezone: string;
  organization: string;
  health: ReturnType<typeof useIntegrationHealth>;
}) {
  const [active, setActive] = useState<SectionId>("profile");
  const title =
    active === "signout"
      ? "Sign out"
      : sections.find((section) => section.id === active)!.label;

  return (
    <div className="flex h-full flex-col sm:flex-row">
      <nav
        aria-label="Settings sections"
        className="flex shrink-0 flex-col gap-0.5 border-b border-sidebar-border bg-sidebar p-3 sm:w-60 sm:border-r sm:border-b-0"
      >
        <Dialog.Title className="px-3 pt-1 pb-1.5 text-[15px] font-medium text-neutral-500 dark:text-neutral-400">
          Settings
        </Dialog.Title>
        <Dialog.Description className="sr-only">
          Manage your profile, appearance, and integrations.
        </Dialog.Description>
        <div className="flex gap-0.5 overflow-x-auto sm:flex-col sm:overflow-visible">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={section.id} className="contents">
                {index > 0 && sections[index - 1].group !== section.group ? (
                  <p className="hidden px-3 pt-4 pb-1.5 text-[15px] font-medium text-neutral-500 sm:block dark:text-neutral-400">
                    {section.group}
                  </p>
                ) : null}
                <button
                  type="button"
                  aria-current={active === section.id ? "page" : undefined}
                  onClick={() => setActive(section.id)}
                  className={cn(
                    railItem,
                    "w-auto sm:w-full",
                    active === section.id && railItemActive,
                  )}
                >
                  <Icon aria-hidden className="size-[18px] shrink-0" />
                  {section.label}
                </button>
              </div>
            );
          })}
          <button
            type="button"
            aria-current={active === "signout" ? "page" : undefined}
            onClick={() => setActive("signout")}
            className={cn(
              railItem,
              "w-auto sm:mt-4 sm:w-full",
              active === "signout" && railItemActive,
            )}
          >
            <LogOut aria-hidden className="size-[18px] shrink-0" />
            Sign out
          </button>
        </div>
      </nav>
      <div className="settings-dialog-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card dark:bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-card px-6 pt-6 pb-4 sm:px-8 dark:bg-background">
          <h2 className="text-xl font-medium">{title}</h2>
          <Dialog.Close
            aria-label="Close settings"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-sidebar-accent text-neutral-500 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
          >
            <X className="size-4" />
          </Dialog.Close>
        </div>
        <div className="grid gap-6 px-6 pb-8 sm:px-8">
          {active === "profile" && (
            <ProfileForm
              email={email || "Signed-in account"}
              name={name}
              timezone={timezone}
              organization={organization}
            />
          )}
          {active === "appearance" && <AppearanceSettings />}
          {active === "photon" && (
            <PhotonSettings timezone={timezone} health={health} />
          )}
          {active === "gemini" && (
            <GeminiSettings timezone={timezone} health={health} />
          )}
          {active === "later" && <ComingLaterSettings />}
          {active === "signout" && <SignOutSettings email={email} />}
        </div>
      </div>
    </div>
  );
}
