"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { organization, projectById } from "@/lib/sample";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Home", count: "" },
  { href: "/app/projects", label: "Projects", count: "3" },
  { href: "/app/tasks", label: "Actionable Tasks", count: "4" },
  { href: "/app/decisions", label: "Needs Attention", count: "8", hot: true },
  { href: "/app/proposals", label: "Proposals", count: "1" },
  { href: "/app/settings", label: "Settings", count: "" },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function crumbs(pathname: string) {
  if (pathname === "/app") return `${organization.name} / Home`;
  if (pathname.startsWith("/app/projects/new")) return "Projects / New project";
  if (pathname.startsWith("/app/projects/")) {
    const id = pathname.split("/")[3];
    const project = projectById(id);
    const section = pathname.split("/")[4];
    const label =
      section === "work"
        ? "Work"
        : section === "requests"
          ? "Requests"
          : section === "scope"
            ? "Scope"
            : section === "proposals"
              ? "Proposals"
              : section === "conversation"
                ? "Conversation"
                : section === "activity"
                  ? "Activity"
                  : section === "automation"
                    ? "Automation"
                    : "Overview";
    return `Projects / ${project.name} / ${label}`;
  }
  const item = nav.find((entry) => isActive(pathname, entry.href));
  return `${organization.name} / ${item?.label ?? "Home"}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 border-b bg-card p-3 md:border-r md:border-b-0 md:p-4">
        <Link href="/app" className="flex items-center gap-2.5 px-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            B
          </span>
          <span className="font-display text-xl font-semibold">Bridgify</span>
        </Link>
        <div className="hidden rounded-lg border px-3 py-2 text-sm md:block">
          <p className="text-xs text-muted-foreground">Organization</p>
          <p className="font-medium">{organization.name}</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
              >
                {item.label}
                {item.count ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      item.hot ? "bg-warn-soft text-warn" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden space-y-1 px-2 text-xs text-muted-foreground md:block">
          <p>Photon connected · last event 9:14 AM</p>
          <p>Gemini available</p>
          <p className="text-crit">1 delivery unknown</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-2.5 text-sm">
          <p className="text-muted-foreground">{crumbs(pathname)}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Last refreshed 9:41 AM</span>
            <span>Messaging healthy</span>
            <Link
              href="/app/settings"
              className="grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-primary"
              aria-label="Account settings"
            >
              AM
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
