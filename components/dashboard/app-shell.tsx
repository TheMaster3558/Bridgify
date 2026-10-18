"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { AccountMenu } from "@/components/dashboard/account-menu";

const nav = [
  { href: "/app", label: "Home" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/tasks", label: "Actionable Tasks" },
  { href: "/app/decisions", label: "Needs Attention" },
  { href: "/app/proposals", label: "Proposals" },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  email,
  name,
  timezone,
  organization,
}: {
  children: React.ReactNode;
  email?: string;
  name: string;
  timezone: string;
  organization: string;
}) {
  const pathname = usePathname();
  const projectId = pathname.match(
    /^\/app\/projects\/([0-9a-f-]{36})(?:\/|$)/i,
  )?.[1];

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 border-b bg-card p-3 md:border-r md:border-b-0 md:p-4">
        <Link href="/app" className="flex items-center gap-2.5 px-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            B
          </span>
          <span className="font-display text-xl font-semibold">Bridgify</span>
        </Link>
        <nav
          aria-label="Main"
          className="flex gap-1 overflow-x-auto md:flex-col"
        >
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {projectId && (
          <nav
            aria-label="Project shortcuts"
            className="grid gap-1 border-t pt-4"
          >
            <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
              CURRENT PROJECT
            </p>
            <Link
              href={`/app/projects/${projectId}/conversation`}
              aria-current={
                pathname === `/app/projects/${projectId}/conversation`
                  ? "page"
                  : undefined
              }
              className={cn(
                "rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === `/app/projects/${projectId}/conversation` &&
                  "bg-accent text-foreground",
              )}
            >
              Conversation
            </Link>
          </nav>
        )}
        <div className="mt-auto px-2">
          <AccountMenu
            email={email || ""}
            name={name}
            timezone={timezone}
            organization={organization}
          />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
