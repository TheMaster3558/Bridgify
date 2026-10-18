"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared look for the owner data tables (Needs Attention, Projects) and their
// right-hand detail panels.

export const pillTone = {
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-200",
  green: "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  gray: "bg-sidebar-accent text-neutral-600 dark:text-neutral-300",
};

export type PillTone = keyof typeof pillTone;

export const iconButton =
  "grid size-7 shrink-0 place-items-center rounded-lg bg-card text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/5 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-background dark:text-neutral-300 dark:ring-white/10";

export const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none focus:bg-sidebar-accent";

export const menuContent =
  "z-50 min-w-52 rounded-xl border bg-popover p-1 text-popover-foreground shadow-md";

export const filterButton =
  "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
export const filterActive =
  "bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(37,99,235,0.35)]";
export const filterIdle =
  "bg-sidebar-accent text-neutral-600 hover:text-foreground dark:text-neutral-300";

export const tableCard =
  "@container min-w-0 overflow-hidden rounded-2xl border border-sidebar-border bg-card";
export const tableHead =
  "border-y border-sidebar-border bg-sidebar text-neutral-500 dark:text-neutral-400";
export const headCell =
  "px-3 py-2.5 text-left text-[15px] font-medium whitespace-nowrap";
export const tableRow =
  "cursor-pointer border-b border-sidebar-border transition-colors last:border-b-0 hover:bg-sidebar";
export const tableRowSelected =
  "bg-blue-50 hover:bg-blue-50 dark:bg-blue-500/10 dark:hover:bg-blue-500/10";

export const panelAside =
  "settings-dialog-scroll fixed inset-y-0 right-0 z-40 flex w-full max-w-[480px] flex-col overflow-y-auto overscroll-contain border-l border-sidebar-border bg-card shadow-xl xl:sticky xl:top-5 xl:z-auto xl:max-h-[calc(100dvh-2.5rem)] xl:w-auto xl:max-w-none xl:rounded-[28px] xl:border xl:shadow-none dark:bg-background";
export const panelHeader =
  "sticky top-0 z-10 grid gap-3 border-b border-sidebar-border bg-card/95 px-6 pt-5 pb-4 backdrop-blur dark:bg-background/95";
export const panelFooter =
  "sticky bottom-0 z-10 mt-auto grid gap-2 border-t border-sidebar-border bg-card/95 px-6 py-3.5 backdrop-blur dark:bg-background/95";

export function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

const avatarTones = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200",
];

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (
    words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0]
  ).toUpperCase();
}

function avatarTone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return avatarTones[Math.abs(hash) % avatarTones.length];
}

export function InitialsAvatar({
  name,
  size = "sm",
  square = false,
}: {
  name: string;
  size?: "sm" | "md";
  square?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-semibold",
        square ? "rounded-lg" : "rounded-full",
        size === "sm" ? "size-7 text-[11px]" : "size-10 text-sm",
        avatarTone(name),
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-sm font-medium whitespace-nowrap",
        pillTone[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DotChip({
  dot,
  children,
}: {
  dot: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-lg bg-card px-2.5 text-sm font-medium whitespace-nowrap text-foreground ring-1 ring-black/10 dark:bg-background dark:ring-white/10">
      <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: K;
  sort: { key: K; dir: "asc" | "desc" };
  onSort: (key: K) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 rounded-md font-medium outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
    >
      {label}
      <Icon aria-hidden className={cn("size-3.5", !active && "opacity-60")} />
    </button>
  );
}

export function PanelSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden className="size-4" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PanelClose({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-sidebar-accent text-neutral-500 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
