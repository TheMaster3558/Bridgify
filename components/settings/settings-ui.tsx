import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const settingsButton =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-card px-3 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/5 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 disabled:pointer-events-none disabled:opacity-50 dark:bg-background dark:ring-white/10";

export const settingsPrimaryButton =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#1f5ae6] bg-gradient-to-b from-[#4a82ff] to-[#2563eb] px-3.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(37,99,235,0.35)] outline-none hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 disabled:pointer-events-none disabled:opacity-60";

export const settingsField = "h-8 w-full bg-card sm:w-60 dark:bg-background";

export function SettingsGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      {label ? (
        <h3 className="px-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {label}
        </h3>
      ) : null}
      <div className="divide-y divide-card overflow-hidden rounded-2xl bg-sidebar dark:divide-background">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
}) {
  const Title = htmlFor ? "label" : "p";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3.5 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <Title
          htmlFor={htmlFor}
          className="block text-[15px] font-medium text-foreground"
        >
          {title}
        </Title>
        {description ? (
          <div className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {description}
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsValue({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs break-all text-foreground">
      {children}
    </span>
  );
}

function tone(label: string) {
  if (
    [
      "Reachable",
      "Sent",
      "Available",
      "Signature verified",
      "Configured",
    ].includes(label)
  ) {
    return "bg-ok-soft text-ok";
  }
  if (["Unknown", "Rate-limited", "Sending"].includes(label)) {
    return "bg-warn-soft text-warn";
  }
  if (label === "Unavailable") return "bg-crit-soft text-crit";
  return "bg-card text-neutral-500 dark:bg-background dark:text-neutral-400";
}

export function StatusPill({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone(label),
      )}
    >
      {label}
    </span>
  );
}
