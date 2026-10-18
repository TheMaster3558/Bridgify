"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Eye,
  MessagesSquare,
  Minus,
  MoreVertical,
  ShieldAlert,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { Checkbox, Dialog, DropdownMenu } from "radix-ui";
import { DecisionActions } from "./decision-actions";
import {
  SettingsGroup,
  settingsButton,
} from "@/components/settings/settings-ui";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

type Decision = OwnerDecisionRecord;
type SortKey = "client" | "severity" | "updated";

const pillTone = {
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-200",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  gray: "bg-sidebar-accent text-neutral-600 dark:text-neutral-300",
};

const reasonTone: Record<string, keyof typeof pillTone> = {
  delivery_unknown: "red",
  failed_processing: "red",
  policy_denied: "red",
  conflicting_request: "red",
  ambiguous_request: "yellow",
  exhausted_allowance: "yellow",
  unknown_participant: "yellow",
  scope_addition: "cyan",
  deadline_change: "blue",
  unsupported_input: "gray",
};

const severityDot: Record<Decision["severity"], string> = {
  critical: "bg-rose-500",
  warning: "bg-yellow-400",
  info: "bg-blue-500",
};

const severityRank: Record<Decision["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const avatarTones = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200",
];

const iconButton =
  "grid size-7 shrink-0 place-items-center rounded-lg bg-card text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/5 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-background dark:text-neutral-300 dark:ring-white/10";

const sectionLabel =
  "px-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400";

function reasonLabel(reason: string) {
  const label = reason.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

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

function ClientAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" ? "size-7 text-[11px]" : "size-10 text-sm",
        avatarTone(name),
      )}
    >
      {initials(name)}
    </span>
  );
}

function ReasonPill({ reason }: { reason: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-sm font-medium whitespace-nowrap",
        pillTone[reasonTone[reason] ?? "gray"],
      )}
    >
      {reasonLabel(reason)}
    </span>
  );
}

