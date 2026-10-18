import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

/** The owner app's existing auth screen. */
export const SIGN_UP_HREF = "/login?mode=signup";
export const SIGN_IN_HREF = "/login";

const filledClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-brand px-5 font-sohne text-[16px] leading-none font-[430] whitespace-nowrap text-paper-white transition-[background-color,transform] duration-200 hover:bg-brand-dark active:scale-[0.98]";

const ghostClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full px-5 font-sohne text-[16px] leading-none font-[430] whitespace-nowrap text-ink-black transition-[background-color,transform] duration-200 hover:bg-black/5 active:scale-[0.98]";

const compactClass =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-brand px-3 font-sohne text-[15px] leading-none font-[430] whitespace-nowrap text-paper-white transition-[background-color,transform] duration-200 hover:opacity-90 active:opacity-80";

export function FilledButton({
  href,
  children,
  onClick,
  compact = false,
}: {
  href: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  compact?: boolean;
}) {
  return (
    <a className={compact ? compactClass : filledClass} href={href} onClick={onClick}>
      {children}
    </a>
  );
}

export function GhostButton({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a className={ghostClass} href={href} onClick={onClick}>
      {children}
    </a>
  );
}

/** The two-arch bridge mark: dark arch in front, light arch behind. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="150 395 955 460" className={className} aria-hidden="true">
      <path
        fill="#558cd1"
        d="M640 528C700 495 770 475 822 475C842 475 858 479 872 487C992 548 1070 692 1093 846L845 846C838 692 772 566 640 528Z"
      />
      <path
        fill="#0051cb"
        d="M160 846C200 600 384 405 612 405C700 405 770 430 828 463C758 464 690 486 634 524C528 598 448 716 438 846Z"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-ink-black" aria-label="Bridgify home">
      <BrandMark className="h-[19px] w-auto" />
      <span className="font-sohne text-[17px] leading-none font-medium tracking-[-0.03em]">Bridgify</span>
    </Link>
  );
}

export function ArrowLink({
  href,
  children,
  tone = "ink",
}: {
  href: string;
  children: ReactNode;
  tone?: "ink" | "sienna";
}) {
  const color = tone === "sienna" ? "text-brand" : "text-ink-black";
  return (
    <a
      href={href}
      className={`link-arrow inline-flex items-center py-4 font-sohne text-[16px] leading-none font-normal ${color}`}
    >
      {children} →
    </a>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-sohne text-[14px] leading-[1.4] font-normal text-ash-gray ${className}`}>{children}</p>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sohne text-[12px] leading-none font-medium whitespace-nowrap ${tone}`}
    >
      {children}
    </span>
  );
}

export const tones = {
  accept: "bg-[#e3f1e7] text-[#245c3a]",
  clarify: "bg-[#e4edf9] text-[#24508f]",
  owner: "bg-[#fbefd5] text-[#7a4d00]",
  neutral: "bg-mist-gray text-[#4b4f58]",
  peach: "bg-brand-tint text-brand",
};

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}
