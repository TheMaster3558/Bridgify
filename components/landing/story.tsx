import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bubble } from "./artifacts";
import { useScrollProgress } from "./motion";
import { Pill, tones } from "./ui";

/* ---------- Mission: words light up as you scroll ---------- */

export function MissionText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useScrollProgress(ref, { start: 0.85, end: 0.6 });
  const words = text.split(" ");
  return (
    <p
      ref={ref}
      className="mission-text font-signifier text-[36px] leading-[1.15] tracking-[-0.015em] text-ink-black sm:text-[52px] lg:text-[64px]"
      style={{ "--n": words.length } as CSSProperties}
    >
      {words.map((word, i) => (
        <span key={i} className="mission-word" style={{ "--i": i } as CSSProperties}>
          {word}{" "}
        </span>
      ))}
    </p>
  );
}

/* ---------- Marquee of real-life client texts ---------- */

const chatter = [
  "quick tweak?",
  "can the logo be bigger",
  "is it live yet??",
  "also could we add a blog",
  "can you change the hours to 7–3",
  "make it pop a bit more",
  "thanks so much!! 🙏",
  "which day is launch again",
  "swap the order of the menu sections?",
  "one more small thing…",
  "can we do a booking page too",
  "the phone number in the footer is wrong",
];

export function Marquee() {
  const rowA = chatter.slice(0, 6);
  const rowB = chatter.slice(6);
  return (
    <div className="marquee-mask relative flex flex-col gap-3 overflow-hidden py-2" aria-hidden="true">
      {[rowA, rowB].map((row, r) => (
        <div key={r} className={`marquee-track flex w-max gap-3 ${r === 1 ? "marquee-reverse" : ""}`}>
          {[...row, ...row].map((msg, i) => (
            <span
              key={i}
              className={`${i >= row.length ? "marquee-dup " : ""}shrink-0 rounded-[18px] rounded-bl-[6px] bg-[#e9e9eb] px-4 py-2 font-sohne text-[15px] whitespace-nowrap text-ink-black`}
            >
              {msg}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- The whole loop, drawn as you scroll ---------- */

const loop: { kicker: string; title: string; body: string; visual: ReactNode }[] = [
  {
    kicker: "01 · Client texts",
    title: "A request lands in the group",
    body: "Sam messages the project’s iMessage group, the same way they always have. Nothing new to learn.",
    visual: <Bubble from="client" name="Sam">Can you change the opening hours on the Contact page to 7am–3pm?</Bubble>,
  },
  {
    kicker: "02 · Understood",
    title: "Bridgify reads what’s actually being asked",
    body: "Edit, question, correction, new idea or just chatter. Mixed messages are split into separate requests.",
    visual: (
      <div className="flex flex-wrap gap-1.5">
        <Pill tone={tones.neutral}>Type: edit</Pill>
        <Pill tone={tones.neutral}>Page: Contact</Pill>
        <Pill tone={tones.neutral}>Element: opening hours</Pill>
        <Pill tone={tones.neutral}>Details: complete</Pill>
      </div>
    ),
  },
  {
    kicker: "03 · Checked",
    title: "Checked against what you agreed",
    body: "Confirmed scope, your automation rules and the revisions left. All three have to pass, or nothing gets promised.",
    visual: (
      <ul className="flex flex-col gap-2 font-sohne text-[14px] text-ink-black">
        {[
          ["In confirmed scope", "Agreement §2.3 · Contact page"],
          ["Allowed by your rules", "Automation policy v3"],
          ["Revision available", "3 of 5 left"],
        ].map(([a, b]) => (
          <li key={a} className="flex items-center gap-2.5">
            <span className="grid size-5 place-items-center rounded-full bg-[#e3f1e7] text-[11px] text-[#245c3a]">✓</span>
            <span className="font-medium">{a}</span>
            <span className="text-ash-gray">· {b}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    kicker: "04 · Decided",
    title: "One of three paths, every time",
    body: "Routine work is accepted on the spot. Missing details get a question. Everything else waits for you.",
    visual: (
      <div className="grid gap-2 sm:grid-cols-3">
        <PathCard tone={tones.accept} label="Fits" text="Revision reserved, one task created, client told it’s queued" />
        <PathCard tone={tones.clarify} label="Unclear" text="Asks which page or what wording, then checks again" />
        <PathCard tone={tones.owner} label="Exception" text="You decide: proposal, extra revision, or decline" />
      </div>
    ),
  },
  {
    kicker: "05 · Approved",
    title: "Extra work gets an explicit yes",
    body: "Out-of-scope ideas become a proposal you price. The designated client approves the exact version, and scope and tasks update together.",
    visual: (
      <div className="flex flex-wrap items-center gap-2 font-sohne text-[13px] text-ink-black">
        {["Draft", "You set price", "Sent v2", "Client approves", "Tasks created"].map((s, i, all) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 ${i === all.length - 1 ? "bg-brand text-white" : "bg-mist-gray"}`}>{s}</span>
            {i < all.length - 1 ? <span className="text-ash-gray">→</span> : null}
          </span>
        ))}
      </div>
    ),
  },
  {
    kicker: "06 · Built",
    title: "You do the work",
    body: "The task sits in your list with its source message and the rule that allowed it. The revision is consumed once, when work starts.",
    visual: (
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-white px-3.5 py-3 ring-1 ring-line">
        <div className="min-w-0">
          <p className="truncate font-sohne text-[14px] font-medium text-ink-black">Update Contact page hours</p>
          <p className="mt-0.5 font-sohne text-[12px] text-ash-gray">From Sam · Agreement §2.3 · Policy v3</p>
        </div>
        <Pill tone={tones.clarify}>In progress</Pill>
      </div>
    ),
  },
  {
    kicker: "07 · Done",
    title: "Done means you said so",
    body: "Mark it complete, preview a factual note, and choose whether to send it. Bridgify never tells a client something is finished before you do.",
    visual: <Bubble from="bot" name="Bridgify">Update from Maya: the Contact page now shows opening hours of 7am–3pm.</Bubble>,
  },
  {
    kicker: "08 · Closed",
    title: "Projects end cleanly",
    body: "Close a project and Bridgify stops accepting new work. Every message, task, proposal and revision stays readable.",
    visual: (
      <div className="flex flex-wrap gap-1.5">
        <Pill tone={tones.neutral}>Status: completed</Pill>
        <Pill tone={tones.neutral}>New requests: off</Pill>
        <Pill tone={tones.neutral}>History: kept</Pill>
      </div>
    ),
  },
];

function PathCard({ tone, label, text }: { tone: string; label: string; text: string }) {
  return (
    <div className="rounded-[14px] bg-white p-3 ring-1 ring-line">
      <Pill tone={tone}>{label}</Pill>
      <p className="mt-2 font-sohne text-[13px] leading-[1.4] text-slate-gray">{text}</p>
    </div>
  );
}

export function LoopFlow() {
  const ref = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(-1);
  useScrollProgress(ref, { start: 0.7, end: 0.7 }, (p) => {
    const next = p <= 0 ? -1 : Math.min(loop.length - 1, Math.floor(p * loop.length + 0.35));
    setActive((current) => (current === next ? current : next));
  });

  return (
    <ol ref={ref} className="loop relative">
      <span className="absolute top-2 bottom-2 left-[11px] w-[2px] rounded-full bg-line sm:left-[15px]" aria-hidden="true" />
      <span className="loop-fill absolute top-2 bottom-2 left-[11px] w-[2px] origin-top rounded-full bg-gradient-to-b from-brand-light to-brand sm:left-[15px]" aria-hidden="true" />
      {loop.map((step, i) => {
        const on = i <= active;
        return (
          <li key={step.kicker} className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-5 pb-14 last:pb-0 sm:grid-cols-[32px_minmax(0,1fr)] sm:gap-8">
            <span
              className={`relative z-10 mt-1 grid size-6 place-items-center rounded-full border-2 transition-all duration-500 sm:size-8 ${
                on ? "scale-100 border-brand bg-brand" : "scale-90 border-line bg-white"
              }`}
              aria-hidden="true"
            >
              <span className={`size-1.5 rounded-full transition-colors duration-500 sm:size-2 ${on ? "bg-brand-tint" : "bg-line"}`} />
            </span>
            <div className={`loop-step grid min-w-0 grid-cols-1 gap-5 transition-[opacity,transform] duration-700 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10 ${on ? "is-on" : ""}`}>
              <div>
                <p className="font-sohne text-[13px] text-ash-gray">{step.kicker}</p>
                <h3 className="mt-2 font-sohne text-[22px] leading-[1.25] font-medium text-ink-black sm:text-[26px]">{step.title}</h3>
                <p className="mt-2 max-w-[46ch] font-sohne text-[16px] leading-[1.55] text-slate-gray">{step.body}</p>
              </div>
              <div className="rounded-[20px] bg-fog-white p-4 ring-1 ring-line [--chat-bg:#fafafb] sm:p-5">{step.visual}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