function SeverityChip({ severity }: { severity: Decision["severity"] }) {
  return (
    <span className="inline-flex h-7 items-center gap-2 rounded-lg bg-card px-2.5 text-sm font-medium whitespace-nowrap text-foreground ring-1 ring-black/10 dark:bg-background dark:ring-white/10">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", severityDot[severity])}
      />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
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

function RowMenu({
  decision,
  onOpen,
}: {
  decision: Decision;
  onOpen: () => void;
}) {
  const item =
    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none focus:bg-sidebar-accent";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`More actions for ${decision.title}`}
        className={iconButton}
        onClick={(event) => event.stopPropagation()}
      >
        <MoreVertical aria-hidden className="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-xl border bg-popover p-1 text-popover-foreground shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenu.Item className={item} onSelect={onOpen}>
            <Eye aria-hidden className="size-4" />
            Review decision
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link href={`/app/projects/${decision.project_id}/conversation`}>
              <MessagesSquare aria-hidden className="size-4" />
              Open conversation
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link href={`/app/projects/${decision.project_id}/automation`}>
              <Workflow aria-hidden className="size-4" />
              Open project automation
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DecisionDetail({
  decision,
  onClose,
  onResolved,
}: {
  decision: Decision;
  onClose: () => void;
  onResolved: (id: string) => void;
}) {
  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {decision.decision_code} · {decision.request_code}
          </p>
          <button
            type="button"
            aria-label="Close decision"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-sidebar-accent text-neutral-500 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <h2 className="-mt-2 text-xl leading-snug font-medium">
          {decision.title}
        </h2>
        <div className="flex items-center gap-3">
          <ClientAvatar name={decision.client_name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">
              {decision.client_name}
            </p>
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              {decision.project_name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={decision.severity} />
          <ReasonPill reason={decision.reason} />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Updated {formatDate(decision.updated_at)}
          </span>
        </div>
      </header>

      <section className="grid gap-2">
        <h3 className={sectionLabel}>Client request</h3>
        <SettingsGroup>
          <blockquote className="px-3.5 py-3 text-[15px] leading-relaxed">
            “{decision.source_text || "No source text recorded."}”
            <cite className="mt-1.5 block text-sm text-neutral-500 not-italic dark:text-neutral-400">
              {decision.source_meta || decision.client_name}
            </cite>
          </blockquote>
        </SettingsGroup>
      </section>

      <section className="grid gap-2">
        <h3 className={sectionLabel}>Why it was escalated</h3>
        <SettingsGroup>
          <div className="px-3.5 py-3">
            <p className="text-[15px] leading-relaxed">
              {decision.explanation || "Owner review is required."}
            </p>
          </div>
          <div className="px-3.5 py-3">
            <p className="text-[15px] font-medium">Scope evidence</p>
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {decision.evidence || "No scope evidence recorded."}
            </p>
            {decision.evidence_source ? (
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                {decision.evidence_source}
              </p>
            ) : null}
          </div>
          {decision.missing_details.length > 0 && (
            <div className="px-3.5 py-3">
              <p className="text-[15px] font-medium">Missing details</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-neutral-500 dark:text-neutral-400">
                {decision.missing_details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </SettingsGroup>
      </section>

      <section className="grid gap-2">
        <h3 className={sectionLabel}>Suggested options</h3>
        <SettingsGroup>
          {decision.suggested_options.length ? (
            decision.suggested_options.map((option, index) => (
              <div key={`${option.title}-${index}`} className="px-3.5 py-3">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                  {option.title}
                  {index === 0 && (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        pillTone.blue,
                      )}
                    >
                      Suggested
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {option.description}
                </p>
              </div>
            ))
          ) : (
            <p className="px-3.5 py-3 text-sm text-neutral-500 dark:text-neutral-400">
              No suggested options recorded.
            </p>
          )}
        </SettingsGroup>
      </section>

      {decision.internal_note && (
        <section className="grid gap-2">
          <h3 className={sectionLabel}>Private note · owner only</h3>
          <div
            className={cn(
              "rounded-2xl px-3.5 py-3 text-[15px]",
              pillTone.yellow,
            )}
          >
            {decision.internal_note}
          </div>
        </section>
      )}

      <DecisionActions
        key={decision.id}
        decision={decision}
        onResolved={onResolved}
      />

      <section className="grid gap-2">
        <h3 className={sectionLabel}>Resolution history</h3>
        {decision.history.length ? (
          <ol className="grid gap-2 px-3.5">
            {decision.history.map((item, index) => (
              <li
                key={`${decision.id}-history-${index}`}
                className="flex gap-3 text-sm text-neutral-500 dark:text-neutral-400"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600"
                />
                {item}
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-3.5 text-sm text-neutral-500 dark:text-neutral-400">
            No history recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}

function SelectBox({
  checked,
  label,
  onChange,
}: {
  checked: boolean | "indeterminate";
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox.Root
      checked={checked}
      aria-label={label}
      onCheckedChange={(value) => onChange(value === true)}
      onClick={(event) => event.stopPropagation()}
      className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-neutral-300 bg-card text-white outline-none transition-colors hover:border-neutral-400 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 data-[state=checked]:border-[#2563eb] data-[state=checked]:bg-[#2563eb] data-[state=indeterminate]:border-[#2563eb] data-[state=indeterminate]:bg-[#2563eb] dark:border-neutral-600 dark:bg-background"
    >
      <Checkbox.Indicator>
        {checked === "indeterminate" ? (
          <Minus aria-hidden className="size-3.5" strokeWidth={3} />
        ) : (
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        )}
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}

async function deleteDecision(id: string) {
  const response = await fetch(`/api/v1/decisions/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ action: "delete" }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message ?? "Review could not be deleted.");
  }
}

function DeleteDialog({
  targets,
  onCancel,
  onDeleted,
}: {
  targets: Decision[];
  onCancel: () => void;
  onDeleted: (ids: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const single = targets.length === 1;

  async function confirm() {
    setBusy(true);
    setError("");
    const results = await Promise.allSettled(
      targets.map((decision) => deleteDecision(decision.id)),
    );
    const deleted = targets
      .filter((_, index) => results[index].status === "fulfilled")
      .map((decision) => decision.id);
    const failed = results.filter((result) => result.status === "rejected");
    setBusy(false);
    if (deleted.length) onDeleted(deleted);
    if (failed.length) {
      setError(
        failed.length === targets.length
          ? ((failed[0] as PromiseRejectedResult).reason?.message ??
              "Reviews could not be deleted.")
          : `${failed.length} of ${targets.length} reviews could not be deleted. Try again.`,
      );
      return;
    }
    onCancel();
  }

  return (
    <Dialog.Root
      open={targets.length > 0}
      onOpenChange={(open) => !open && !busy && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(440px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[28px] border bg-card p-6 shadow-xl outline-none dark:bg-background">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <Trash2 aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-medium">
                {single
                  ? "Delete this review?"
                  : `Delete ${targets.length} reviews?`}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {single ? (
                  <>
                    “{targets[0].title}” will be removed from Needs Attention.
                  </>
                ) : (
                  "The selected reviews will be removed from Needs Attention."
                )}{" "}
                The client is not messaged. This can’t be undone here.
              </Dialog.Description>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-crit">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Dialog.Close className={settingsButton} disabled={busy}>
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-600 px-3.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(225,29,72,0.35)] outline-none hover:brightness-105 focus-visible:ring-[3px] focus-visible:ring-rose-500/40 disabled:pointer-events-none disabled:opacity-60"
            >
              {busy
                ? "Deleting…"
                : single
                  ? "Delete review"
                  : `Delete ${targets.length}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function NeedsAttention({ decisions }: { decisions: Decision[] }) {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<Decision[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "updated",
    dir: "desc",
  });
  const activeDecisions = useMemo(
    () => decisions.filter((decision) => !resolvedIds.includes(decision.id)),
    [decisions, resolvedIds],
  );
  const reasons = useMemo(
    () => [...new Set(activeDecisions.map((decision) => decision.reason))],
    [activeDecisions],
  );
  const visible = useMemo(() => {
    const rows = activeDecisions.filter(
      (decision) => filter === "all" || decision.reason === filter,
    );
    const direction = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.key === "client")
        return a.client_name.localeCompare(b.client_name) * direction;
      if (sort.key === "severity")
        return (
          (severityRank[a.severity] - severityRank[b.severity]) * direction
        );
      return a.updated_at.localeCompare(b.updated_at) * direction;
    });
  }, [activeDecisions, filter, sort]);
  const selected = activeDecisions.find(
    (decision) => decision.id === selectedId,
  );

  const checkedVisible = visible.filter((decision) =>
    checkedIds.includes(decision.id),
  );
  const allChecked: boolean | "indeterminate" =
    checkedVisible.length === 0
      ? false
      : checkedVisible.length === visible.length
        ? true
        : "indeterminate";

  function toggleChecked(id: string, value: boolean) {
    setCheckedIds((current) =>
      value ? [...current, id] : current.filter((item) => item !== id),
    );
  }

  function onDeleted(ids: string[]) {
    setResolvedIds((previous) => [...previous, ...ids]);
    setCheckedIds((current) => current.filter((id) => !ids.includes(id)));
    // Keep only failures in the dialog so a retry never resends a delete.
    setDeleteTargets((current) =>
      current.filter((decision) => !ids.includes(decision.id)),
    );
    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
    router.refresh();
  }

  useEffect(() => {
    if (!selected || deleteTargets.length) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, deleteTargets.length]);

  function onSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
  }

  const filterButton =
    "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
  const filterActive =
    "bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(37,99,235,0.35)]";
  const filterIdle =
    "bg-sidebar-accent text-neutral-600 hover:text-foreground dark:text-neutral-300";
  const headCell =
    "px-3 py-2.5 text-left text-[15px] font-medium whitespace-nowrap";

  return (
    <main
      className={cn(
        "mx-auto grid w-full max-w-[1280px] items-start gap-5 p-5 md:p-6",
        selected &&
          "xl:max-w-[1640px] xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]",
      )}
    >
      <div className="grid min-w-0 gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">
              Needs Attention
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Requests needing your judgment and reply delivery issues.
            </p>
          </div>
        </header>

        <div
          role="group"
          aria-label="Filter decisions"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setCheckedIds([]);
            }}
            className={cn(
              filterButton,
              filter === "all" ? filterActive : filterIdle,
            )}
          >
            All ({activeDecisions.length})
          </button>
          {reasons.map((reason) => (
            <button
              key={reason}
              type="button"
              aria-pressed={filter === reason}
              onClick={() => {
                setFilter(reason);
                setCheckedIds([]);
              }}
              className={cn(
                filterButton,
                filter === reason ? filterActive : filterIdle,
              )}
            >
              {reasonLabel(reason)}
            </button>
          ))}
        </div>

        <section
          aria-labelledby="open-decisions-heading"
          className="@container min-w-0 overflow-hidden rounded-2xl border border-sidebar-border bg-card"
        >
          <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <h2 id="open-decisions-heading" className="text-[17px] font-medium">
              Open decisions
            </h2>
            {checkedVisible.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {checkedVisible.length} selected
                </span>
                <button
                  type="button"
                  className={settingsButton}
                  onClick={() => setCheckedIds([])}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={cn(
                    settingsButton,
                    "gap-1.5 text-crit hover:text-crit",
                  )}
                  onClick={() => setDeleteTargets(checkedVisible)}
                >
                  <Trash2 aria-hidden className="size-4" />
                  Delete selected
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {visible.length} {visible.length === 1 ? "item" : "items"} ·
                owner review required
              </p>
            )}
          </div>
          {visible.length === 0 ? (
            <div className="grid place-items-center border-t border-sidebar-border px-4 py-14 text-center">
              <ShieldAlert
                aria-hidden
                className="mb-2 size-6 text-neutral-400"
              />
              <p className="text-[15px] font-medium">
                {activeDecisions.length
                  ? "No open decisions match this filter."
                  : "No decisions are waiting for review."}
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                New owner-review items will appear here when they need you.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-y border-sidebar-border bg-sidebar text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th scope="col" className="w-0 py-2.5 pr-1 pl-4">
                      <SelectBox
                        checked={allChecked}
                        label="Select all decisions"
                        onChange={(value) =>
                          setCheckedIds(
                            value ? visible.map((decision) => decision.id) : [],
                          )
                        }
                      />
                    </th>
                    <th scope="col" className={cn(headCell, "pl-2")}>
                      <SortHeader
                        label="Client"
                        sortKey="client"
                        sort={sort}
                        onSort={onSort}
                      />
                    </th>
                    <th scope="col" className={headCell}>
                      Request
                    </th>
                    <th
                      scope="col"
                      className={cn(headCell, "hidden @3xl:table-cell")}
                    >
                      <SortHeader
                        label="Severity"
                        sortKey="severity"
                        sort={sort}
                        onSort={onSort}
                      />
                    </th>
                    <th scope="col" className={headCell}>
                      Reason
                    </th>
                    <th
                      scope="col"
                      className={cn(headCell, "hidden @4xl:table-cell")}
                    >
                      <SortHeader
                        label="Last updated"
                        sortKey="updated"
                        sort={sort}
                        onSort={onSort}
                      />
                    </th>
                    <th
                      scope="col"
                      className={cn(headCell, "hidden @5xl:table-cell")}
                    >
                      Code
                    </th>
                    <th scope="col" className={cn(headCell, "pr-4 text-right")}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((decision) => {
                    const isSelected = selected?.id === decision.id;
                    const isChecked = checkedIds.includes(decision.id);
                    return (
                      <tr
                        key={decision.id}
                        onClick={() => setSelectedId(decision.id)}
                        aria-selected={isSelected}
                        className={cn(
                          "cursor-pointer border-b border-sidebar-border transition-colors last:border-b-0 hover:bg-sidebar",
                          (isSelected || isChecked) &&
                            "bg-blue-50 hover:bg-blue-50 dark:bg-blue-500/10 dark:hover:bg-blue-500/10",
                        )}
                      >
                        <td className="py-2 pr-1 pl-4">
                          <SelectBox
                            checked={isChecked}
                            label={`Select ${decision.title}`}
                            onChange={(value) =>
                              toggleChecked(decision.id, value)
                            }
                          />
                        </td>
                        <td className="py-2 pr-3 pl-2">
                          <div className="flex max-w-52 items-center gap-2.5">
                            <ClientAvatar name={decision.client_name} />
                            <span className="truncate text-[15px] font-medium">
                              {decision.client_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(decision.id);
                            }}
                            aria-current={isSelected ? "true" : undefined}
                            className="block max-w-[28rem] min-w-40 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                          >
                            <span className="line-clamp-1 text-[15px] leading-5 text-foreground">
                              {decision.title}
                            </span>
                            <span className="line-clamp-1 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                              {decision.project_name}
                            </span>
                          </button>
                        </td>
                        <td className="hidden px-3 py-2 @3xl:table-cell">
                          <SeverityChip severity={decision.severity} />
                        </td>
                        <td className="px-3 py-2">
                          <ReasonPill reason={decision.reason} />
                        </td>
                        <td className="hidden px-3 py-2 text-[15px] whitespace-nowrap tabular-nums @4xl:table-cell">
                          {formatDate(decision.updated_at)}
                        </td>
                        <td className="hidden px-3 py-2 @5xl:table-cell">
                          <span className="inline-flex rounded-md bg-sidebar px-2 py-1 font-mono text-xs whitespace-nowrap text-foreground dark:bg-sidebar-accent">
                            {decision.decision_code}
                          </span>
                        </td>
                        <td className="py-2 pr-4 pl-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              aria-label={`Delete ${decision.title}`}
                              className={cn(
                                iconButton,
                                "hover:text-rose-600 dark:hover:text-rose-300",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTargets([decision]);
                              }}
                            >
                              <Trash2 aria-hidden className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Review ${decision.title}`}
                              className={iconButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(decision.id);
                              }}
                            >
                              <Eye aria-hidden className="size-4" />
                            </button>
                            <RowMenu
                              decision={decision}
                              onOpen={() => setSelectedId(decision.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <DeleteDialog
        targets={deleteTargets}
        onCancel={() => setDeleteTargets([])}
        onDeleted={onDeleted}
      />
      {selected && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
            onClick={() => setSelectedId(null)}
          />
          <aside
            aria-label="Decision details"
            className="settings-dialog-scroll fixed inset-y-0 right-0 z-40 w-full max-w-[480px] overflow-y-auto overscroll-contain border-l border-sidebar-border bg-card p-6 shadow-xl xl:sticky xl:top-5 xl:z-auto xl:max-h-[calc(100dvh-2.5rem)] xl:w-auto xl:max-w-none xl:rounded-[28px] xl:border xl:shadow-none"
          >
            <DecisionDetail
              decision={selected}
              onClose={() => setSelectedId(null)}
              onResolved={(id) => {
                setResolvedIds((previous) => [...previous, id]);
                setSelectedId(null);
              }}
            />
          </aside>
        </>
      )}
    </main>
  );
}
