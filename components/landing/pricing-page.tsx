"use client";

import { useState } from "react";
import { SiteFooter, SiteHeader, SkipLink } from "./layout";
import { Reveal } from "./motion";
import {
  BillingToggle,
  CompareTable,
  EnterpriseBuilder,
  PlanGrid,
  PricingFaq,
  PricingFootnote,
  type Billing,
} from "./pricing";
import { ArrowLink, Container, FilledButton, GhostButton, Kicker, SIGN_UP_HREF } from "./ui";

const counts = [
  { who: "You", note: "The workspace owner", counts: true },
  { who: "Your teammates", note: "Designers, developers, PMs you add", counts: true },
  { who: "Your clients", note: "Everyone in the client iMessage group", counts: false },
  { who: "Bridgify", note: "The assistant itself", counts: false },
];

const everyPlan = [
  ["Never invents prices or dates", "Commercial terms always come from you."],
  ["Every task traces back", "Source message, agreement term and policy version."],
  ["Private stays private", "Notes and draft pricing never reach the client group."],
  ["Pause anytime", "Review-only mode on any project, on any plan."],
];

export function PricingPage() {
  const [billing, setBilling] = useState<Billing>("annual");

  return (
    <>
      <SkipLink />
      <SiteHeader current="/pricing" />

      <main id="content" className="overflow-x-clip">
        {/* Hero + plans */}
        <section className="hero relative -mt-16 overflow-hidden pt-16">
          <div className="orb orb-float top-[6%] right-[8%] size-[340px] bg-[#d3e2f6]/80" aria-hidden="true" />
          <div className="orb orb-float top-[30%] left-[-4%] size-[360px] bg-[#e4edf9]/80" style={{ animationDelay: "-7s" }} aria-hidden="true" />
          <div className="hero-noise" aria-hidden="true" />
          <Container className="relative z-10 pt-14 pb-24 lg:pt-20">
            <div className="mx-auto max-w-[760px] text-center">
              <p className="rise font-sohne text-[14px] text-slate-gray">Pricing</p>
              <h1
                className="rise mt-4 font-signifier text-[48px] leading-[1.04] tracking-[-0.02em] text-ink-black sm:text-[72px]"
                style={{ animationDelay: "100ms" }}
              >
                Pay for your team.
                <br />
                Your clients are free.
              </h1>
              <p className="rise mx-auto mt-5 max-w-[540px] font-sohne text-[18px] leading-[1.5] text-ink-black" style={{ animationDelay: "250ms" }}>
                Every plan includes the full iMessage assistant, the owner dashboard and client approvals. Plans differ by how many people
                work on your side, and how much you run through Bridgify.
              </p>
              <div className="rise mt-8 flex justify-center" style={{ animationDelay: "400ms" }}>
                <BillingToggle value={billing} onChange={setBilling} />
              </div>
            </div>
            <div className="mt-14">
              <PlanGrid billing={billing} />
            </div>
            <PricingFootnote />
          </Container>
        </section>

        {/* Who counts */}
        <section className="bg-paper-white py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
              <Reveal>
                <Kicker>Who counts as a person</Kicker>
                <h2 className="mt-3 max-w-[13ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                  Only the people doing the work.
                </h2>
                <p className="mt-5 max-w-[440px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
                  Add as many clients to a project’s chat as you like. Basic covers up to 3 people on your side, Pro up to 7, and Enterprise
                  as many as you need.
                </p>
              </Reveal>
              <div className="grid gap-3 sm:grid-cols-2">
                {counts.map((c, i) => (
                  <Reveal key={c.who} delay={i * 90} from="scale">
                    <div
                      className={`lift flex h-full items-start justify-between gap-3 rounded-[20px] p-5 ring-1 ${
                        c.counts ? "bg-white ring-line" : "bg-[#f3faf5] ring-[#d8eedf]"
                      }`}
                    >
                      <div>
                        <p className="font-sohne text-[17px] font-medium text-ink-black">{c.who}</p>
                        <p className="mt-1 font-sohne text-[14px] leading-[1.45] text-slate-gray">{c.note}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 font-sohne text-[12px] font-medium ${
                          c.counts ? "bg-mist-gray text-ink-black" : "bg-[#e3f1e7] text-[#245c3a]"
                        }`}
                      >
                        {c.counts ? "Counts" : "Free"}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* Compare */}
        <section id="compare" className="bg-fog-white py-24">
          <Container>
            <Reveal>
              <Kicker>Compare plans</Kicker>
              <h2 className="mt-3 max-w-[16ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                Everything, side by side.
              </h2>
            </Reveal>
            <Reveal className="mt-10" from="scale">
              <CompareTable />
            </Reveal>
            <p className="mt-4 font-sohne text-[13px] text-ash-gray md:hidden">Swipe the table sideways to see every plan.</p>
          </Container>
        </section>

        {/* Enterprise builder */}
        <section id="enterprise" className="bg-paper-white py-24">
          <Container>
            <Reveal>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <Kicker>Enterprise</Kicker>
                  <h2 className="mt-3 max-w-[15ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                    Build the plan your agency needs.
                  </h2>
                </div>
                <p className="max-w-[420px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
                  Choose your team size, projects, message volume, retention and add-ons. The estimate updates as you go.
                </p>
              </div>
            </Reveal>
            <div className="mt-12">
              <EnterpriseBuilder />
            </div>
          </Container>
        </section>

        {/* Every plan */}
        <section className="spotlight py-20 text-white">
          <Container>
            <Reveal>
              <p className="font-sohne text-[14px] text-white/50">On every plan</p>
              <h2 className="mt-3 max-w-[18ch] font-signifier text-[40px] leading-[1.1] md:text-[52px]">The guardrails never cost extra.</h2>
            </Reveal>
            <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {everyPlan.map(([title, body], i) => (
                <Reveal key={title} delay={i * 80}>
                  <div className="border-t border-white/15 pt-5">
                    <h3 className="font-sohne text-[17px] font-medium">{title}</h3>
                    <p className="mt-2 font-sohne text-[15px] leading-[1.55] text-white/60">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-10">
              <ArrowLink href="/#trust" tone="sienna">
                <span className="text-brand-tint">See all guardrails</span>
              </ArrowLink>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="bg-fog-white py-24">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <Reveal>
                <Kicker>Pricing FAQ</Kicker>
                <h2 className="mt-3 max-w-[12ch] font-signifier text-heading font-normal text-ink-black md:text-heading-lg">
                  The fine print, in plain words.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <PricingFaq />
              </Reveal>
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="hero relative overflow-hidden py-24">
          <div className="hero-noise" aria-hidden="true" />
          <Container className="relative z-10">
            <Reveal className="mx-auto max-w-[620px] text-center" from="scale">
              <h2 className="font-signifier text-[44px] leading-[1.05] tracking-[-0.02em] text-ink-black sm:text-[64px]">
                Start for free.
              </h2>
              <p className="mx-auto mt-4 max-w-[440px] font-sohne text-[17px] leading-[1.5] text-slate-gray">
                Create your account and set up your first project. Or see Bridgify handle a client message first.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                <FilledButton href={SIGN_UP_HREF}>Try for free</FilledButton>
                <GhostButton href="/#try">Try a client message</GhostButton>
              </div>
            </Reveal>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
