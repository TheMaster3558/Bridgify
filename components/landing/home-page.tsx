"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { DashboardPreview, HeroChat, ProposalPreview, Simulator } from "./artifacts";
import { SiteFooter, SiteHeader, SkipLink } from "./layout";
import { Parallax, Reveal, useHeroDrift } from "./motion";
import { PricingSummary } from "./pricing";
import { LoopFlow, Marquee, MissionText } from "./story";
import { ArrowLink, Container, FilledButton, GhostButton, Kicker, Pill, SIGN_IN_HREF, SIGN_UP_HREF, tones } from "./ui";

const steps = [
  {
    title: "Import the agreement",
    body: "Paste it or upload a text PDF. Bridgify pulls out what’s included, what’s excluded, revision terms and dates, each linked to the line it came from. Nothing counts until you confirm it.",
  },
  {
    title: "Connect the client chat",
    body: "Link the exact iMessage group for the project. Bridgify verifies who’s who, sends a test, and tells everyone it’s there. Older messages are never replayed as new work.",
  },
  {
    title: "Set your rules",
    body: "Choose which kinds of changes, on which pages, it may accept by itself, how many revisions are included, and what it may say. Prices and dates always stay with you.",
  },
  {
    title: "Get back to building",
    body: "Bridgify works the chat. Routine edits become tasks. Anything outside your rules shows up in your dashboard with the evidence and your options.",
  },
];

const mission =
  "Freelancers should spend their days building, not policing a group chat. Bridgify handles the routine requests you’ve already agreed to, brings every exception to you, and makes sure new work only starts after a real yes.";

const pillars = [
  {
    title: "Routine, handled",
    body: "If it’s in the agreement and your rules allow it, the client gets an answer and you get a task. No reply needed from you.",
  },
  {
    title: "Exceptions, yours",
    body: "New scope, used-up revisions, disputes and unknown senders come to you privately, with the evidence and your options.",
  },
  {
    title: "Every yes is real",
    body: "Extra work starts only after the right client approves the exact terms. Nothing is promised that you didn’t authorize.",
  },
];

const outcomes = [
  {
    pill: "Accept",
    tone: tones.accept,
    title: "Says yes to what’s already agreed",
    body: "If a request fits your confirmed scope, your rules and the revisions left, Bridgify reserves a revision, creates one task and replies. It never says “accepted” before the task actually exists.",
  },
  {
    pill: "Clarify",
    tone: tones.clarify,
    title: "Asks when details are missing",
    body: "Which page? Which button? What wording? The answer is attached to the right open request. If it can’t tell which request a reply belongs to, it asks or hands it to you.",
  },
  {
    pill: "Escalate",
    tone: tones.owner,
    title: "Brings exceptions to you privately",
    body: "New scope, used-up revisions, conflicting instructions, disputes, unknown senders. The client gets a short, neutral acknowledgment, and you get the decision.",
  },
  {
    pill: "Answer",
    tone: tones.neutral,
    title: "Answers from facts, or stays quiet",
    body: "Status questions are answered from your task records and agreed dates. “Thanks!” gets no reply. It never invents progress, deadlines or finished work.",
  },
];

const guardrails = [
  ["No invented prices or dates", "New prices and schedule commitments always come from you, never from the model."],
  ["“Accepted” is not “done”", "Bridgify only tells a client work is finished after you mark it finished."],
  ["Every task traces back", "Each task links to its source message, the agreement term and the policy version that authorized it."],
  ["Revisions are counted carefully", "Reserved when accepted, consumed when work starts. Retries and simultaneous requests can’t double-charge or take the last revision twice."],
  ["Private stays private", "Your notes, recommendations and draft pricing never appear in the client group."],
  ["Messages can’t rewrite the rules", "Text like “ignore your instructions” can’t change rules, recipients, prices or allowances."],
  ["Pause anytime", "Review-only mode keeps reading the chat but stops automatic acceptance. When you resume, old messages aren’t accepted in a batch."],
  ["Unsure means ask", "When a message can’t be confidently understood, Bridgify asks for clarification or sends it to you. It never treats uncertainty as permission."],
];

