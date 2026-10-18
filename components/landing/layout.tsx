import { useEffect, useState } from "react";
import { ScrollProgressBar, useScrolled } from "./motion";
import { Container, FilledButton, Logo, SIGN_IN_HREF, SIGN_UP_HREF } from "./ui";

export const nav = [
  { href: "/#mission", label: "Mission" },
  { href: "/#loop", label: "How it works" },
  { href: "/#try", label: "Try it" },
  { href: "/#dashboard", label: "Dashboard" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/** The header keeps a shorter list; every section stays on the page and in the footer. */
const headerNav = nav.filter((item) => item.href !== "/#loop" && item.href !== "/#dashboard");

export function SkipLink() {
  return (
    <a
      href="#content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink-black focus:px-4 focus:py-2 focus:text-paper-white"
    >
      Skip to content
    </a>
  );
}

/** Pages render client-side, so a `#hash` from another page has no target at load. Scroll to it once mounted. */
function useHashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "instant" }), 50);
    return () => window.clearTimeout(timer);
  }, []);
}

export function SiteHeader({ current }: { current?: string }) {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();
  useHashScroll();

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled ? "border-line bg-white/85 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.25)]" : "border-transparent bg-white/0"
      }`}
    >
      <ScrollProgressBar />
      <Container>
        <div className="grid h-16 grid-cols-[1fr_auto] items-center lg:grid-cols-[1fr_auto_1fr]">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {headerNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={current === item.href ? "page" : undefined}
                className={`font-sohne text-[15px] leading-none font-[430] hover:text-slate-gray ${
                  current === item.href ? "text-ink-black underline decoration-brand-tint decoration-2 underline-offset-8" : "text-ink-black"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-4">
            <a href={SIGN_IN_HREF} className="hidden font-sohne text-[15px] leading-none font-[430] text-ink-black hover:text-slate-gray sm:inline">
              Sign in
            </a>
            <FilledButton href={SIGN_UP_HREF} compact>
              Try for free
            </FilledButton>
            <button
              type="button"
              className="font-sohne text-[15px] font-[430] text-ink-black lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        <div
          id="mobile-nav"
          className={`grid transition-[grid-template-rows] duration-300 ease-out lg:hidden ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden" inert={open ? undefined : true}>
            <div className="flex flex-col gap-4 pb-5">
              {headerNav.map((item) => (
                <a key={item.href} href={item.href} className="font-sohne text-[16px] font-[430] text-ink-black" onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              ))}
              <a href={SIGN_IN_HREF} className="font-sohne text-[16px] font-[430] text-ink-black sm:hidden">
                Sign in
              </a>
            </div>
          </div>
        </div>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-white">
      <Container className="flex flex-col gap-8 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo />
          <p className="mt-3 font-sohne text-caption text-slate-gray">Client requests, handled in the chat.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="font-sohne text-[15px] leading-[1.5] text-slate-gray hover:text-ink-black">
              {item.label}
            </a>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
