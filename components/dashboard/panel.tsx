import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-5 p-6", className)}>
      {children}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "warn" | "crit";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const styles = {
    info: "border-info/30 bg-info-soft",
    warn: "border-warn/30 bg-warn-soft",
    crit: "border-crit/30 bg-crit-soft",
  };
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm",
        styles[tone],
      )}
    >
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
