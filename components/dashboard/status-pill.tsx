import { cn } from "@/lib/utils";

const tones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  crit: "bg-crit-soft text-crit",
  info: "bg-info-soft text-info",
  accent: "bg-accent text-primary",
  neutral: "bg-secondary text-muted-foreground",
} as const;

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
