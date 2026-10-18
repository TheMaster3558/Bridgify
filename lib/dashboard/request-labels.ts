// Plain-language labels for client requests, shared by the Requests inbox and
// the request case file.

export type RequestState =
  | "owner_review"
  | "awaiting_details"
  | "accepted"
  | "closed";

export const requestStates: {
  id: RequestState;
  label: string;
  empty: string;
  /** Left edge and dot colour. */
  tone: string;
  chip: string;
}[] = [
  {
    id: "owner_review",
    label: "Needs you",
    empty: "Nothing needs you. Bridgify brings new exceptions here.",
    tone: "bg-warn",
    chip: "bg-warn-soft text-warn",
  },
  {
    id: "awaiting_details",
    label: "Waiting on client",
    empty: "No open questions. When a request is missing details, Bridgify asks the client and it waits here.",
    tone: "bg-info",
    chip: "bg-info-soft text-info",
  },
  {
    id: "accepted",
    label: "Accepted",
    empty: "No accepted requests yet. Routine changes within your rules are accepted here and become tasks.",
    tone: "bg-ok",
    chip: "bg-ok-soft text-ok",
  },
  {
    id: "closed",
    label: "Closed",
    empty: "No closed requests.",
    tone: "bg-neutral-400",
    chip: "bg-sidebar-accent text-muted-foreground",
  },
];

export function requestStateMeta(state: string) {
  return (
    requestStates.find((s) => s.id === state) ?? {
      id: state,
      label: state.replaceAll("_", " "),
      empty: "",
      tone: "bg-neutral-400",
      chip: "bg-sidebar-accent text-muted-foreground",
    }
  );
}

const intentLabels: Record<string, string> = {
  new_request: "Change request",
  clarification_answer: "Answer to a question",
  correction: "Correction",
  cancellation: "Cancellation",
  status_question: "Status question",
  casual: "Casual message",
  dispute: "Dispute",
  unsupported: "Unsupported request",
};

export function intentLabel(intent: unknown) {
  return typeof intent === "string" ? (intentLabels[intent] ?? intent.replaceAll("_", " ")) : null;
}

const scopeLabels: Record<string, { label: string; chip: string }> = {
  included: { label: "In scope", chip: "bg-ok-soft text-ok" },
  excluded: { label: "Out of scope", chip: "bg-crit-soft text-crit" },
  uncertain: { label: "Scope unclear", chip: "bg-warn-soft text-warn" },
};

export function scopeLabel(value: unknown) {
  return typeof value === "string" ? (scopeLabels[value] ?? null) : null;
}

/** The client's own words recorded with the request, if any. */
export function clientQuote(intent: unknown) {
  const sources = (intent as { sources?: { quote?: unknown }[] } | null)?.sources;
  const quote = Array.isArray(sources) ? sources.find((s) => typeof s?.quote === "string")?.quote : null;
  return typeof quote === "string" ? quote : null;
}

export function relativeTime(value: string, now = Date.now()) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((then - now) / 1000);
  const format = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps)
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return "just now";
}
