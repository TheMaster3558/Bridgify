import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Reveal } from "./motion";
import { ArrowLink, Kicker, Pill, SIGN_UP_HREF, tones } from "./ui";

/* ---------- Plan data (single source for the landing section and /pricing/) ---------- */

export type Billing = "monthly" | "annual";

export const PERSON_DEFINITION =
  "A person is anyone on your side of the work: you and the teammates you add to your Bridgify workspace. Clients in the iMessage group are always free and never count toward your limit.";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const formatMoney = (n: number) => money.format(n);

export const ANNUAL_DISCOUNT = 0.2;

type Plan = {
  id: "basic" | "pro" | "enterprise";
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  people: string;
  limits: string[];
  highlights: string[];
  cta: { label: string; href: string };
  featured?: boolean;
};

export const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "For solo freelancers and small duos.",
    monthly: 27,
    annual: 22,
    people: "Up to 3 people",
    limits: ["3 active projects", "500 client messages handled / month"],
    highlights: [
      "iMessage assistant in verified client groups",
      "Automatic acceptance within your rules",
      "Agreement import with source evidence",
      "Revision ledger and owner dashboard",
      "Proposals with client approval pages",
    ],
    cta: { label: "Try for free", href: SIGN_UP_HREF },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For studios juggling several clients at once.",
    monthly: 65,
    annual: 52,
    people: "Up to 7 people",
    limits: ["15 active projects", "3,000 client messages handled / month"],
    highlights: [
      "Everything in Basic",
      "Contractual revision rounds (planned)",
      "Private owner escalation in iMessage (planned)",
      "History export and policy simulator (planned)",
      "Priority email support",
    ],
    cta: { label: "Try for free", href: SIGN_UP_HREF },
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For agencies that need their own setup.",
    monthly: 249,
    annual: 199,
    people: "8 or more people, you choose",
    limits: ["Projects and message volume you choose", "Longer data retention options"],
    highlights: [
      "Everything in Pro",
      "Pick seats, projects, volume and retention",
      "Named support contact",
      "Dedicated onboarding",
      "SSO on request (planned)",
    ],
    cta: { label: "Build your plan", href: "/pricing#enterprise" },
  },
];

/* ---------- Pieces ---------- */

export function Planned() {
  return <Pill tone={tones.peach}>Planned</Pill>;
}

export function BillingToggle({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="relative inline-grid grid-cols-2 rounded-full bg-mist-gray p-1" role="group" aria-label="Billing period">
        <span
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow-subtle transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: value === "annual" ? "translateX(100%)" : "none" }}
          aria-hidden="true"
        />
        {(["monthly", "annual"] as const).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={value === b}
            onClick={() => onChange(b)}
            className={`relative z-10 h-9 rounded-full px-5 font-sohne text-[14px] font-[430] transition-colors ${value === b ? "text-ink-black" : "text-slate-gray"}`}
          >
            {b === "monthly" ? "Monthly" : "Annual"}
          </button>
        ))}
      </div>
      <Pill tone={tones.accept}>Save ~20% yearly</Pill>
    </div>
  );
}

