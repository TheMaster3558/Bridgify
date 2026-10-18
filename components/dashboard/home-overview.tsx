"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Eye,
  FileSignature,
  Home,
  ListChecks,
  Plus,
  Search,
} from "lucide-react";
import {
  DotChip,
  InitialsAvatar,
  Pill,
  iconButton,
  menuContent,
  menuItem,
  type PillTone,
} from "@/components/dashboard/table-ui";
import {
  settingsButton,
  settingsPrimaryButton,
} from "@/components/settings/settings-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientKey } from "@/lib/clients/photos";
import type { HomeOverview as Overview } from "@/lib/dashboard/home";
import type {
  Heatmap,
  Series,
  SeriesMode,
} from "@/lib/dashboard/activity-series";
import { cn } from "@/lib/utils";

type Decision = Overview["decisions"]["items"][number];
type Handled = Overview["handled"][number];
type Work = Overview["work"][number];
type Photos = Record<string, string>;

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

const toneDot: Record<PillTone, string> = {
  red: "bg-rose-500",
  yellow: "bg-yellow-400",
  green: "bg-lime-500",
  cyan: "bg-cyan-500",
  blue: "bg-blue-500",
  gray: "bg-neutral-400",
};

const handledState: Record<
  Handled["state"],
  { label: string; tone: PillTone }
> = {
  accepted: { label: "Accepted", tone: "green" },
  awaiting_details: { label: "Clarifying", tone: "yellow" },
  closed: { label: "Closed", tone: "gray" },
};

const taskStatus: Record<Work["status"], { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-blue-500" },
  in_progress: { label: "In progress", dot: "bg-violet-500" },
};

const priorityTone: Record<Work["priority"], PillTone> = {
  high: "red",
  normal: "blue",
  low: "gray",
};

const originTone: Record<Work["origin"], PillTone> = {
  auto: "cyan",
  agreement: "green",
  proposal: "blue",
  manual: "gray",
};

const modes: { id: SeriesMode; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const periodName: Record<SeriesMode, string> = {
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
};

// Outer panels are white on the gray page; tiles inside them are gray, the
// inverse of the template so they still stand apart from the background.
const panel =
  "min-w-0 overflow-hidden rounded-[22px] border border-sidebar-border bg-card p-2";
const tile = "rounded-2xl bg-sidebar";

function label(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

// Relative to the server's render time so server and client agree.
function ago(value: string, now: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.parse(now) - Date.parse(value)) / 60_000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return days < 14 ? "A week ago" : `${Math.round(days / 7)} weeks ago`;
}

function age(value: string, now: string) {
  const hours = Math.max(0, (Date.parse(now) - Date.parse(value)) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 24) return plural(Math.round(hours), "hour");
  return plural(Math.round(hours / 24), "day");
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function agreedDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "2-digit", year: "numeric" },
  );
}

function money(cents: number | null, currency: string) {
  if (cents === null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

// A round axis maximum with an integer midpoint.
function niceMax(value: number) {
  if (value <= 2) return 2;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [2, 4, 6, 8, 10])
    if (step * power >= value) return step * power;
  return 10 * power;
}

function compact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function photoOf(photos: Photos, name: string) {
  return photos[clientKey(name)] ?? null;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  let text = "0%";
  let tone = "bg-sidebar-accent text-neutral-600 dark:text-neutral-300";
  if (previous > 0 && current !== previous) {
    const pct = ((current - previous) / previous) * 100;
    text = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
    tone =
      pct > 0
        ? "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200"
        : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  } else if (previous === 0 && current > 0) {
    text = `+${current.toLocaleString("en-US")}`;
    tone = "bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200";
  }
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums",
        tone,
      )}
    >
      {text}
    </span>
  );
}