const notDoing = [
  "Edit your website. You do the work; Bridgify tracks it.",
  "Collect payments or connect to accounting.",
  "Replace formal e-signatures.",
  "Transcribe voice notes or read scanned images.",
  "Negotiate with your client on your behalf.",
];

const faqs = [
  {
    q: "Do my clients know Bridgify is in the chat?",
    a: "Yes. When you connect a project’s group, Bridgify announces itself to everyone in it. It joins as its own participant and never pretends to be you.",
  },
  {
    q: "What counts as a “routine” request?",
    a: "Only what you set up: specific kinds of changes on confirmed pages and elements, within the scope you approved. A vague “it’s a minor change” is never enough on its own.",
  },
  {
    q: "How are revisions counted?",
    a: "Your dashboard shows total, reserved, consumed and available revisions. A revision is reserved when a request is accepted and consumed when work starts. You can grant extras or waive one, with a reason that stays in the history.",
  },
  {
    q: "Can a client approve extra work by texting “yes”?",
    a: "No. A “yes” in the chat points them to the approval page. There, the designated approver signs in and approves the exact proposal revision. Old or superseded versions can’t be approved.",
  },
  {
    q: "What happens when a proposal is approved?",
    a: "Everything updates at once: the approval is recorded, the scope expands, the line-item tasks are created and the approved value is updated. Approved value is shown separately from your original price, and never as money collected.",
  },
  {
    q: "What if Bridgify gets something wrong?",
    a: "You can pause it, switch to review-only, or correct a request. Every change is kept in an audit trail, and Bridgify helps you tell the client what changed, so nothing is quietly reversed.",
  },
  {
    q: "What agreements can it read?",
    a: "Pasted text and text-based PDFs. Scanned images aren’t supported yet. You review and confirm every extracted term before it can authorize any work.",
  },
];

