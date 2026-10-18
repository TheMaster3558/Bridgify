"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CircleHelp,
  Eye,
  FileText,
  History,
  Lightbulb,
  Lock,
  MessageCircle,
  MessagesSquare,
  Minus,
  MoreVertical,
  ShieldAlert,
  Trash2,
  Workflow,
} from "lucide-react";
import { Checkbox, Dialog, DropdownMenu } from "radix-ui";
import { DecisionActions } from "./decision-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientPhotoCard } from "@/components/dashboard/client-photo";
import { clientKey } from "@/lib/clients/photos";
import { settingsButton } from "@/components/settings/settings-ui";
import {
  DotChip,
  InitialsAvatar,
  PanelClose,
  PanelSection,
  Pill,
  SortHeader,
  filterActive,
  filterButton,
  filterIdle,
  formatShortDate,
  headCell,
  iconButton,
  menuContent,
  menuItem,
  panelAside,
  panelHeader,
  tableCard,
  tableHead,
  tableRow,
  tableRowSelected,
  type PillTone,
} from "@/components/dashboard/table-ui";
import type { OwnerDecisionRecord } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

type Decision = OwnerDecisionRecord;
type SortKey = "client" | "severity" | "updated";

const reasonTone: Record<string, PillTone> = {
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

function reasonLabel(reason: string) {
  const label = reason.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ReasonPill({ reason }: { reason: string }) {
  return <Pill tone={reasonTone[reason] ?? "gray"}>{reasonLabel(reason)}</Pill>;
}

function SeverityChip({ severity }: { severity: Decision["severity"] }) {
  return (
    <DotChip dot={severityDot[severity]}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </DotChip>
  );
}

function RowMenu({
  decision,
  onOpen,
}: {
  decision: Decision;
  onOpen: () => void;
}) {
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
          className={menuContent}
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenu.Item className={menuItem} onSelect={onOpen}>
            <Eye aria-hidden className="size-4" />
            Review decision
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href={`/app/projects/${decision.project_id}/conversation`}>
              <MessagesSquare aria-hidden className="size-4" />
              Open conversation
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItem}>
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

const calloutTone: Record<Decision["severity"], string> = {
  critical:
    "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-100 dark:ring-rose-500/25",
  warning:
    "bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25",
  info: "bg-blue-50 text-blue-950 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-100 dark:ring-blue-500/25",
};

const calloutIcon: Record<Decision["severity"], string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-400",
  info: "bg-blue-500",
};

function DecisionDetail({
  decision,
  onClose,
  onResolved,
  onDelete,
  photo,
  onPhotoChange,
}: {
  decision: Decision;
  onClose: () => void;
  onResolved: (id: string) => void;
  onDelete: () => void;
  photo?: string | null;
  onPhotoChange: (url: string | null) => void;
}) {
  const options = decision.suggested_options;
  return (
    <>
      <header className={panelHeader}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="rounded-md bg-sidebar px-1.5 py-0.5 dark:bg-sidebar-accent">
              {decision.decision_code}
            </span>
            <span className="rounded-md bg-sidebar px-1.5 py-0.5 dark:bg-sidebar-accent">
              {decision.request_code}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/app/projects/${decision.project_id}/conversation`}
              aria-label="Open conversation"
              title="Open conversation"
              className="grid size-7 place-items-center rounded-full text-neutral-500 outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            >
              <MessagesSquare aria-hidden className="size-4" />
            </Link>
            <PanelClose label="Close decision" onClick={onClose} />
          </div>
        </div>
        <h2 className="text-xl leading-snug font-semibold tracking-tight">
          {decision.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={decision.severity} />
          <ReasonPill reason={decision.reason} />
        </div>
      </header>

      <div className="grid gap-7 px-6 py-6">
        <ClientPhotoCard
          clientName={decision.client_name}
          src={photo}
          onChange={onPhotoChange}
          aside={
            <div className="text-right text-xs text-neutral-500 dark:text-neutral-400">
              <p>Updated</p>
              <p className="font-medium text-foreground tabular-nums">
                {formatShortDate(decision.updated_at)}
              </p>
            </div>
          }
        >
          <p className="truncate text-[15px] font-medium">
            {decision.client_name}
          </p>
          <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
            {decision.project_name}
          </p>
        </ClientPhotoCard>

        <PanelSection icon={MessageCircle} title="Client request">
          <div className="flex items-end gap-2.5">
            <InitialsAvatar name={decision.client_name} src={photo} />
            <div className="min-w-0">
              <div className="w-fit max-w-full rounded-[20px] rounded-bl-md bg-sidebar-accent px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                {decision.source_text || (
                  <span className="text-neutral-500 italic">
                    No source text recorded.
                  </span>
                )}
              </div>
              <p className="mt-1 pl-1 text-xs text-neutral-500 dark:text-neutral-400">
                {decision.source_meta || decision.client_name}
              </p>
            </div>
          </div>
        </PanelSection>

        <PanelSection icon={ShieldAlert} title="Why it needs you">
          <div
            className={cn(
              "flex gap-3 rounded-2xl p-4 ring-1 ring-inset",
              calloutTone[decision.severity],
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                calloutIcon[decision.severity],
              )}
            />
            <p className="text-[15px] leading-relaxed">
              {decision.explanation || "Owner review is required."}
            </p>
          </div>
          {(decision.evidence || decision.evidence_source) && (
            <div className="flex gap-3 rounded-2xl bg-sidebar p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-background">
                <FileText aria-hidden className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Scope evidence</p>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {decision.evidence || "No scope evidence recorded."}
                </p>
                {decision.evidence_source && (
                  <p className="mt-2 inline-flex rounded-md bg-card px-2 py-0.5 text-xs text-neutral-500 dark:bg-background dark:text-neutral-400">
                    {decision.evidence_source}
                  </p>
                )}
              </div>
            </div>
          )}
          {decision.missing_details.length > 0 && (
            <div className="rounded-2xl bg-sidebar p-4">
              <p className="text-sm font-medium">Missing details</p>
              <ul className="mt-2 grid gap-1.5">
                {decision.missing_details.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-300"
                  >
                    <CircleHelp
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-neutral-400"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PanelSection>

        {options.length > 0 && (
          <PanelSection icon={Lightbulb} title="Suggested options">
            <ol className="grid gap-2">
              {options.map((option, index) => (
                <li
                  key={`${option.title}-${index}`}
                  className={cn(
                    "flex gap-3 rounded-2xl p-3.5 ring-1 ring-inset",
                    index === 0
                      ? "bg-blue-50/70 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/25"
                      : "bg-card ring-sidebar-border dark:bg-background",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      index === 0
                        ? "bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-white"
                        : "bg-sidebar-accent text-neutral-600 dark:text-neutral-300",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                      {option.title}
                      {index === 0 && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          Recommended
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                      {option.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </PanelSection>
        )}

        {decision.internal_note && (
          <div className="flex gap-3 rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200 ring-inset dark:bg-yellow-400/10 dark:ring-yellow-400/25">
            <Lock
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-yellow-700 dark:text-yellow-300"
            />
            <div>
              <p className="text-xs font-semibold tracking-wide text-yellow-800 uppercase dark:text-yellow-200">
                Private note · owner only
              </p>
              <p className="mt-1 text-[15px] text-yellow-950 dark:text-yellow-50">
                {decision.internal_note}
              </p>
            </div>
          </div>
        )}

        <PanelSection icon={History} title="History">
          {decision.history.length ? (
            <ol className="relative grid gap-3 pl-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-sidebar-border">
              {decision.history.map((item, index) => (
                <li
                  key={`${decision.id}-history-${index}`}
                  className="relative text-sm text-neutral-600 dark:text-neutral-300"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1.5 -left-5 size-[11px] rounded-full border-2 border-card dark:border-background",
                      index === 0
                        ? "bg-blue-500"
                        : "bg-neutral-300 dark:bg-neutral-600",
                    )}
                  />
                  {item}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No history recorded yet.
            </p>
          )}
        </PanelSection>
      </div>

      <DecisionActions
        key={decision.id}
        decision={decision}
        onResolved={onResolved}
        onDelete={onDelete}
      />
    </>
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

async function deleteDecision(id: string, expectedUpdatedAt:string) {
  const response = await fetch(`/api/v1/decisions/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ action: "delete", expectedUpdatedAt }),
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
      targets.map((decision) => deleteDecision(decision.id, decision.updated_at)),
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

export function NeedsAttention({
  decisions,
  clientPhotos = {},
  serverManaged = false,
  toolbar,
  initialDecisionId,
  activeProjects = [],
}: {
  decisions: Decision[];
  clientPhotos?: Record<string, string>;
  serverManaged?: boolean;
  /** Filters shown in place of the client-side ones when serverManaged. */
  toolbar?: React.ReactNode;
  initialDecisionId?: string;
  activeProjects?: { id: string; name: string; client_name: string }[];
}) {
  const [photoOverrides, setPhotoOverrides] = useState<
    Record<string, string | null>
  >({});
  const photoFor = (name: string) => {
    const key = clientKey(name);
    return key in photoOverrides ? photoOverrides[key] : clientPhotos[key];
  };
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [project, setProject] = useState("all");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialDecisionId ?? null);
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
  const openByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const decision of activeDecisions)
      counts[decision.project_id] = (counts[decision.project_id] ?? 0) + 1;
    return counts;
  }, [activeDecisions]);
  const projectDecisions = useMemo(
    () =>
      project === "all"
        ? activeDecisions
        : activeDecisions.filter((decision) => decision.project_id === project),
    [activeDecisions, project],
  );
  const reasons = useMemo(
    () => [...new Set(projectDecisions.map((decision) => decision.reason))],
    [projectDecisions],
  );
  const visible = useMemo(() => {
    if (serverManaged) return activeDecisions;
    const rows = projectDecisions.filter(
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
  }, [projectDecisions, filter, sort, serverManaged, activeDecisions]);
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
    if (serverManaged) {
      const params = new URLSearchParams(window.location.search);
      params.set("dir", params.get("sort") === key && params.get("dir") === "asc" ? "desc" : "asc");
      params.set("sort", key); params.delete("page");
      router.push(`?${params}`); return;
    }
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "updated" ? "desc" : "asc" },
    );
  }

  return (
    <main
      className={cn(
        "mx-auto grid w-full max-w-[1280px] items-start gap-5 p-5 md:p-6",
        selected &&
          "xl:max-w-[1640px] xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]",
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
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

        {serverManaged ? toolbar : <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter decisions"
            className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1"
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
              All ({projectDecisions.length})
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
          <Select
            value={project}
            onValueChange={(value) => {
              setProject(value);
              setFilter("all");
              setCheckedIds([]);
            }}
          >
            <SelectTrigger
              aria-label="Project filter"
              className="h-9 w-full max-w-64 rounded-full border-0 bg-sidebar-accent px-3.5 text-sm font-medium shadow-none sm:w-64"
            >
              <SelectValue placeholder="All active projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All active projects</SelectItem>
              {activeProjects.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <InitialsAvatar
                    name={item.client_name}
                    src={photoFor(item.client_name)}
                  />
                  <span className="truncate">{item.name}</span>
                  <span className="text-neutral-500 tabular-nums dark:text-neutral-400">
                    {openByProject[item.id] ?? 0}
                  </span>
                </SelectItem>
              ))}
              {activeProjects.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                  No active projects
                </p>
              )}
            </SelectContent>
          </Select>
        </div>

        </>}
        <section aria-labelledby="open-decisions-heading" className={tableCard}>
          <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <h2 id="open-decisions-heading" className="text-[17px] font-medium">
              Decisions
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
                {!activeDecisions.length
                  ? "No decisions are waiting for review."
                  : project !== "all" && !projectDecisions.length
                    ? "No open decisions for this project."
                    : "No open decisions match this filter."}
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                New owner-review items will appear here when they need you.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className={tableHead}>
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
                      className={cn(headCell, "hidden @5xl:table-cell")}
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
                      className={cn(headCell, "hidden @6xl:table-cell")}
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
                          tableRow,
                          (isSelected || isChecked) && tableRowSelected,
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
                            <InitialsAvatar
                              name={decision.client_name}
                              src={photoFor(decision.client_name)}
                            />
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
                        <td className="hidden px-3 py-2 text-[15px] whitespace-nowrap tabular-nums @5xl:table-cell">
                          {formatShortDate(decision.updated_at)}
                        </td>
                        <td className="hidden px-3 py-2 @6xl:table-cell">
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
          <aside aria-label="Decision details" className={panelAside}>
            <DecisionDetail
              decision={selected}
              onClose={() => setSelectedId(null)}
              onResolved={(id) => {
                setResolvedIds((previous) => [...previous, id]);
                setSelectedId(null);
              }}
              onDelete={() => setDeleteTargets([selected])}
              photo={photoFor(selected.client_name)}
              onPhotoChange={(url) =>
                setPhotoOverrides((current) => ({
                  ...current,
                  [clientKey(selected.client_name)]: url,
                }))
              }
            />
          </aside>
        </>
      )}
    </main>
  );
}
