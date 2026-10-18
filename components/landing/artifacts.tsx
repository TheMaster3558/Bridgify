import { useEffect, useRef, useState, type ReactNode } from "react";
import { CountUp, Drift, prefersReducedMotion, useInView, usePageVisible } from "./motion";
import { Pill, tones } from "./ui";

/* ---------- iMessage pieces ---------- */

type Sender = "client" | "bot" | "owner";

export function Bubble({
  from,
  name,
  children,
  className = "",
}: {
  from: Sender;
  name?: string;
  children: ReactNode;
  className?: string;
}) {
  // Bridgify (and you) send from the right in iMessage blue; clients arrive on the left in gray.
  const sent = from !== "client";
  return (
    <div className={`flex flex-col gap-1 ${sent ? "mr-3 items-end" : "ml-3 items-start"} ${className}`}>
      {name ? <span className="px-3 font-sohne text-[11px] leading-none text-[#8e8e93]">{name}</span> : null}
      <p
        className={`imsg max-w-[80%] rounded-[18px] px-3.5 py-2 font-sohne text-[15px] leading-[1.35] ${
          sent ? "imsg-blue imsg-right text-white" : "imsg-gray imsg-left text-ink-black"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

function Typing() {
  return (
    <div className="mr-3 flex flex-col items-end gap-1">
      <span className="px-3 font-sohne text-[11px] leading-none text-[#8e8e93]">Bridgify</span>
      <div className="imsg imsg-gray imsg-right flex gap-1 rounded-[18px] px-4 py-3" aria-label="Bridgify is typing">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot size-2 rounded-full bg-[#8e8e93]" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </div>
    </div>
  );
}

function ChatHeader() {
  return (
    <div className="flex flex-col items-center gap-1 border-b border-black/5 pt-4 pb-3">
      <div className="flex -space-x-2" aria-hidden="true">
        <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-[#dcecd8] font-sohne text-[11px] font-medium">SR</span>
        <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-[#d5e4f6] font-sohne text-[11px] font-medium">MK</span>
        <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-brand-tint font-sohne text-[11px] font-medium text-brand">B</span>
      </div>
      <p className="font-sohne text-[12px] leading-none font-medium text-ink-black">Hearth Bakery · Website</p>
      <p className="font-sohne text-[11px] leading-none text-[#8e8e93]">Sam, Maya, Bridgify</p>
    </div>
  );
}

/* Hero conversation steps: 1 client, 2 typing, 3 bot (+task card), 4 client, 5 typing, 6 bot (+decision card). */
const heroTimings = [700, 1300, 1400, 2200, 1500, 1400, 4200];

export function HeroChat() {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, 0.2);
  const visible = usePageVisible();
  const [step, setStep] = useState(6);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // Server render shows the finished chat; the animation starts only once hydrated.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(0);
    setStarted(true);
  }, []);

  useEffect(() => {
    if (!started || !inView || !visible) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % heroTimings.length), heroTimings[step]);
    return () => window.clearTimeout(timer);
  }, [step, started, inView, visible]);

  const show = (n: number) => (step >= n ? "chat-in" : "chat-out");

  return (
    <div ref={root} className="relative mx-auto w-full max-w-[420px]">
      <p className="sr-only">
        Example conversation: the client asks to change the homepage headline, and Bridgify confirms it’s covered by the agreement and adds
        a task. The client then asks for a booking page, and Bridgify says it’s outside the agreement and passes it to the owner.
      </p>
      <Drift amp="-8px" shift="10px" duration="9s">
        <div className="overflow-hidden rounded-[28px] bg-white shadow-overlay" aria-hidden="true">
          <ChatHeader />
          <div className="flex flex-col gap-3 px-3 pt-4 pb-5">
            <Bubble from="client" name="Sam" className={show(1)}>
              Can we change the homepage headline to “Fresh bread, baked daily”?
            </Bubble>
            <div className="relative">
              {step === 2 ? <div className="absolute inset-x-0 top-0"><Typing /></div> : null}
              <Bubble from="bot" name="Bridgify" className={show(3)}>
                Got it. That’s covered by your agreement, so it’s on Maya’s list now. This uses 1 of 5 included revisions.
              </Bubble>
            </div>
            <Bubble from="client" name="Sam" className={show(4)}>
              Amazing. Could we also add an online booking page?
            </Bubble>
            <div className="relative">
              {step === 5 ? <div className="absolute inset-x-0 top-0"><Typing /></div> : null}
              <Bubble from="bot" name="Bridgify" className={show(6)}>
                A booking page isn’t in the current agreement, so I’ve passed it to Maya. She’ll follow up with you.
              </Bubble>
            </div>
          </div>
        </div>
      </Drift>

      <div className={`absolute -top-14 -right-28 hidden w-[230px] lg:block ${show(3)}`} aria-hidden="true">
        <Drift amp="-12px" shift="22px" duration="7s" delay="0.4s">
          <div className="rounded-elevated bg-white p-4 shadow-float">
            <Pill tone={tones.accept}>Task created</Pill>
            <p className="mt-3 font-sohne text-[14px] leading-[1.35] font-medium text-ink-black">Update homepage headline</p>
            <p className="mt-1 font-sohne text-[12px] leading-[1.4] text-slate-gray">From Sam · 4:12 PM · Revision 3 of 5</p>
          </div>
        </Drift>
      </div>

      <div className={`absolute -bottom-24 -left-24 hidden w-[250px] lg:block ${show(6)}`} aria-hidden="true">
        <Drift amp="-10px" shift="-18px" duration="8s" delay="1s">
          <div className="rounded-elevated bg-white p-4 shadow-float">
            <Pill tone={tones.owner}>Needs your decision</Pill>
            <p className="mt-3 font-sohne text-[14px] leading-[1.35] font-medium text-ink-black">Online booking page</p>
            <p className="mt-1 font-sohne text-[12px] leading-[1.4] text-slate-gray">Outside agreed scope · only you can see this</p>
          </div>
        </Drift>
      </div>
    </div>
  );
}

/* ---------- Interactive simulator ---------- */

type Outcome = "accept" | "clarify" | "owner" | "status" | "quiet";

const outcomeLabel: Record<Outcome, string> = {
  accept: "Accepted · task created",
  clarify: "Asked for details",
  owner: "Sent to you privately",
  status: "Answered from records",
  quiet: "No reply needed",
};

const outcomeTone: Record<Outcome, string> = {
  accept: tones.accept,
  clarify: tones.clarify,
  owner: tones.owner,
  status: tones.neutral,
  quiet: tones.neutral,
};

const scenarios: {
  label: string;
  message: string;
  outcome: Outcome;
  reply?: string;
  effects: { title: string; detail: string }[];
}[] = [
  {
    label: "Routine edit",
    message: "Can we change the homepage headline to “Fresh bread, baked daily”?",
    outcome: "accept",
    reply: "Got it. Updating the homepage headline is covered by your agreement, so I’ve added it to Maya’s list. This uses 1 of your 5 included revisions (2 left after this one).",
    effects: [
      { title: "One task created", detail: "“Update homepage headline”, linked to Sam’s message" },
      { title: "Revision reserved", detail: "3 of 5 in use · reserved now, consumed when work starts" },
      { title: "Authorized by", detail: "Agreement §2.1 (Homepage copy) · Automation policy v3" },
      { title: "Your reply needed", detail: "None. Routine work skips your inbox." },
    ],
  },
  {
    label: "Missing details",
    message: "Can you swap the button color?",
    outcome: "clarify",
    reply: "Happy to. Which button: “Order now” on the homepage, or the one on the Menu page? And which color would you like?",
    effects: [
      { title: "Request held open", detail: "Waiting on target and color" },
      { title: "No revision used yet", detail: "Allowance is reserved only once the request is complete" },
      { title: "Clarification 1 of 2", detail: "If it’s still unclear after that, it comes to you" },
    ],
  },
  {
    label: "New scope",
    message: "Could we also add an online booking page?",
    outcome: "owner",
    reply: "Thanks! A booking page isn’t part of the current agreement, so I’ve passed it to Maya. She’ll follow up with you.",
    effects: [
      { title: "Added to Needs Your Decision", detail: "Reason: new page outside confirmed scope" },
      { title: "Evidence attached", detail: "Agreement §2 lists 4 pages · no booking page" },
      { title: "Your options", detail: "Draft a proposal · Decline · Include at no charge" },
      { title: "Kept private", detail: "No price, date, or recommendation sent to the group" },
    ],
  },
  {
    label: "Out of revisions",
    message: "One more tweak, can the footer text be bigger?",
    outcome: "owner",
    reply: "Noted. The included revisions on this project are all used, so I’ve passed this to Maya to decide next steps.",
    effects: [
      { title: "Added to Needs Your Decision", detail: "Reason: revision allowance exhausted (5 of 5)" },
      { title: "Your options", detail: "Grant an extra revision · Send a proposal · Decline" },
      { title: "No task yet", detail: "Nothing is promised until you decide" },
    ],
  },
  {
    label: "Status check",
    message: "Is the new menu page live yet?",
    outcome: "status",
    reply: "The menu page update is accepted and on Maya’s list, but it isn’t marked done yet. The agreed launch date is Nov 14.",
    effects: [
      { title: "Answered from task records", detail: "Status: accepted, not started" },
      { title: "No guesses", detail: "Bridgify never claims work is done until you mark it done" },
    ],
  },
  {
    label: "Just saying thanks",
    message: "Thanks so much!! 🙏",
    outcome: "quiet",
    effects: [
      { title: "Logged in history", detail: "No action, no task" },
      { title: "Stayed quiet", detail: "Not every message needs a reply" },
    ],
  },
];

const autoplayMs = 6500;

export function Simulator() {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, 0.35);
  const visible = usePageVisible();
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState(3);
  const [userPicked, setUserPicked] = useState(false);
  const [animate, setAnimate] = useState(false);
  const autoplay = !userPicked && inView && visible && !prefersReducedMotion();

  // Step through the examples while visible, until the visitor picks one.
  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => {
      setAnimate(true);
      setStage(prefersReducedMotion() ? 3 : 1);
      setActive((a) => (a + 1) % scenarios.length);
    }, autoplayMs);
    return () => window.clearTimeout(timer);
  }, [autoplay, active]);

  useEffect(() => {
    if (!animate || prefersReducedMotion()) return;
    const quiet = scenarios[active]?.outcome === "quiet";
    const t1 = window.setTimeout(() => setStage(quiet ? 3 : 2), 450);
    const t2 = window.setTimeout(() => setStage(3), quiet ? 700 : 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active, animate]);

  const scenario = scenarios[active]!;

  return (
    <div ref={root}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a client message">
        {scenarios.map((s, index) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={index === active}
            onClick={() => {
              setAnimate(true);
      setStage(prefersReducedMotion() ? 3 : 1);
              setUserPicked(true);
              setActive(index);
            }}
            className={`relative h-9 overflow-hidden rounded-full px-4 font-sohne text-[14px] leading-none font-[430] transition-[background-color,color,transform] duration-200 active:scale-95 ${
              index === active ? "bg-ink-black text-white" : "bg-white text-ink-black shadow-subtle hover:-translate-y-0.5 hover:bg-mist-gray"
            }`}
          >
            {index === active && autoplay ? (
              <span
                key={active}
                className="pill-progress absolute inset-y-0 left-0 w-full origin-left bg-white/20"
                style={{ animationDuration: `${autoplayMs}ms` }}
                aria-hidden="true"
              />
            ) : null}
            <span className="relative">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="overflow-hidden rounded-[24px] bg-white shadow-subtle">
          <ChatHeader />
          <div className="flex min-h-[260px] flex-col gap-3 px-3 pt-4 pb-5" aria-live={userPicked ? "polite" : "off"}>
            {stage >= 1 ? (
              <Bubble key={`c-${active}`} from="client" name="Sam" className="rise">
                {scenario.message}
              </Bubble>
            ) : null}
            {stage === 2 ? <Typing /> : null}
            {stage === 3 && scenario.reply ? (
              <Bubble key={`b-${active}`} from="bot" name="Bridgify" className="rise">
                {scenario.reply}
              </Bubble>
            ) : null}
            {stage === 3 && !scenario.reply ? (
              <p className="rise mt-2 text-center font-sohne text-[12px] text-[#8e8e93]">Bridgify read this and didn’t reply.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-subtle sm:p-6">
          <p className="font-sohne text-[13px] leading-none text-ash-gray">What happened on your dashboard</p>
          <div className={`mt-4 transition-opacity duration-300 ${stage === 3 ? "opacity-100" : "opacity-30"}`}>
            <Pill tone={outcomeTone[scenario.outcome]}>{outcomeLabel[scenario.outcome]}</Pill>
            <ul key={active} className="mt-5 flex flex-col gap-4">
              {scenario.effects.map((effect, i) => (
                <li
                  key={effect.title}
                  className={`grid grid-cols-[auto_1fr] gap-3 ${stage === 3 && animate ? "rise" : ""}`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <span className="mt-[7px] size-1.5 rounded-full bg-ink-black/40" aria-hidden="true" />
                  <div>
                    <p className="font-sohne text-[15px] leading-[1.35] font-medium text-ink-black">{effect.title}</p>
                    <p className="mt-0.5 font-sohne text-[14px] leading-[1.45] text-slate-gray">{effect.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard preview ---------- */

const navItems = ["Home", "Projects", "Tasks", "Needs attention", "Proposals", "Settings"];

const tasks = [
  { title: "Update homepage headline", source: "Sam · Today 4:12 PM", state: "Accepted", tone: tones.accept },
  { title: "Replace menu PDF link", source: "Sam · Oct 15", state: "In progress", tone: tones.clarify },
  { title: "Fix footer phone number", source: "Sam · Oct 14", state: "Done", tone: tones.neutral },
];

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-overlay">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-[#ececec]" />
        <span className="size-2.5 rounded-full bg-[#ececec]" />
        <span className="size-2.5 rounded-full bg-[#ececec]" />
        <span className="ml-3 font-sohne text-[12px] text-ash-gray">app.bridgify · Home</span>
      </div>
      <div className="grid md:grid-cols-[180px_1fr]">
        <nav className="hidden flex-col gap-1 border-r border-line p-3 md:flex" aria-hidden="true">
          {navItems.map((item, i) => (
            <span
              key={item}
              className={`flex items-center justify-between rounded-[10px] px-3 py-2 font-sohne text-[13px] ${
                i === 0 ? "bg-mist-gray font-medium text-ink-black" : "text-slate-gray"
              }`}
            >
              {item}
              {item === "Needs attention" ? (
                <span className="rounded-full bg-[#fbefd5] px-1.5 font-sohne text-[11px] text-[#7a4d00]">2</span>
              ) : null}
            </span>
          ))}
        </nav>

        <div className="min-w-0 p-4 sm:p-6">
          <p className="font-sohne text-[18px] leading-none font-medium text-ink-black">Good afternoon, Maya</p>
          <p className="mt-2 font-sohne text-[13px] leading-[1.45] text-slate-gray">
            Today Bridgify handled 9 client messages: 3 accepted, 1 clarified, 4 needed no reply, 1 came to you.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {(
              [
                ["Actionable tasks", 6],
                ["Needs your decision", 2],
                ["Awaiting client approval", 1],
                ["Integration issues", 0],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-[14px] bg-fog-white px-3 py-3 ring-1 ring-line transition-transform duration-300 hover:-translate-y-0.5">
                <p className="font-sohne text-[22px] leading-none font-medium tracking-[-0.03em] text-ink-black">
                  <CountUp value={value} />
                </p>
                <p className="mt-2 font-sohne text-[12px] leading-[1.3] text-slate-gray">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <p className="font-sohne text-[13px] font-medium text-ink-black">Actionable tasks</p>
              <ul className="mt-2 divide-y divide-line rounded-[14px] ring-1 ring-line">
                {tasks.map((task) => (
                  <li key={task.title} className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-fog-white">
                    <div className="min-w-0">
                      <p className="truncate font-sohne text-[13px] font-medium text-ink-black">{task.title}</p>
                      <p className="mt-0.5 truncate font-sohne text-[11px] text-ash-gray">{task.source}</p>
                    </div>
                    <Pill tone={task.tone}>{task.state}</Pill>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[14px] bg-[#fffaf0] p-3 ring-1 ring-[#f3e3bf]">
                <p className="font-sohne text-[11px] text-[#7a4d00]">Needs your decision · New scope</p>
                <p className="mt-1.5 font-sohne text-[13px] leading-[1.35] font-medium text-ink-black">Online booking page</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {["Draft proposal", "Decline", "Include at $0"].map((o) => (
                    <span key={o} className="rounded-full bg-white px-2 py-1 font-sohne text-[11px] text-ink-black ring-1 ring-line">
                      {o}
                    </span>
                  ))}
                </div>
              </div>
              <RevisionMeter total={5} consumed={2} reserved={1} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RevisionMeter({ total, consumed, reserved }: { total: number; consumed: number; reserved: number }) {
  const available = total - consumed - reserved;
  return (
    <div className="rounded-[14px] p-3 ring-1 ring-line">
      <p className="font-sohne text-[11px] text-ash-gray">Revision allowance</p>
      <div className="mt-2 flex gap-1" role="img" aria-label={`${consumed} consumed, ${reserved} reserved, ${available} available of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{ animationDelay: `${300 + i * 120}ms` }}
            className={`seg-fill h-2 flex-1 origin-left rounded-full ${
              i < consumed ? "bg-brand" : i < consumed + reserved ? "bg-[#558cd1]" : "bg-mist-gray"
            }`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-sohne text-[11px] text-slate-gray">
        <span>{consumed} consumed</span>
        <span>{reserved} reserved</span>
        <span>{available} available</span>
      </div>
    </div>
  );
}

/* ---------- Proposal approval preview ---------- */

export function ProposalPreview() {
  return (
    <div className="rounded-[22px] bg-white p-5 shadow-overlay sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-sohne text-[12px] text-ash-gray">Proposal · Revision 2 · for Sam Rivera</p>
        <Pill tone={tones.clarify}>Signed in as approver</Pill>
      </div>
      <h3 className="mt-3 font-signifier text-[34px] leading-[1.1] font-normal text-ink-black">Online booking page</h3>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-line py-4">
        <div>
          <dt className="font-sohne text-[11px] text-ash-gray">Additional price</dt>
          <dd className="mt-1 font-sohne text-[18px] font-medium text-ink-black tabular-nums">$850</dd>
        </div>
        <div>
          <dt className="font-sohne text-[11px] text-ash-gray">Date impact</dt>
          <dd className="mt-1 font-sohne text-[18px] font-medium text-ink-black">+6 days</dd>
        </div>
        <div>
          <dt className="font-sohne text-[11px] text-ash-gray">Expires</dt>
          <dd className="mt-1 font-sohne text-[18px] font-medium text-ink-black">Oct 31</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-sohne text-[12px] font-medium text-ink-black">Included</p>
          <ul className="mt-1.5 flex flex-col gap-1 font-sohne text-[13px] leading-[1.4] text-slate-gray">
            <li>Booking page in site style</li>
            <li>Date and party-size form</li>
            <li>Confirmation email template</li>
          </ul>
        </div>
        <div>
          <p className="font-sohne text-[12px] font-medium text-ink-black">Not included</p>
          <ul className="mt-1.5 flex flex-col gap-1 font-sohne text-[13px] leading-[1.4] text-slate-gray">
            <li>Payment or deposits</li>
            <li>Calendar sync</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
        <span className="inline-flex h-10 items-center rounded-full bg-brand px-4 font-sohne text-[14px] text-white">Approve these terms</span>
        <span className="inline-flex h-10 items-center rounded-full px-4 font-sohne text-[14px] text-ink-black ring-1 ring-line">Request changes</span>
        <span className="inline-flex h-10 items-center rounded-full px-4 font-sohne text-[14px] text-slate-gray">Decline</span>
      </div>
    </div>
  );
}