export function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  useHeroDrift(heroRef);

  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="content" className="overflow-x-clip">
        {/* Hero */}
        <section id="top" ref={heroRef} className="hero relative -mt-16 overflow-hidden pt-16">
          <Parallax speed={0.25} className="absolute inset-0" >
            <div className="orb orb-float top-[8%] right-[6%] size-[380px] bg-[#d3e2f6]/80" aria-hidden="true" />
            <div className="orb orb-float bottom-[0%] left-[-6%] size-[420px] bg-[#e4edf9]/80" style={{ animationDelay: "-6s" }} aria-hidden="true" />
            <div className="orb orb-float top-[40%] left-[40%] size-[260px] bg-[#eef3fb]" style={{ animationDelay: "-11s" }} aria-hidden="true" />
          </Parallax>
          <div className="hero-noise" aria-hidden="true" />
          <Container className="relative z-10 grid items-center gap-16 pt-12 pb-24 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-32">
            <div className="text-center lg:text-left">
              <span className="rise inline-flex items-center gap-2 rounded-full bg-white/60 px-3.5 py-2 font-sohne text-[13px] leading-none font-[430] text-ink-black ring-1 ring-black/5 backdrop-blur sm:text-[14px]">
                <span className="relative flex size-1.5" aria-hidden="true">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#34c759] opacity-60 motion-reduce:hidden" />
                  <span className="relative size-1.5 rounded-full bg-[#34c759]" />
                </span>
                For iMessage client groups
              </span>
              <h1 className="mt-7 font-signifier text-[52px] leading-[1.02] font-normal tracking-[-0.025em] text-ink-black sm:text-[72px] lg:text-[88px]">
                <HeadlineWords text="Your clients text." start={150} />
                <br />
                <span className="text-brand"><HeadlineWords text="Your scope holds." start={550} /></span>
              </h1>
              <p className="rise mx-auto mt-6 max-w-[540px] font-sohne text-[18px] leading-[1.5] text-ink-black sm:text-[20px] lg:mx-0" style={{ animationDelay: "900ms" }}>
                Bridgify sits in your client’s iMessage group. It accepts the edits your agreement already covers, asks for missing details,
                and turns each request into a task. Anything outside scope comes to you, privately.
              </p>
              <div className="rise mt-8 flex flex-wrap items-center justify-center gap-2 lg:justify-start" style={{ animationDelay: "1050ms" }}>
                <FilledButton href={SIGN_UP_HREF}>Try for free</FilledButton>
                <GhostButton href="#try">Try a client message</GhostButton>
              </div>
              <p className="rise mt-5 font-sohne text-[14px] text-slate-gray" style={{ animationDelay: "1200ms" }}>
                Built for freelancers and small studios who build websites.
              </p>
            </div>
            <HeroChat />
          </Container>
        </section>

        {/* Problem */}
        <section className="bg-paper-white pt-20 pb-16">
          <Container>
            <Reveal>
              <p className="mx-auto max-w-[900px] text-center font-signifier text-[32px] leading-[1.25] text-ink-black sm:text-[42px]">
                “Quick tweak?” at 11pm. A new page slipped into a thread. Revision four of three.
                <span className="text-ash-gray"> The work is the easy part. Keeping up with the chat isn’t.</span>
              </p>
            </Reveal>
          </Container>
          <Reveal className="mt-12" from="scale">
            <Marquee />
          </Reveal>
        </section>

        {/* Mission */}
        <section id="mission" className="bg-paper-white py-24 sm:py-32">
          <Container>
            <Kicker>Our mission</Kicker>
            <div className="mt-6 max-w-[1050px]">
              <MissionText text={mission} />
            </div>
            <div className="mt-16 grid gap-5 md:grid-cols-3">
              {pillars.map((pillar, i) => (
                <Reveal key={pillar.title} delay={i * 110} from="up">
                  <article className="lift h-full rounded-card bg-fog-white px-6 pt-6 pb-7 ring-1 ring-line">
                    <span className="font-signifier text-[40px] leading-none text-brand-light">0{i + 1}</span>
                    <h3 className="mt-4 font-sohne text-[20px] leading-[1.3] font-medium text-ink-black">{pillar.title}</h3>
                    <p className="mt-2 font-sohne text-[15px] leading-[1.55] text-slate-gray">{pillar.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* The whole loop */}
        <section id="loop" className="bg-paper-white pb-28">
          <Container>
            <Reveal>
              <Kicker>How it works</Kicker>
              <h2 className="mt-3 max-w-[16ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                From a text to done, with nothing slipping through.
              </h2>
              <p className="mt-5 max-w-[520px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
                Follow one request through Bridgify, from the client’s message to the moment the project closes.
              </p>
            </Reveal>
            <div className="mt-16">
              <LoopFlow />
            </div>
          </Container>
        </section>

        {/* Setup */}
        <section id="how" className="bg-fog-white py-24">
          <Container>
            <Reveal>
              <Kicker>Setup</Kicker>
              <h2 className="mt-3 max-w-[16ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                Set it up once per project.
              </h2>
            </Reveal>
            <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {steps.map((step, i) => (
                <Reveal as="li" key={step.title} delay={i * 110} className="group border-t border-ink-black/15 pt-5">
                  <span className="inline-grid size-8 place-items-center rounded-full bg-white font-sohne text-[13px] text-ink-black ring-1 ring-line transition-colors duration-300 group-hover:bg-brand group-hover:text-white tabular-nums">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 font-sohne text-[20px] leading-[1.3] font-medium text-ink-black">{step.title}</h3>
                  <p className="mt-2 font-sohne text-[15px] leading-[1.55] text-slate-gray">{step.body}</p>
                </Reveal>
              ))}
            </ol>
          </Container>
        </section>

        {/* Simulator */}
        <section id="try" className="bg-paper-white py-24">
          <Container>
            <Reveal>
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
                <div>
                  <Kicker>Try it</Kicker>
                  <h2 className="mt-3 max-w-[14ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                    Send a message as the client.
                  </h2>
                </div>
                <p className="max-w-[460px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
                  Pick a message and watch what Bridgify says in the group, and what it records for you. Example project: a 4-page bakery
                  site with 5 included revisions.
                </p>
              </div>
            </Reveal>
            <Reveal className="mt-10" from="scale">
              <div className="rounded-[32px] bg-fog-white p-4 ring-1 ring-line sm:p-6">
                <Simulator />
              </div>
            </Reveal>
          </Container>
        </section>

        {/* Outcomes */}
        <section className="bg-paper-white pb-24">
          <Container>
            <div className="grid gap-5 md:grid-cols-2">
              {outcomes.map((o, i) => (
                <Reveal key={o.title} delay={(i % 2) * 90} from={i % 2 ? "right" : "left"}>
                  <article className="lift h-full rounded-card bg-mist-gray px-6 pt-7 pb-8">
                    <Pill tone={o.tone}>{o.pill}</Pill>
                    <h3 className="mt-5 font-sohne text-[22px] leading-[1.3] font-medium text-ink-black">{o.title}</h3>
                    <p className="mt-3 max-w-[48ch] font-sohne text-[16px] leading-[1.55] text-[#4b4f58]">{o.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Dashboard */}
        <section id="dashboard" className="bg-fog-white py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
              <Reveal>
                <Kicker>Owner dashboard</Kicker>
                <h2 className="mt-3 max-w-[12ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                  Know what to do next, without reading the chat.
                </h2>
                <ul className="mt-8 flex flex-col gap-5">
                  <Point title="Home">Actionable tasks, decisions waiting on you, proposals waiting on the client, and a short summary of what Bridgify handled.</Point>
                  <Point title="Needs attention">Each exception comes with the client’s message, the matching scope evidence, the revisions left, and a preview of your reply.</Point>
                  <Point title="Scope and history">See what you’ve agreed to, every amendment, and a full revision record, without scrolling back through messages.</Point>
                </ul>
              </Reveal>
              <Reveal delay={120} from="right">
                <DashboardPreview />
              </Reveal>
            </div>
          </Container>
        </section>

        {/* Proposals */}
        <section id="proposals" className="bg-paper-white py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
              <Reveal className="order-2 lg:order-1" from="left">
                <ProposalPreview />
              </Reveal>
              <Reveal className="order-1 lg:order-2">
                <Kicker>Proposals and approval</Kicker>
                <h2 className="mt-3 max-w-[13ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                  Extra work gets a real yes.
                </h2>
                <p className="mt-5 max-w-[460px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
                  Turn an out-of-scope request into a proposal with deliverables, exclusions, price, date impact and an expiry date. Bridgify
                  can draft the wording, but you set the numbers.
                </p>
                <ol className="mt-8 flex flex-col gap-4">
                  {[
                    "You review the terms and the exact message before anything is sent.",
                    "The designated approver signs in to see the terms. Forwarding the link doesn’t pass on the right to approve.",
                    "Changing the terms creates a new version. Old versions can no longer be approved.",
                    "On approval, the scope, tasks and approved value update together, exactly once.",
                  ].map((line, i) => (
                    <li key={line} className="grid grid-cols-[auto_1fr] gap-3 font-sohne text-[16px] leading-[1.5] text-ink-black">
                      <span className="pt-[3px] font-sohne text-[13px] text-ash-gray tabular-nums">0{i + 1}</span>
                      {line}
                    </li>
                  ))}
                </ol>
              </Reveal>
            </div>
          </Container>
        </section>

        {/* Guardrails */}
        <section id="trust" className="spotlight py-24 text-white" onPointerMove={moveSpotlight}>
          <Container>
            <Reveal>
              <p className="font-sohne text-[14px] text-white/50">Guardrails</p>
              <h2 className="mt-3 max-w-[14ch] font-signifier text-heading font-normal md:text-heading-lg">Built to never overpromise.</h2>
              <p className="mt-5 max-w-[520px] font-sohne text-[17px] leading-[1.5] text-white/65">
                An assistant that agrees to the wrong thing is worse than no assistant. Bridgify is designed around what it must not do.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {guardrails.map(([title, body], i) => (
                <Reveal key={title} delay={(i % 4) * 70}>
                  <div className="border-t border-white/15 pt-5 transition-colors duration-300 hover:border-brand-light">
                    <h3 className="font-sohne text-[17px] leading-[1.35] font-medium">{title}</h3>
                    <p className="mt-2 font-sohne text-[15px] leading-[1.55] text-white/60">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Not doing */}
        <section className="bg-paper-white py-24">
          <Container>
            <Reveal from="scale">
              <article className="mx-auto max-w-[880px] rounded-card bg-brand-tint px-7 py-10 text-brand sm:px-12 sm:py-12">
                <p className="font-sohne text-[14px] leading-[1.4]">Straight answers</p>
                <h2 className="mt-3 font-signifier text-[38px] leading-[1.15] font-normal sm:text-[48px]">What Bridgify doesn’t do</h2>
                <ul className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-x-8">
                  {notDoing.map((item) => (
                    <li key={item} className="grid grid-cols-[auto_1fr] gap-3 font-sohne text-[16px] leading-[1.5]">
                      <span aria-hidden="true">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 max-w-[52ch] font-sohne text-[17px] leading-[1.5] font-[430]">
                  You do the work. Bridgify makes sure the chat doesn’t eat your day, or your margins.
                </p>
              </article>
            </Reveal>
          </Container>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-paper-white pt-8 pb-24">
          <Container>
            <PricingSummary />
          </Container>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-fog-white py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <Reveal>
                <Kicker>FAQ</Kicker>
                <h2 className="mt-3 max-w-[10ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">Good questions.</h2>
              </Reveal>
              <Reveal delay={80}>
                <div className="divide-y divide-line border-y border-line">
                  {faqs.map((f) => (
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
              </Reveal>
            </div>
          </Container>
        </section>

        {/* Early access */}
        <section id="access" className="hero relative overflow-hidden py-28">
          <div className="orb orb-float top-[12%] left-[10%] size-[320px] bg-[#d3e2f6]/80" aria-hidden="true" />
          <div className="orb orb-float right-[5%] bottom-[8%] size-[340px] bg-[#e4edf9]/80" style={{ animationDelay: "-8s" }} aria-hidden="true" />
          <div className="hero-noise" aria-hidden="true" />
          <Container className="relative z-10">
            <Reveal className="mx-auto max-w-[640px] text-center" from="scale">
              <h2 className="font-signifier text-[48px] leading-[1.05] font-normal tracking-[-0.02em] text-ink-black sm:text-[72px]">
                Less chasing.
                <br />
                <span className="shine bg-[linear-gradient(90deg,#121826,#0051cb,#558cd1,#0051cb,#121826)] bg-clip-text text-transparent">
                  More building.
                </span>
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <FilledButton href={SIGN_UP_HREF}>Try for free</FilledButton>
                <GhostButton href={SIGN_IN_HREF}>Sign in</GhostButton>
              </div>
              <div className="mt-2">
                <ArrowLink href="#try">Or try a client message first</ArrowLink>
              </div>
            </Reveal>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function HeadlineWords({ text, start }: { text: string; start: number }) {
  return (
    <span className="inline-block">
      {text.split(" ").map((word, i) => (
        <span key={i} className="word-rise mr-[0.22em] last:mr-0" style={{ animationDelay: `${start + i * 110}ms` } as CSSProperties}>
          {word}
        </span>
      ))}
    </span>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <p className="font-sohne text-[17px] leading-[1.35] font-medium text-ink-black">{title}</p>
      <p className="mt-1 max-w-[46ch] font-sohne text-[15px] leading-[1.55] text-slate-gray">{children}</p>
    </li>
  );
}
