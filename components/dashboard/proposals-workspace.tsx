"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Braces,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  LayoutGrid,
  List,
  MessageCircle,
  MessagesSquare,
  MoreVertical,
  Search,
  ScrollText,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DotChip,
  InitialsAvatar,
  PanelClose,
  PanelSection,
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
  panelFooter,
  panelHeader,
  tableCard,
  tableHead,
  tableRow,
  tableRowSelected,
} from "@/components/dashboard/table-ui";
import {
  settingsButton,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import { clientKey } from "@/lib/clients/photos";
import type { ProposalRevisionRecord } from "@/lib/dashboard/work-management-types";
import { cn } from "@/lib/utils";

type Proposal = ProposalRevisionRecord;
type SortKey = "title" | "price" | "expires" | "default";

function proposalCode(id: string) {
  return `P-${id.slice(0, 8).toUpperCase()}`;
}

function proposalKey(proposal: Proposal) {
  return `${proposal.proposal_id}-r${proposal.revision}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys)
    if (typeof record[key] === "string" && record[key])
      return record[key] as string;
  return "";
}

function priceCents(terms: Record<string, unknown>) {
  for (const key of [
    "amount_cents",
    "price_cents",
    "additional_price_cents",
    "total_cents",
  ]) {
    const value = terms[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function money(cents: number | null, currency = "USD") {
  if (cents === null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function readableStatus(status: string) {
  const text = status.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type StatusGroup = "draft" | "awaiting" | "approved" | "closed";
const statusFilters: { id: "all" | StatusGroup; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "awaiting", label: "Awaiting client" },
  { id: "approved", label: "Approved" },
  { id: "closed", label: "Closed" },
];

function statusGroup(status: string): StatusGroup {
  if (["awaiting_client", "sent"].includes(status)) return "awaiting";
  if (status === "approved") return "approved";
  if (
    ["superseded", "withdrawn", "expired", "rejected", "declined"].includes(
      status,
    )
  )
    return "closed";
  return "draft";
}

const statusDot: Record<StatusGroup, string> = {
  draft: "bg-blue-500",
  awaiting: "bg-yellow-400",
  approved: "bg-lime-500",
  closed: "bg-neutral-400",
};

function proposalTitle(proposal: Proposal) {
  const terms = objectValue(proposal.shared_terms);
  return stringField(terms, "title", "name", "summary") || "Proposal terms";
}

function proposalLines(terms: Record<string, unknown>) {
  const raw = Array.isArray(terms.lines)
    ? terms.lines
    : Array.isArray(terms.deliverables)
      ? terms.deliverables
      : [];
  return raw.map((item, index) => {
    if (typeof item === "string")
      return {
        key: `line-${index + 1}`,
        title: item,
        price: null as number | null,
      };
    const line = objectValue(item);
    const amount =
      typeof line.amount_cents === "number"
        ? line.amount_cents
        : typeof line.price_cents === "number"
          ? line.price_cents
          : null;
    return {
      key: stringField(line, "key", "id") || `line-${index + 1}`,
      title:
        stringField(line, "title", "description", "deliverable", "name") ||
        `Deliverable ${index + 1}`,
      price: amount,
    };
  });
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
    : [];
}

function StatusChip({ status }: { status: string }) {
  return (
    <DotChip dot={statusDot[statusGroup(status)]}>
      {readableStatus(status)}
    </DotChip>
  );
}

function PriceChip({ proposal }: { proposal: Proposal }) {
  const terms = objectValue(proposal.shared_terms);
  const cents = priceCents(terms);
  if (cents === null)
    return <span className="text-sm text-neutral-400">—</span>;
  return (
    <span className="inline-flex rounded-md bg-sidebar px-2 py-1 text-sm font-medium whitespace-nowrap tabular-nums dark:bg-sidebar-accent">
      {money(cents, stringField(terms, "currency") || "USD")}
    </span>
  );
}

function ProposalDetail({
  proposal,
  photo,
  onClose,
}: {
  proposal: Proposal;
  photo?: string | null;
  onClose: () => void;
}) {
  const terms = objectValue(proposal.shared_terms);
  const lines = proposalLines(terms);
  const currency = stringField(terms, "currency") || "USD";
  const explanation = stringField(
    terms,
    "explanation",
    "description",
    "client_explanation",
  );
  const lists = [
    { label: "Exclusions", items: textList(terms.exclusions) },
    { label: "Dependencies", items: textList(terms.dependencies) },
  ];
  const projectProposals = `/app/projects/${proposal.project_id}/proposals/${proposal.proposal_id}?revision=${proposal.revision}`;

  return (
    <>
      <header className={panelHeader}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="rounded-md bg-sidebar px-1.5 py-0.5 dark:bg-sidebar-accent">
              {proposalCode(proposal.proposal_id)}
            </span>
            <span className="rounded-md bg-sidebar px-1.5 py-0.5 dark:bg-sidebar-accent">
              r{proposal.revision}
            </span>
          </div>
          <PanelClose label="Close proposal details" onClick={onClose} />
        </div>
        <h2
          id="proposal-detail-title"
          className="text-xl leading-snug font-semibold tracking-tight break-words"
        >
          {proposalTitle(proposal)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={proposal.status} />
          <PriceChip proposal={proposal} />
        </div>
      </header>

      <div className="grid gap-7 px-6 py-6">
        <Link
          href={projectProposals}
          className="group flex items-center gap-3 rounded-2xl bg-sidebar p-3 outline-none hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
        >
          <InitialsAvatar name={proposal.client_name} size="md" src={photo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">
              {proposal.client_name}
            </span>
            <span className="block truncate text-sm text-neutral-500 dark:text-neutral-400">
              {proposal.project_name} · Proposals
            </span>
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </Link>

        <dl className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Additional price",
              value: money(priceCents(terms), currency),
            },
            {
              label: "Expires",
              value: proposal.expires_at
                ? formatShortDate(proposal.expires_at)
                : "No expiry",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-sidebar p-3.5">
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                {stat.label}
              </dt>
              <dd className="mt-1 truncate text-[17px] font-semibold tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <PanelSection icon={MessageCircle} title="What the client sees">
          {explanation ? (
            <div className="flex justify-end">
              <div className="w-fit max-w-[90%] rounded-[20px] rounded-br-md bg-gradient-to-b from-[#4a82ff] to-[#2563eb] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
                {explanation}
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No client-facing explanation is recorded in this revision.
            </p>
          )}
        </PanelSection>

        <PanelSection icon={ClipboardList} title="Deliverables">
          {lines.length ? (
            <ul className="divide-y divide-card overflow-hidden rounded-2xl bg-sidebar dark:divide-background">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <FileText
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-neutral-400"
                    />
                    <span className="text-[15px] break-words">
                      {line.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
                    {money(line.price, currency)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-4 bg-sidebar-accent px-4 py-3 text-[15px] font-semibold">
                <span>Additional project price</span>
                <span className="tabular-nums">
                  {money(priceCents(terms), currency)}
                </span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No deliverable lines are present in the stored terms.
            </p>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Approve work from Needs Attention to turn these lines into tasks.
          </p>
        </PanelSection>

        <PanelSection icon={ScrollText} title="Terms">
          <dl className="divide-y divide-card overflow-hidden rounded-2xl bg-sidebar dark:divide-background">
            {lists.map((list) => (
              <div key={list.label} className="grid gap-1 px-4 py-3">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                  {list.label}
                </dt>
                <dd className="text-[15px]">
                  {list.items.length ? (
                    <ul className="grid gap-1">
                      {list.items.map((item, index) => (
                        <li key={index} className="flex gap-2">
                          <ChevronRight
                            aria-hidden
                            className="mt-1 size-3.5 shrink-0 text-neutral-400"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-neutral-500 dark:text-neutral-400">
                      None recorded
                    </span>
                  )}
                </dd>
              </div>
            ))}
            <div className="grid gap-1 px-4 py-3">
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                Expires
              </dt>
              <dd className="text-[15px]">
                {proposal.expires_at
                  ? new Date(proposal.expires_at).toLocaleString()
                  : "No expiry recorded"}
              </dd>
            </div>
          </dl>
        </PanelSection>

        <details className="group rounded-2xl bg-sidebar">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-neutral-500 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-400">
            <Braces aria-hidden className="size-4" />
            Stored terms record
            <ChevronRight
              aria-hidden
              className="ml-auto size-4 transition-transform group-open:rotate-90"
            />
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-card px-4 py-3 font-mono text-xs break-words whitespace-pre-wrap dark:border-background">
            {JSON.stringify(proposal.shared_terms, null, 2)}
          </pre>
        </details>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Open the revision in its project to inspect delivery and recorded client decisions.
        </p>
      </div>

      <div className={panelFooter}>
        <div className="flex items-center gap-2">
          <Link
            href={projectProposals}
            className={cn(settingsPrimaryButton, "h-9 gap-1.5 px-4")}
          >
            <ArrowUpRight aria-hidden className="size-4" />
            Open in project
          </Link>
          <Link
            href={`/app/projects/${proposal.project_id}/conversation`}
            className={cn(settingsButton, "h-9 px-3.5")}
          >
            Conversation
          </Link>
        </div>
      </div>
    </>
  );
}

export function ProposalsWorkspace({
  proposals,
  clientPhotos = {},
  serverManaged = false,
}: {
  proposals: Proposal[];
  clientPhotos?: Record<string, string>;
  serverManaged?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] =
    useState<(typeof statusFilters)[number]["id"]>("all");
  const [view, setView] = useState<"list" | "board">("list");
  const [project, setProject] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "default",
    dir: "asc",
  });
  const photoFor = (name: string) => clientPhotos[clientKey(name)];

  const projects = useMemo(
    () => [
      ...new Map(
        proposals.map((proposal) => [proposal.project_id, proposal]),
      ).values(),
    ],
    [proposals],
  );
  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return proposals.filter(
      (proposal) =>
        (project === "all" || proposal.project_id === project) &&
        (!needle ||
          proposalTitle(proposal).toLowerCase().includes(needle) ||
          proposalCode(proposal.proposal_id).toLowerCase().includes(needle)),
    );
  }, [proposals, project, query]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: scoped.length };
    for (const proposal of scoped) {
      const group = statusGroup(proposal.status);
      result[group] = (result[group] ?? 0) + 1;
    }
    return result;
  }, [scoped]);
  const visible = useMemo(() => {
    if (serverManaged) return proposals;
    const rows = scoped.filter(
      (proposal) => filter === "all" || statusGroup(proposal.status) === filter,
    );
    if (sort.key === "default") return rows;
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "title")
        return proposalTitle(a).localeCompare(proposalTitle(b)) * direction;
      if (sort.key === "price")
        return (
          ((priceCents(objectValue(a.shared_terms)) ?? -1) -
            (priceCents(objectValue(b.shared_terms)) ?? -1)) *
          direction
        );
      return (
        (a.expires_at || "9999").localeCompare(b.expires_at || "9999") *
        direction
      );
    });
  }, [scoped, filter, sort, serverManaged, proposals]);
  const selected =
    proposals.find((proposal) => proposalKey(proposal) === selectedKey) ?? null;
  const pending = proposals.filter(
    (proposal) => statusGroup(proposal.status) === "awaiting",
  ).length;

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as Element | null;
      if (
        event.key === "Escape" &&
        !target?.closest?.('[role="listbox"],[role="menu"]')
      )
        setSelectedKey(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

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
        : { key, dir: key === "price" ? "desc" : "asc" },
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
            <h1 className="font-display text-2xl font-semibold">Proposals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Private commercial records. Discuss changes with clients through
              iMessage.
            </p>
          </div>
          <div
            role="group"
            aria-label="Choose proposal view"
            className="flex items-center gap-1 rounded-full bg-sidebar-accent p-1"
          >
            {(
              [
                ["list", "List view", List],
                ["board", "Board view", LayoutGrid],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "grid size-7 place-items-center rounded-full text-neutral-500 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-400",
                  view === id &&
                    "bg-card text-foreground shadow-sm dark:bg-neutral-700 dark:text-white",
                )}
              >
                <Icon aria-hidden className="size-4" />
              </button>
            ))}
          </div>
        </header>

        {!serverManaged && <>
        <section
          aria-label="Proposal filters and view options"
          className="grid gap-3"
        >
          <div
            role="group"
            aria-label="Filter by status"
            className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1"
          >
            {statusFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  filterButton,
                  filter === item.id ? filterActive : filterIdle,
                )}
              >
                {item.label} ({counts[item.id] ?? 0})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 w-full items-center gap-2 rounded-full bg-sidebar-accent px-3 text-neutral-500 focus-within:ring-[3px] focus-within:ring-sidebar-ring/40 sm:w-64 dark:text-neutral-400">
              <Search aria-hidden className="size-[18px] shrink-0" />
              <span className="sr-only">Search proposals</span>
              <input
                value={query}
                placeholder="Search proposals"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger
                aria-label="Project filter"
                className="h-9 w-full max-w-64 rounded-full border-0 bg-sidebar-accent px-3.5 text-sm font-medium shadow-none sm:w-56"
              >
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((item) => (
                  <SelectItem key={item.project_id} value={item.project_id}>
                    <InitialsAvatar
                      name={item.client_name}
                      src={photoFor(item.client_name)}
                    />
                    <span className="truncate">{item.project_name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        </>}
        {pending > 0 && (
          <button
            type="button"
            onClick={() => {
              setFilter("awaiting");
              setView("list");
            }}
            className="group flex items-center gap-3 rounded-2xl bg-yellow-50 p-4 text-left ring-1 ring-yellow-200 ring-inset outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-yellow-400/10 dark:ring-yellow-400/25"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full bg-yellow-400"
            />
            <span className="flex-1 text-[15px] text-yellow-950 dark:text-yellow-50">
              <span className="font-medium">
                {pending} proposal{pending === 1 ? "" : "s"} awaiting client
                review.
              </span>{" "}
              Follow-ups are owner-reviewed.
            </span>
            <ChevronRight
              aria-hidden
              className="size-4 text-yellow-600 transition-transform group-hover:translate-x-0.5 dark:text-yellow-300"
            />
          </button>
        )}

        {view === "list" ? (
          <section aria-labelledby="proposals-heading" className={tableCard}>
            <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <h2 id="proposals-heading" className="text-[17px] font-medium">
                {filter === "all"
                  ? "All proposals"
                  : `${statusFilters.find((item) => item.id === filter)?.label} proposals`}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Approved proposals become tasks in Actionable Tasks.
              </p>
            </div>
            {visible.length === 0 ? (
              <div className="grid place-items-center border-t border-sidebar-border px-4 py-14 text-center">
                <FileText
                  aria-hidden
                  className="mb-2 size-6 text-neutral-400"
                />
                <p className="text-[15px] font-medium">No proposals to show</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Proposal revisions saved for your projects will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className={tableHead}>
                    <tr>
                      <th scope="col" className={cn(headCell, "pl-4")}>
                        <SortHeader
                          label="Proposal"
                          sortKey="title"
                          sort={sort}
                          onSort={onSort}
                        />
                      </th>
                      <th scope="col" className={headCell}>
                        Project
                      </th>
                      <th scope="col" className={headCell}>
                        Status
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "hidden @3xl:table-cell")}
                      >
                        <SortHeader
                          label="Additional price"
                          sortKey="price"
                          sort={sort}
                          onSort={onSort}
                        />
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "hidden @4xl:table-cell")}
                      >
                        <SortHeader
                          label="Expires"
                          sortKey="expires"
                          sort={sort}
                          onSort={onSort}
                        />
                      </th>
                      <th
                        scope="col"
                        className={cn(headCell, "pr-4 text-right")}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((proposal) => {
                      const key = proposalKey(proposal);
                      const isSelected = selectedKey === key;
                      return (
                        <tr
                          key={key}
                          onClick={() => setSelectedKey(key)}
                          aria-selected={isSelected}
                          className={cn(
                            tableRow,
                            isSelected && tableRowSelected,
                          )}
                        >
                          <td className="py-2 pr-3 pl-4">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedKey(key);
                              }}
                              aria-current={isSelected ? "true" : undefined}
                              className="block max-w-[26rem] min-w-44 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
                            >
                              <span className="line-clamp-1 text-[15px] leading-5 font-medium text-foreground">
                                {proposalTitle(proposal)}
                              </span>
                              <span className="font-mono text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                                {proposalCode(proposal.proposal_id)} · r
                                {proposal.revision}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex max-w-56 items-center gap-2.5">
                              <InitialsAvatar
                                name={proposal.client_name}
                                src={photoFor(proposal.client_name)}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-[15px] leading-5">
                                  {proposal.project_name}
                                </p>
                                <p className="truncate text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                                  {proposal.client_name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusChip status={proposal.status} />
                          </td>
                          <td className="hidden px-3 py-2 @3xl:table-cell">
                            <PriceChip proposal={proposal} />
                          </td>
                          <td className="hidden px-3 py-2 text-[15px] whitespace-nowrap tabular-nums @4xl:table-cell">
                            {proposal.expires_at ? (
                              formatShortDate(proposal.expires_at)
                            ) : (
                              <span className="text-neutral-500 dark:text-neutral-400">
                                No expiry
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 pl-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                aria-label={`Review ${proposalTitle(proposal)}`}
                                className={iconButton}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedKey(key);
                                }}
                              >
                                <Eye aria-hidden className="size-4" />
                              </button>
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger
                                  aria-label={`More actions for ${proposalTitle(proposal)}`}
                                  className={iconButton}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreVertical
                                    aria-hidden
                                    className="size-4"
                                  />
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    sideOffset={6}
                                    className={menuContent}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <DropdownMenu.Item
                                      className={menuItem}
                                      onSelect={() => setSelectedKey(key)}
                                    >
                                      <Eye aria-hidden className="size-4" />
                                      Review proposal
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      asChild
                                      className={menuItem}
                                    >
                                      <Link
                                        href={`/app/projects/${proposal.project_id}/proposals`}
                                      >
                                        <ArrowUpRight
                                          aria-hidden
                                          className="size-4"
                                        />
                                        Open in project
                                      </Link>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      asChild
                                      className={menuItem}
                                    >
                                      <Link
                                        href={`/app/projects/${proposal.project_id}/conversation`}
                                      >
                                        <MessagesSquare
                                          aria-hidden
                                          className="size-4"
                                        />
                                        Open conversation
                                      </Link>
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="flex flex-wrap justify-between gap-2 border-t border-sidebar-border px-4 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
              <span>
                {visible.length} of {proposals.length} revisions
              </span>
            </footer>
          </section>
        ) : (
          <section
            className="overflow-x-auto pb-1"
            aria-label="Proposals by status"
          >
            <div className="grid min-w-[880px] grid-cols-4 gap-3">
              {statusFilters.slice(1).map((column) => {
                const columnProposals = scoped.filter(
                  (proposal) => statusGroup(proposal.status) === column.id,
                );
                return (
                  <div
                    key={column.id}
                    className="flex min-h-48 flex-col gap-2 rounded-2xl bg-sidebar p-2.5"
                  >
                    <h2 className="flex items-center gap-2 px-1.5 py-1 text-sm font-medium">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          statusDot[column.id as StatusGroup],
                        )}
                      />
                      {column.label}
                      <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-neutral-500 dark:bg-background dark:text-neutral-400">
                        {columnProposals.length}
                      </span>
                    </h2>
                    {columnProposals.map((proposal) => {
                      const key = proposalKey(proposal);
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => setSelectedKey(key)}
                          className={cn(
                            "grid min-w-0 gap-2.5 rounded-xl bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-sidebar-border outline-none transition-shadow hover:ring-blue-300 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:bg-background",
                            selectedKey === key && "ring-2 ring-blue-500",
                          )}
                        >
                          <span className="min-w-0 text-[15px] leading-snug font-medium break-words">
                            {proposalTitle(proposal)}
                          </span>
                          <span className="flex min-w-0 items-center gap-2">
                            <InitialsAvatar
                              name={proposal.client_name}
                              src={photoFor(proposal.client_name)}
                            />
                            <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                              {proposal.project_name}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <PriceChip proposal={proposal} />
                            <span className="ml-auto font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                              {proposalCode(proposal.proposal_id)} · r
                              {proposal.revision}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Proposal data is loaded from stored revisions. Clients discuss terms
          through the project conversation and have no website access.
        </p>
      </div>

      {selected && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
            onClick={() => setSelectedKey(null)}
          />
          <aside aria-labelledby="proposal-detail-title" className={panelAside}>
            <ProposalDetail
              key={proposalKey(selected)}
              proposal={selected}
              photo={photoFor(selected.client_name)}
              onClose={() => setSelectedKey(null)}
            />
          </aside>
        </>
      )}
    </main>
  );
}