function Headline({
  title,
  value,
  children,
}: {
  title: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <p className="text-[15px] text-neutral-500 dark:text-neutral-400">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[28px] leading-tight font-medium tracking-tight tabular-nums">
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}

function ModeTabs({
  value,
  onChange,
  label: groupLabel,
}: {
  value: SeriesMode;
  onChange: (mode: SeriesMode) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-1">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-pressed={value === mode.id}
          onClick={() => onChange(mode.id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[15px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40",
            value === mode.id
              ? "bg-sidebar font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10"
              : "text-neutral-500 hover:text-foreground dark:text-neutral-400",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function YAxis({ max }: { max: number }) {
  return (
    <div
      aria-hidden
      className="flex w-9 shrink-0 flex-col justify-between pb-7 text-right text-xs text-neutral-400 tabular-nums dark:text-neutral-500"
    >
      <span className="-translate-y-1/2">{compact(max)}</span>
      <span>{compact(max / 2)}</span>
      <span className="translate-y-1/2">0</span>
    </div>
  );
}

function BarChart({ series, unit }: { series: Series; unit: string }) {
  const max = niceMax(Math.max(...series.values));
  return (
    <div className="flex h-[260px] gap-3 px-3 pt-4 pb-2">
      <YAxis max={max} />
      <ol className="flex min-w-0 flex-1 gap-1.5 sm:gap-2.5">
        {series.values.map((value, i) => {
          const future = i > series.current;
          const text = `${series.labels[i]}: ${plural(value, unit)}`;
          return (
            <li
              key={series.labels[i]}
              className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div
                title={future ? undefined : text}
                className={cn(
                  "relative w-full max-w-10 flex-1 overflow-hidden rounded-full",
                  future ? "bg-sidebar" : "bg-sidebar-accent/70",
                )}
              >
                {!future && value > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-full bg-lime-400 transition-[height,background-color] duration-500 group-hover:bg-lime-500"
                    style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
                  />
                )}
                {!future && <span className="sr-only">{text}</span>}
              </div>
              <span
                aria-hidden
                className={cn(
                  "w-full truncate text-center text-xs text-neutral-500 dark:text-neutral-400",
                  i === series.current && "font-medium text-foreground",
                )}
              >
                {series.labels[i]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Smooth curve through the points (Catmull-Rom converted to cubic Béziers).
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function LineChart({ series, unit }: { series: Series; unit: string }) {
  const width = 600;
  const height = 200;
  const max = niceMax(Math.max(...series.values));
  const step = width / Math.max(1, series.values.length - 1);
  const points = series.values
    .slice(0, series.current + 1)
    .map(
      (value, i) =>
        [i * step, height - (value / max) * (height - 6) - 3] as [
          number,
          number,
        ],
    );
  const line = smoothPath(points);
  const last = points[points.length - 1];
  return (
    <div className="flex h-[260px] gap-3 px-3 pt-4 pb-2">
      <YAxis max={max} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative flex-1">
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col justify-between"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="border-t border-dashed border-sidebar-border"
              />
            ))}
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            role="img"
            aria-label={series.labels
              .slice(0, series.current + 1)
              .map((l, i) => `${l}: ${plural(series.values[i], unit)}`)
              .join(", ")}
          >
            <defs>
              <linearGradient id="home-line-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#a3e635" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
              </linearGradient>
            </defs>
            {points.length > 1 && (
              <>
                <path
                  d={`${line} L${last[0]},${height} L0,${height} Z`}
                  fill="url(#home-line-fill)"
                />
                <path
                  d={line}
                  fill="none"
                  stroke="#84cc16"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </svg>
          {last && (
            <span
              aria-hidden
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-lime-500 shadow"
              style={{
                left: `${(last[0] / width) * 100}%`,
                top: `${(last[1] / height) * 100}%`,
              }}
            />
          )}
          <div className="absolute inset-0 flex">
            {series.values.map((value, i) => (
              <span
                key={series.labels[i]}
                className="flex-1"
                title={
                  i <= series.current
                    ? `${series.labels[i]}: ${plural(value, unit)}`
                    : undefined
                }
              />
            ))}
          </div>
        </div>
        <div
          aria-hidden
          className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400"
        >
          {series.labels.map((l, i) => (
            <span
              key={l}
              className={cn(
                "w-0 overflow-visible text-center whitespace-nowrap",
                // Thin out labels on small screens.
                i % 2 === 1 && series.labels.length > 6 && "max-sm:invisible",
                i === series.current && "font-medium text-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-block",
                  i === 0
                    ? ""
                    : i === series.labels.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
              >
                {l}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  unit,
  data,
  chart,
}: {
  title: string;
  unit: string;
  data: Record<SeriesMode, Series>;
  chart: "bar" | "line";
}) {
  const [mode, setMode] = useState<SeriesMode>("monthly");
  const series = data[mode];
  const current = series.values[series.current] ?? 0;
  return (
    <section aria-label={title} className={cn(panel, "flex flex-col")}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 pt-2">
        <Headline title={title} value={current.toLocaleString("en-US")}>
          <Delta current={current} previous={series.previous} />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {periodName[mode]}
          </span>
        </Headline>
        <ModeTabs value={mode} onChange={setMode} label={`${title} period`} />
      </div>
      {chart === "bar" ? (
        <BarChart series={series} unit={unit} />
      ) : (
        <LineChart series={series} unit={unit} />
      )}
    </section>
  );
}

const heatTones = [
  "bg-sidebar-accent",
  "bg-blue-200 dark:bg-blue-900",
  "bg-blue-300 dark:bg-blue-700",
  "bg-blue-500 dark:bg-blue-500",
  "bg-blue-700 dark:bg-blue-300",
];

function heatLevel(count: number, busiest: number) {
  if (!count || !busiest) return 0;
  return Math.min(4, Math.ceil((count / busiest) * 4));
}

function ActivityCard({
  heatmap,
  requestsAccepted,
}: {
  heatmap: Heatmap;
  requestsAccepted: number;
}) {
  const stats = [
    { value: plural(heatmap.activeDays, "day"), label: "Active days" },
    { value: compact(heatmap.busiest), label: "Busiest day" },
    { value: compact(requestsAccepted), label: "Requests accepted" },
    { value: plural(heatmap.longestStreak, "day"), label: "Top streak" },
  ];
  return (
    <section
      aria-label="Client conversations this year"
      className={cn(panel, "flex flex-col")}
    >
      <div className="px-3 pt-2">
        <Headline
          title="Client conversations this year"
          value={heatmap.total.toLocaleString("en-US")}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(tile, "flex flex-col-reverse px-3 py-2.5")}
          >
            <dt className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              {s.label}
            </dt>
            <dd className="truncate text-[17px] font-medium tabular-nums">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <p className="text-[15px] text-neutral-500 dark:text-neutral-400">
          Activity
        </p>
        <div
          aria-hidden
          className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400"
        >
          Less
          {heatTones.map((tone) => (
            <span key={tone} className={cn("size-2.5 rounded-[3px]", tone)} />
          ))}
          More
        </div>
      </div>
      <div className="settings-dialog-scroll overflow-x-auto px-3 pb-2">
        <div className="min-w-[520px]">
          <div
            role="img"
            aria-label={`${plural(heatmap.total, "message")} in the last year; the busiest day had ${heatmap.busiest}.`}
            className="grid grid-flow-col grid-cols-[repeat(53,minmax(0,1fr))] grid-rows-7 gap-[3px]"
          >
            {heatmap.weeks.flatMap((week, column) =>
              week.map((day, row) => (
                <span
                  key={`${column}-${row}`}
                  title={
                    day
                      ? `${day.label}: ${plural(day.count, "message")}`
                      : undefined
                  }
                  className={cn(
                    "aspect-square rounded-[3px]",
                    day
                      ? heatTones[heatLevel(day.count, heatmap.busiest)]
                      : "bg-transparent",
                  )}
                />
              )),
            )}
          </div>
          <div
            aria-hidden
            className="mt-2 grid grid-cols-[repeat(53,minmax(0,1fr))] text-xs text-neutral-500 dark:text-neutral-400"
          >
            {heatmap.months.map((m) => (
              <span
                key={`${m.column}-${m.label}`}
                className="col-span-4 whitespace-nowrap"
                style={{ gridColumnStart: Math.min(m.column + 1, 50) }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

type QueueView = "decisions" | "handled";

function QueueTile({
  href,
  name,
  photo,
  title,
  meta,
  chip,
  dot,
}: {
  href: string;
  name: string;
  photo: string | null;
  title: string;
  meta: string;
  chip: string;
  dot: string;
}) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className={cn(
          tile,
          "grid h-full content-between gap-3 p-2.5 outline-none transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40",
        )}
      >
        <div className="flex min-w-0 items-center gap-3 px-1 pt-1">
          <InitialsAvatar name={name || title} size="md" src={photo} />
          <div className="grid min-w-0">
            <span className="truncate font-medium">{title}</span>
            <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              {meta}
            </span>
          </div>
        </div>
        <span className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-card px-2 py-1 text-sm text-neutral-600 dark:bg-background dark:text-neutral-300">
          <span
            aria-hidden
            className={cn("size-1.5 shrink-0 rounded-full", dot)}
          />
          <span className="truncate">{chip}</span>
        </span>
      </Link>
    </li>
  );
}

function QueueCard({
  decisions,
  decisionCount,
  handled,
  handledThisWeek,
  photos,
  now,
}: {
  decisions: Decision[];
  decisionCount: number;
  handled: Handled[];
  handledThisWeek: number;
  photos: Photos;
  now: string;
}) {
  const [view, setView] = useState<QueueView>("decisions");
  const [page, setPage] = useState(0);
  const items = view === "decisions" ? decisions : handled;
  const pages = Math.max(1, Math.ceil(items.length / 4));
  const title =
    view === "decisions" ? "Needs your decision" : "Handled automatically";
  const choose = (next: QueueView) => {
    setView(next);
    setPage(0);
  };
  const tiles =
    view === "decisions"
      ? decisions.slice(page * 4, page * 4 + 4).map((d) => {
          const tone = reasonTone[d.reason] ?? "gray";
          return (
            <QueueTile
              key={d.id}
              href={`/app/decisions?decision=${d.id}`}
              name={d.project.client_name}
              photo={photoOf(photos, d.project.client_name)}
              title={d.title}
              meta={`${d.project.name} · ${ago(d.createdAt, now)}`}
              chip={label(d.reason)}
              dot={toneDot[tone]}
            />
          );
        })
      : handled.slice(page * 4, page * 4 + 4).map((h) => {
          const state = handledState[h.state];
          return (
            <QueueTile
              key={h.id}
              href={`/app/projects/${h.projectId}/requests/${h.id}`}
              name={h.project.client_name}
              photo={photoOf(photos, h.project.client_name)}
              title={h.summary}
              meta={`${h.project.name} · ${ago(h.updatedAt, now)}`}
              chip={h.taskCode ? `${state.label} → ${h.taskCode}` : state.label}
              dot={toneDot[state.tone]}
            />
          );
        });
  return (
    <section aria-label={title} className={cn(panel, "flex flex-col")}>
      <div className="flex items-start justify-between gap-3 px-3 pt-2">
        <Headline
          title={title}
          value={(view === "decisions"
            ? decisionCount
            : handledThisWeek
          ).toLocaleString("en-US")}
        >
          {view === "handled" && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              this week
            </span>
          )}
        </Headline>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[15px] font-medium outline-none hover:bg-sidebar focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40">
            {view === "decisions" ? "Decisions" : "Handled"}
            <ChevronDown aria-hidden className="size-4 text-neutral-500" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className={menuContent}
            >
              <DropdownMenu.RadioGroup
                value={view}
                onValueChange={(v) => choose(v as QueueView)}
              >
                <DropdownMenu.RadioItem
                  value="decisions"
                  className={cn(menuItem, "justify-between gap-6")}
                >
                  Needs your decision
                  <span className="text-neutral-500 tabular-nums">
                    {decisionCount}
                  </span>
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="handled"
                  className={cn(menuItem, "justify-between gap-6")}
                >
                  Handled automatically
                  <span className="text-neutral-500 tabular-nums">
                    {handledThisWeek}
                  </span>
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className="my-1 h-px bg-sidebar-border" />
              <DropdownMenu.Item asChild className={menuItem}>
                <Link href="/app/decisions">Open Needs Attention</Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {tiles.length ? (
        <ul className="mt-3 grid flex-1 auto-rows-fr gap-2 sm:grid-cols-2">
          {tiles}
        </ul>
      ) : (
        <p
          className={cn(
            tile,
            "mt-3 grid flex-1 place-items-center px-6 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400",
          )}
        >
          {view === "decisions"
            ? "No open decisions. New exceptions will show up here."
            : "Client requests the assistant handles on its own will appear here."}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { dir: -1, text: "Previous", Icon: ArrowLeft },
          { dir: 1, text: "Next", Icon: ArrowRight },
        ].map(({ dir, text, Icon }) => (
          <button
            key={text}
            type="button"
            disabled={dir < 0 ? page === 0 : page >= pages - 1}
            onClick={() => setPage((p) => p + dir)}
            className={cn(
              tile,
              "inline-flex h-10 items-center justify-center gap-2 text-[15px] font-medium outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 disabled:pointer-events-none disabled:opacity-45",
              dir > 0 && "flex-row-reverse",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}

function StatCard({
  href,
  icon: Icon,
  title,
  value,
  pill,
  tone,
}: {
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  value: number;
  pill: string;
  tone: PillTone;
}) {
  return (
    <Link
      href={href}
      className={cn(
        panel,
        "group grid gap-1 p-4 outline-none transition-[border-color,box-shadow] hover:border-neutral-300 hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:hover:border-neutral-600",
      )}
    >
      <span
        aria-hidden
        className="mb-4 grid size-9 place-items-center rounded-xl bg-sidebar text-foreground ring-1 ring-black/5 dark:ring-white/10"
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="text-[15px] text-neutral-500 dark:text-neutral-400">
        {title}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-[28px] leading-tight font-medium tracking-tight tabular-nums">
          {value.toLocaleString("en-US")}
        </span>
        <Pill tone={tone}>
          <span className="max-w-44 truncate">{pill}</span>
        </Pill>
      </span>
    </Link>
  );
}

const filterTrigger =
  "h-9 w-full rounded-xl border-sidebar-border bg-card px-3 text-[15px] font-medium shadow-none sm:w-auto dark:bg-background";

function WorkTable({
  work,
  photos,
  total,
}: {
  work: Work[];
  photos: Photos;
  total: number;
}) {
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return work.filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (priority === "all" || t.priority === priority) &&
        (!q ||
          [t.title, t.code, t.project.name, t.project.client_name]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [work, status, priority, query]);
  return (
    <section
      aria-labelledby="home-work-heading"
      className="@container min-w-0 overflow-hidden rounded-[22px] border border-sidebar-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="grid">
          <p className="text-[15px] text-neutral-500 dark:text-neutral-400">
            Work next
          </p>
          <h2 id="home-work-heading" className="text-[15px] font-medium">
            {plural(total, "ready or in-progress task")}
          </h2>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status filter" className={filterTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger
              aria-label="Priority filter"
              className={filterTrigger}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <label className="relative flex h-9 w-full items-center sm:w-52">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 size-4 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search tasks"
              className="size-full rounded-xl bg-sidebar pr-3 pl-9 text-[15px] outline-none placeholder:text-neutral-400 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            />
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead className="border-y border-sidebar-border bg-sidebar text-neutral-500 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Task</th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="hidden px-3 py-2.5 text-left font-medium @3xl:table-cell">
                Accepted via
              </th>
              <th className="hidden px-3 py-2.5 text-left font-medium @2xl:table-cell">
                Priority
              </th>
              <th className="hidden px-3 py-2.5 text-left font-medium @4xl:table-cell">
                Agreed date
              </th>
              <th className="hidden px-3 py-2.5 text-left font-medium @xl:table-cell">
                Last updated
              </th>
              <th className="relative px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => (
              <tr
                key={task.id}
                className="border-b border-sidebar-border transition-colors last:border-b-0 hover:bg-sidebar"
              >
                <td className="max-w-0 px-4 py-2.5 @2xl:w-[34%]">
                  <div className="flex min-w-0 items-center gap-3">
                    <InitialsAvatar
                      name={task.project.client_name || task.project.name}
                      src={photoOf(photos, task.project.client_name)}
                    />
                    <div className="grid min-w-0">
                      <Link
                        href={`/app/tasks/${task.id}`}
                        className="truncate font-medium outline-none hover:underline focus-visible:underline"
                      >
                        {task.title}
                      </Link>
                      <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                        <span className="font-mono text-xs">{task.code}</span> ·{" "}
                        {task.project.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <DotChip dot={taskStatus[task.status].dot}>
                    {taskStatus[task.status].label}
                  </DotChip>
                </td>
                <td className="hidden max-w-52 px-3 py-2.5 @3xl:table-cell">
                  <span className="block truncate">
                    <Pill tone={originTone[task.origin]}>
                      {task.originText || label(task.origin)}
                    </Pill>
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 @2xl:table-cell">
                  <Pill tone={priorityTone[task.priority]}>
                    <span className="capitalize">{task.priority}</span>
                  </Pill>
                </td>
                <td className="hidden px-3 py-2.5 whitespace-nowrap @4xl:table-cell">
                  {agreedDate(task.agreedDueDate) ?? (
                    <span className="text-neutral-400 dark:text-neutral-500">
                      No date agreed
                    </span>
                  )}
                </td>
                <td className="hidden px-3 py-2.5 whitespace-nowrap @xl:table-cell">
                  {shortDate(task.updatedAt)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end">
                    <Link
                      href={`/app/tasks/${task.id}`}
                      aria-label={`Open ${task.title}`}
                      className={iconButton}
                    >
                      <Eye aria-hidden className="size-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-neutral-500 dark:text-neutral-400"
                >
                  {work.length
                    ? "No tasks match these filters."
                    : "No ready or in-progress tasks right now."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-sidebar-border px-4 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
        <span>
          Showing {rows.length} of {total.toLocaleString("en-US")}
        </span>
        <Link
          href="/app/tasks"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          View all tasks
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

export function HomeOverview({
  data,
  clientPhotos,
  organization,
  greeting,
  refreshedAt,
}: {
  data: Overview;
  clientPhotos: Photos;
  organization: string;
  greeting: string;
  refreshedAt: string;
}) {
  const { tasks, decisions, proposals, issues, activity, now } = data;
  const deliveryProblems = issues.deliveryUnknown + issues.deliveryFailed;
  const issueCount = deliveryProblems + issues.failedJobs;
  const latest = proposals.latest;
  const latestPrice = latest && money(latest.cents, latest.currency);
  return (
    <main className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4 p-4 md:px-8 md:py-6">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
      >
        {organization && (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <InitialsAvatar name={organization} size="sm" />
              <span className="truncate">{organization}</span>
            </span>
            <ChevronRight aria-hidden className="size-3.5 shrink-0" />
          </>
        )}
        <span
          aria-current="page"
          className="inline-flex items-center gap-1.5 font-medium text-foreground"
        >
          <Home aria-hidden className="size-4" />
          Home
        </span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-medium tracking-tight">{greeting}</h1>
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <span
            title={`Updated ${refreshedAt}`}
            className={cn(
              settingsButton,
              "h-10 max-w-full min-w-0 shrink gap-2 truncate rounded-xl px-3.5 text-[15px] hover:bg-card dark:hover:bg-background",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                deliveryProblems ? "bg-rose-500" : "bg-lime-500",
              )}
            />
            {deliveryProblems ? "Delivery needs a look" : "Messaging healthy"}
          </span>
          <Link
            href="/app/projects/new"
            className={cn(
              settingsPrimaryButton,
              "h-10 max-w-full min-w-0 shrink gap-1.5 rounded-xl px-4 text-[15px]",
            )}
          >
            <Plus aria-hidden className="size-4" />
            New project
          </Link>
        </div>
      </header>

      {issues.latest && (
        <div
          role="alert"
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertTriangle aria-hidden className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">
              {issues.latest.state === "unknown"
                ? `${plural(issues.deliveryUnknown, "message")} may not have reached the client.`
                : `${plural(issues.deliveryFailed, "message")} failed to send.`}
            </strong>{" "}
            <span className="text-rose-800/80 dark:text-rose-200/80">
              Latest: “
              {issues.latest.text.length > 90
                ? `${issues.latest.text.slice(0, 90).trimEnd()}…`
                : issues.latest.text}
              ” It has not been resent.
            </span>
          </p>
          <Link
            href={`/app/projects/${issues.latest.projectId}/automation`}
            className={settingsButton}
          >
            Inspect delivery
          </Link>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        <QueueCard
          decisions={decisions.items}
          decisionCount={decisions.count}
          handled={data.handled}
          handledThisWeek={data.handledThisWeek}
          photos={clientPhotos}
          now={now}
        />
        <ChartCard
          title="Tasks completed"
          unit="task"
          data={activity.completed}
          chart="bar"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)]">
        <ChartCard
          title="Handled without you"
          unit="message"
          data={activity.handled}
          chart="line"
        />
        <ActivityCard
          heatmap={activity.heatmap}
          requestsAccepted={activity.requestsAccepted}
        />
      </div>

      <section
        aria-label="Summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          href="/app/tasks?status=ready"
          icon={ListChecks}
          title="Ready tasks"
          value={tasks.ready}
          pill={`${tasks.inProgress} in progress${tasks.blocked ? ` · ${tasks.blocked} blocked` : ""}`}
          tone={tasks.blocked ? "yellow" : "blue"}
        />
        <StatCard
          href="/app/decisions"
          icon={CircleAlert}
          title="Decisions needed"
          value={decisions.count}
          pill={
            decisions.oldestAt
              ? `Oldest ${age(decisions.oldestAt, now)}`
              : "All caught up"
          }
          tone={decisions.count ? "yellow" : "green"}
        />
        <StatCard
          href="/app/proposals?status=awaiting_client"
          icon={FileSignature}
          title="Awaiting client approval"
          value={proposals.count}
          pill={
            latest
              ? [
                  latestPrice,
                  latest.sentAt &&
                    `sent ${ago(latest.sentAt, now).toLowerCase()}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sent"
              : "None waiting"
          }
          tone={proposals.count ? "blue" : "gray"}
        />
        <StatCard
          href={
            issues.latest
              ? `/app/projects/${issues.latest.projectId}/automation`
              : "/app/decisions"
          }
          icon={Bot}
          title="Automation issues"
          value={issueCount}
          pill={
            issueCount
              ? [
                  issues.deliveryUnknown && `${issues.deliveryUnknown} unknown`,
                  issues.deliveryFailed && `${issues.deliveryFailed} failed`,
                  issues.failedJobs && `${issues.failedJobs} processing`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Healthy"
          }
          tone={issueCount ? "red" : "green"}
        />
      </section>

      <WorkTable
        work={data.work}
        photos={clientPhotos}
        total={tasks.ready + tasks.inProgress}
      />
    </main>
  );
}
