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

  return (
    <div className="min-h-screen md:pl-[236px]">
      <aside className="flex flex-col gap-4 border-b bg-card p-3 md:fixed md:inset-y-0 md:left-0 md:w-[236px] md:overflow-hidden md:border-r md:border-b-0 md:p-4">
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