function Check({ dark }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`mt-[3px] size-4 shrink-0 ${dark ? "text-brand-tint" : "text-brand"}`} fill="none" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlanCard({ plan, billing, delay = 0 }: { plan: Plan; billing: Billing; delay?: number }) {
  const dark = !!plan.featured;
  const perMonth = billing === "annual" ? plan.annual : plan.monthly;
  const isEnterprise = plan.id === "enterprise";

  return (
    <Reveal delay={delay} className="h-full">
      <article
        className={`lift relative flex h-full flex-col rounded-card p-6 sm:p-7 ${
          dark ? "bg-night text-white shadow-overlay" : "bg-white text-ink-black ring-1 ring-line"
        }`}
      >
        {dark ? (
          <span className="absolute -top-3 left-6 rounded-full bg-brand-tint px-3 py-1 font-sohne text-[12px] font-medium text-brand">
            Best for studios
          </span>
        ) : null}
        <p className="font-sohne text-[15px] font-medium">{plan.name}</p>
        <p className={`mt-1 font-sohne text-[14px] leading-[1.45] ${dark ? "text-white/60" : "text-slate-gray"}`}>{plan.tagline}</p>

        <div className="mt-6 flex items-baseline gap-1.5">
          {isEnterprise ? <span className={`font-sohne text-[15px] ${dark ? "text-white/60" : "text-slate-gray"}`}>From</span> : null}
          <span key={`${plan.id}-${billing}`} className="rise font-signifier text-[56px] leading-none tracking-[-0.02em]">
            {formatMoney(perMonth)}
          </span>
          <span className={`font-sohne text-[14px] ${dark ? "text-white/60" : "text-slate-gray"}`}>/ month</span>
        </div>
        <p className={`mt-2 min-h-[20px] font-sohne text-[13px] ${dark ? "text-white/50" : "text-ash-gray"}`}>
          {billing === "annual"
            ? `${formatMoney(perMonth * 12)} billed yearly`
            : `or ${formatMoney(plan.annual)}/month billed yearly`}
        </p>

        <div className={`mt-6 rounded-[16px] px-4 py-3 ${dark ? "bg-white/8" : "bg-fog-white ring-1 ring-line"}`}>
          <p className="font-sohne text-[16px] font-medium">{plan.people}</p>
          {plan.limits.map((l) => (
            <p key={l} className={`mt-1 font-sohne text-[13px] ${dark ? "text-white/60" : "text-slate-gray"}`}>
              {l}
            </p>
          ))}
        </div>

        <ul className="mt-6 flex flex-1 flex-col gap-2.5">
          {plan.highlights.map((h) => (
            <li key={h} className={`flex gap-2.5 font-sohne text-[14px] leading-[1.45] ${dark ? "text-white/85" : "text-ink-black"}`}>
              <Check dark={dark} />
              {h}
            </li>
          ))}
        </ul>

        <a
          href={plan.cta.href}
          className={`mt-8 inline-flex h-11 items-center justify-center rounded-full font-sohne text-[15px] font-[430] transition-[background-color,transform] duration-200 active:scale-[0.98] ${
            dark ? "bg-white text-night hover:bg-brand-tint" : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          {plan.cta.label}
        </a>
      </article>
    </Reveal>
  );
}

export function PlanGrid({ billing }: { billing: Billing }) {
  return (
    <div className="grid items-stretch gap-5 pt-3 md:grid-cols-3">
      {plans.map((plan, i) => (
        <PlanCard key={plan.id} plan={plan} billing={billing} delay={i * 100} />
      ))}
    </div>
  );
}

export function PricingFootnote() {
  return (
    <p className="mt-6 max-w-[720px] font-sohne text-[13px] leading-[1.55] text-ash-gray">
      Early-access pricing in USD, before tax, and subject to change before general release. Items marked “planned” are on the roadmap and
      not yet available. {PERSON_DEFINITION}
    </p>
  );
}

/* ---------- Compact version for the landing page ---------- */

export function PricingSummary() {
  const [billing, setBilling] = useState<Billing>("annual");
  return (
    <div>
      <Reveal>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Kicker>Pricing</Kicker>
            <h2 className="mt-3 max-w-[14ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
              Priced by your team, not your clients.
            </h2>
            <p className="mt-4 max-w-[480px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
              Every plan includes the full assistant, the dashboard and client approvals. Clients in the chat are always free.
            </p>
          </div>
          <BillingToggle value={billing} onChange={setBilling} />
        </div>
      </Reveal>
      <div className="mt-12">
        <PlanGrid billing={billing} />
      </div>
      <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sohne text-[13px] text-ash-gray">Early-access pricing in USD. Items marked “planned” aren’t available yet.</p>
        <ArrowLink href="/pricing">Compare plans in detail</ArrowLink>
      </div>
    </div>
  );
}

/* ---------- Comparison table ---------- */

type Cell = boolean | string | "planned";

const compareGroups: { group: string; rows: { label: string; values: [Cell, Cell, Cell] }[] }[] = [
  {
    group: "Plan limits",
    rows: [
      { label: "People on your team", values: ["Up to 3", "Up to 7", "8+, you choose"] },
      { label: "Active projects", values: ["3", "15", "25 to unlimited"] },
      { label: "Client messages handled / month", values: ["500", "3,000", "10,000+"] },
      { label: "Clients in the chat", values: ["Free, unlimited", "Free, unlimited", "Free, unlimited"] },
    ],
  },
  {
    group: "iMessage assistant",
    rows: [
      { label: "Verified client-group connection with disclosure", values: [true, true, true] },
      { label: "Automatic acceptance within your rules", values: [true, true, true] },
      { label: "Clarifying questions and factual status answers", values: [true, true, true] },
      { label: "Neutral acknowledgment plus private escalation", values: [true, true, true] },
    ],
  },
  {
    group: "Scope and revisions",
    rows: [
      { label: "Agreement import (pasted text, text PDFs)", values: [true, true, true] },
      { label: "Versioned automation policies", values: [true, true, true] },
      { label: "Revision ledger: reserved, consumed, available", values: [true, true, true] },
      { label: "Contractual revision rounds", values: [false, "planned", "planned"] },
      { label: "Pause and review-only mode", values: [true, true, true] },
    ],
  },
  {
    group: "Dashboard and proposals",
    rows: [
      { label: "Home, Actionable tasks, Needs attention, scope and history", values: [true, true, true] },
      { label: "Proposals with versioning and withdrawal", values: [true, true, true] },
      { label: "Authenticated client approval page", values: [true, true, true] },
      { label: "Policy simulator (no effects)", values: [false, "planned", "planned"] },
      { label: "History export", values: [false, "planned", "planned"] },
    ],
  },
  {
    group: "Team",
    rows: [
      { label: "Teammate invites, roles and task assignment", values: ["planned", "planned", "planned"] },
      { label: "Private owner escalation in iMessage", values: [false, "planned", "planned"] },
      { label: "Only owners can set prices or approve scope", values: [true, true, true] },
    ],
  },
  {
    group: "Admin and support",
    rows: [
      { label: "Data retention", values: ["1 year", "1 year", "1, 3 or 7 years"] },
      { label: "SSO", values: [false, false, "planned"] },
      { label: "Support", values: ["Email", "Priority email", "Named contact"] },
      { label: "Dedicated onboarding", values: [false, false, true] },
    ],
  },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true)
    return (
      <span className="inline-flex justify-center">
        <Check />
        <span className="sr-only">Included</span>
      </span>
    );
  if (value === false)
    return (
      <span className="text-smoke-gray" aria-label="Not included">
        —
      </span>
    );
  if (value === "planned") return <Planned />;
  return <span>{value}</span>;
}

export function CompareTable() {
  return (
    <div className="relative overflow-x-auto rounded-card ring-1 ring-line">
      <table className="w-full min-w-[720px] border-collapse bg-white text-left">
        <caption className="sr-only">Plan comparison</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-[40%] px-5 py-5 font-sohne text-[13px] font-normal text-ash-gray">
              Features
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className={`px-4 py-5 text-center font-sohne text-[16px] font-medium ${p.featured ? "bg-fog-white" : ""}`}>
                {p.name}
                <span className="mt-1 block font-sohne text-[13px] font-normal text-slate-gray">
                  {p.id === "enterprise" ? "from " : ""}
                  {formatMoney(p.annual)}/mo yearly
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {compareGroups.map((g) => (
          <tbody key={g.group}>
            <tr>
              <th colSpan={4} scope="colgroup" className="bg-fog-white px-5 pt-6 pb-2 font-sohne text-[12px] font-medium tracking-[0.06em] text-ash-gray uppercase">
                {g.group}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.label} className="border-t border-line transition-colors hover:bg-fog-white/60">
                <th scope="row" className="px-5 py-3.5 font-sohne text-[14px] font-normal text-ink-black">
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className={`px-4 py-3.5 text-center font-sohne text-[14px] text-ink-black ${plans[i]?.featured ? "bg-fog-white/70" : ""}`}>
                    <CellValue value={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* ---------- Enterprise configurator ---------- */

const ENTERPRISE_BASE_SEATS = 8;
const projectOptions = [
  { label: "25 projects", price: 0 },
  { label: "50 projects", price: 60 },
  { label: "100 projects", price: 150 },
  { label: "Unlimited projects", price: 300 },
];
const volumeOptions = [
  { label: "10,000 messages / month", price: 0 },
  { label: "25,000 messages / month", price: 90 },
  { label: "50,000 messages / month", price: 220 },
  { label: "100,000 messages / month", price: 450 },
];
const retentionOptions = [
  { label: "1 year", price: 0 },
  { label: "3 years", price: 80 },
  { label: "7 years", price: 160 },
];
const addOns: { id: string; label: string; detail: string; monthly?: number; oneTime?: number; planned?: boolean }[] = [
  { id: "support", label: "Named support contact", detail: "One person who knows your setup, with faster replies.", monthly: 150 },
  { id: "onboarding", label: "Dedicated onboarding", detail: "We help import agreements and set rules for your first projects.", oneTime: 1500 },
  { id: "sso", label: "Single sign-on (SSO)", detail: "Sign in with your company identity provider.", monthly: 120, planned: true },
  { id: "audit", label: "Audit history export", detail: "Export request, decision and revision history.", monthly: 60, planned: true },
];

function seatPrice(seats: number) {
  const extra = Math.max(0, seats - ENTERPRISE_BASE_SEATS);
  const tier1 = Math.min(extra, 42); // seats 9–50
  const tier2 = Math.max(0, extra - 42); // seats 51+
  return tier1 * 18 + tier2 * 14;
}

function OptionGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { label: string; price: number }[];
  value: number;
  onChange: (i: number) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="font-sohne text-[15px] font-medium text-ink-black">{legend}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <label
            key={o.label}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-[14px] px-4 py-3 font-sohne text-[14px] ring-1 transition-[background-color,box-shadow] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-black ${
              value === i ? "bg-brand text-white ring-brand" : "bg-white text-ink-black ring-line hover:bg-fog-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <input type="radio" name={name} className="sr-only" checked={value === i} onChange={() => onChange(i)} />
              {o.label}
            </span>
            <span className={value === i ? "text-white/60" : "text-ash-gray"}>{o.price ? `+${formatMoney(o.price)}` : "Included"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function EnterpriseBuilder() {
  const [billing, setBilling] = useState<Billing>("annual");
  const [seats, setSeats] = useState(15);
  const [projects, setProjects] = useState(1);
  const [volume, setVolume] = useState(0);
  const [retention, setRetention] = useState(0);
  const [extras, setExtras] = useState<Record<string, boolean>>({ support: true });
  const seatsId = useId();

  const safeSeats = Math.min(500, Math.max(ENTERPRISE_BASE_SEATS, Math.round(seats) || ENTERPRISE_BASE_SEATS));
  const monthlyList =
    plans[2]!.monthly +
    seatPrice(safeSeats) +
    projectOptions[projects]!.price +
    volumeOptions[volume]!.price +
    retentionOptions[retention]!.price +
    addOns.reduce((sum, a) => sum + (extras[a.id] && a.monthly ? a.monthly : 0), 0);
  const perMonth = billing === "annual" ? Math.round(monthlyList * (1 - ANNUAL_DISCOUNT)) : monthlyList;
  const oneTime = addOns.reduce((sum, a) => sum + (extras[a.id] && a.oneTime ? a.oneTime : 0), 0);
  const fillPct = ((Math.min(safeSeats, 150) - ENTERPRISE_BASE_SEATS) / (150 - ENTERPRISE_BASE_SEATS)) * 100;

  const summary = [
    `${safeSeats} people`,
    projectOptions[projects]!.label,
    volumeOptions[volume]!.label,
    `${retentionOptions[retention]!.label} retention`,
    ...addOns.filter((a) => extras[a.id]).map((a) => a.label),
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
      <div className="flex flex-col gap-9 rounded-card bg-fog-white p-5 ring-1 ring-line sm:p-8">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <label htmlFor={seatsId} className="font-sohne text-[15px] font-medium text-ink-black">
              People on your team
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={ENTERPRISE_BASE_SEATS}
                max={500}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                onBlur={() => setSeats(safeSeats)}
                aria-label="Number of people"
                className="h-10 w-20 rounded-[10px] bg-white px-3 text-right font-sohne text-[16px] text-ink-black ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-ink-black"
              />
              <span className="font-sohne text-[14px] text-slate-gray">people</span>
            </div>
          </div>
          <input
            id={seatsId}
            type="range"
            min={ENTERPRISE_BASE_SEATS}
            max={150}
            value={Math.min(safeSeats, 150)}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="seat-range mt-4 w-full"
            style={{ "--fill": `${fillPct}%` } as CSSProperties}
          />
          <div className="mt-2 flex justify-between font-sohne text-[12px] text-ash-gray">
            <span>8</span>
            <span>150 (type more above)</span>
          </div>
          <p className="mt-3 font-sohne text-[13px] leading-[1.5] text-slate-gray">
            8 people included. Then {formatMoney(18)} per person up to 50, and {formatMoney(14)} per person after that. Clients never count.
          </p>
        </div>

        <OptionGroup legend="Active projects" options={projectOptions} value={projects} onChange={setProjects} />
        <OptionGroup legend="Client messages handled" options={volumeOptions} value={volume} onChange={setVolume} />
        <OptionGroup legend="Data retention" options={retentionOptions} value={retention} onChange={setRetention} />

        <fieldset>
          <legend className="font-sohne text-[15px] font-medium text-ink-black">Add-ons</legend>
          <div className="mt-3 flex flex-col gap-2">
            {addOns.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-start gap-3 rounded-[14px] bg-white px-4 py-3.5 ring-1 ring-line transition-colors hover:bg-fog-white"
              >
                <input
                  type="checkbox"
                  checked={!!extras[a.id]}
                  onChange={(e) => setExtras((x) => ({ ...x, [a.id]: e.target.checked }))}
                  className="mt-1 size-4 shrink-0 accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-sohne text-[14px] font-medium text-ink-black">
                    {a.label}
                    {a.planned ? <Planned /> : null}
                  </span>
                  <span className="mt-0.5 block font-sohne text-[13px] leading-[1.45] text-slate-gray">{a.detail}</span>
                </span>
                <span className="shrink-0 font-sohne text-[13px] text-ash-gray">
                  {a.monthly ? `+${formatMoney(a.monthly)}/mo` : `${formatMoney(a.oneTime ?? 0)} once`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card bg-night p-6 text-white shadow-overlay sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="font-sohne text-[15px] font-medium">Your Enterprise estimate</p>
            <div className="[&_*]:text-[12px]">
              <div className="inline-grid grid-cols-2 rounded-full bg-white/10 p-0.5" role="group" aria-label="Billing period">
                {(["monthly", "annual"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={billing === b}
                    onClick={() => setBilling(b)}
                    className={`h-7 rounded-full px-3 font-sohne transition-colors ${billing === b ? "bg-white text-ink-black" : "text-white/70"}`}
                  >
                    {b === "monthly" ? "Monthly" : "Annual"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p className="mt-6 flex items-baseline gap-1.5">
              <span key={perMonth} className="rise font-signifier text-[64px] leading-none tracking-[-0.02em]">
                {formatMoney(perMonth)}
              </span>
              <span className="font-sohne text-[14px] text-white/60">/ month</span>
            </p>
            <p className="mt-2 font-sohne text-[13px] text-white/55">
              {billing === "annual"
                ? `${formatMoney(perMonth * 12)} billed yearly (20% off ${formatMoney(monthlyList)}/mo)`
                : `${formatMoney(Math.round(monthlyList * (1 - ANNUAL_DISCOUNT)))}/mo if billed yearly`}
            </p>
            {oneTime ? <p className="mt-1 font-sohne text-[13px] text-white/55">Plus {formatMoney(oneTime)} one-time onboarding</p> : null}
          </div>
          <ul className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5">
            {summary.map((s) => (
              <li key={s} className="flex gap-2.5 font-sohne text-[14px] text-white/85">
                <Check dark />
                {s}
              </li>
            ))}
          </ul>
          <QuoteForm summary={summary} />
          <p className="mt-4 font-sohne text-[12px] leading-[1.5] text-white/45">
            This is an estimate, not an offer. Final pricing is confirmed in your quote. Planned add-ons are billed only once they’re available.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuoteForm({ summary }: { summary: string[] }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "done">("idle");
  const id = useId();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setState("invalid");
      return;
    }
    // TODO: send `email` and `summary` to the sales/quote backend. Nothing is stored or sent yet.
    void summary;
    setState("done");
  }

  if (state === "done") {
    return (
      <p className="rise mt-6 rounded-[14px] bg-white/10 px-4 py-3 font-sohne text-[14px] text-white" role="status">
        Thanks. We’ll follow up at <span className="font-medium">{email.trim()}</span> with a quote for this setup.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-2">
      <label htmlFor={id} className="font-sohne text-[13px] text-white/70">
        Work email
      </label>
      <input
        id={id}
        type="email"
        autoComplete="email"
        placeholder="you@agency.com"
        value={email}
        aria-invalid={state === "invalid"}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "invalid") setState("idle");
        }}
        className="h-11 rounded-full bg-white px-5 font-sohne text-[15px] text-ink-black outline-none placeholder:text-smoke-gray focus-visible:ring-2 focus-visible:ring-brand-tint"
      />
      {state === "invalid" ? <p className="font-sohne text-[13px] text-[#ffb4a8]">Enter a valid email address.</p> : null}
      <button type="submit" className="h-11 rounded-full bg-brand-tint font-sohne text-[15px] font-[430] text-brand transition-colors hover:bg-white">
        Request a quote
      </button>
    </form>
  );
}

/* ---------- Pricing FAQ ---------- */

export const pricingFaqs: { q: string; a: ReactNode }[] = [
  { q: "Who counts as a person?", a: PERSON_DEFINITION },
  {
    q: "What’s a “client message handled”?",
    a: "Any message from a client in a connected group that Bridgify reads and processes: edits, questions, follow-ups and casual chat. Bridgify’s own replies and your messages don’t count.",
  },
  {
    q: "What happens if I hit my monthly message limit?",
    a: "Bridgify never quietly drops a client request. Affected projects switch to review-only: messages are still logged and shown to you, but nothing is accepted automatically until the next month or until you upgrade.",
  },
  {
    q: "What’s an active project?",
    a: "A project that is connected to a client group and not completed or archived. Completed and archived projects stay readable and don’t count.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can move up or down at any time. If you move to a plan with fewer people or projects, you choose what to archive first. Nothing is deleted.",
  },
  {
    q: "Does Bridgify take a cut of what my clients pay?",
    a: "No. Bridgify doesn’t collect payments. Proposal prices go straight between you and your client, and approved value is shown for your records only.",
  },
  {
    q: "Why are some features marked “planned”?",
    a: "They’re on the roadmap but not available yet. We’d rather show them honestly than imply they work today. Planned add-ons aren’t billed until they ship.",
  },
];

export function PricingFaq() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {pricingFaqs.map((f) => (
        <details key={f.q} className="faq group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-sohne text-[18px] leading-[1.4] font-medium text-ink-black">
            {f.q}
            <span className="text-[22px] font-normal text-ash-gray transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="mt-3 max-w-[60ch] font-sohne text-[16px] leading-[1.6] text-slate-gray">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
