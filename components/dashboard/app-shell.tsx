"use client";

import { Fragment, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleAlert,
  FileText,
  FolderKanban,
  House,
  ListChecks,
  LogOut,
  MessagesSquare,
  Settings,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

import { navItem, navItemActive } from "@/components/dashboard/nav-styles";
import { QuickSearch } from "@/components/dashboard/quick-search";
import {
  NavCount,
  useSidebarCounts,
} from "@/components/dashboard/sidebar-counts";
import type { SidebarCounts } from "@/lib/dashboard/sidebar-counts";
import { SettingsButton } from "@/components/dashboard/settings-button";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

const nav = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  {
    href: "/app/tasks",
    label: "Actionable Tasks",
    icon: ListChecks,
    count: "tasks",
    unit: "open",
  },
  {
    href: "/app/decisions",
    label: "Needs Attention",
    icon: CircleAlert,
    count: "decisions",
    unit: "waiting",
  },
  {
    href: "/app/proposals",
    label: "Proposals",
    icon: FileText,
    count: "proposals",
    unit: "in progress",
  },
] satisfies {
  href: string;
  label: string;
  icon: typeof House;
  count?: keyof SidebarCounts;
  unit?: string;
}[];

const searchPages = [
  ...nav,
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 1 ? words[0][0] + words[words.length - 1][0] : text.charAt(0)
  ).toUpperCase();
}

function ProfileMenu({ name, email }: { name: string; email: string }) {
  const signoutForm = useRef<HTMLFormElement>(null);
  const displayName = name || email.split("@")[0] || "Account";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account"
        className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-sidebar-accent px-3 py-2 text-left outline-none hover:bg-[#e3e3e3] focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:hover:bg-[#333333]"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-sm font-semibold text-white"
        >
          {initials(displayName)}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-[15px] font-semibold text-sidebar-foreground">
            {displayName}
          </span>
          {email && (
            <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              {email}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="mr-1 grid size-4 shrink-0 place-items-center rounded bg-black/10 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
        >
          <ChevronDown className="size-3.5" />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-50 min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <form
            ref={signoutForm}
            action="/auth/signout"
            method="post"
            className="hidden"
          >
            <button type="submit">Sign out</button>
          </form>
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              signoutForm.current?.requestSubmit();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({
  children,
  email,
  name,
  timezone,
  organization,
  counts: initialCounts = null,
}: {
  children: React.ReactNode;
  email?: string;
  name: string;
  timezone: string;
  organization: string;
  counts?: SidebarCounts | null;
}) {
  const pathname = usePathname();
  const counts = useSidebarCounts(initialCounts, pathname);
  const projectId = pathname.match(
    /^\/app\/projects\/([0-9a-f-]{36})(?:\/|$)/i,
  )?.[1];
  const conversationHref = projectId
    ? `/app/projects/${projectId}/conversation`
    : "";
  const workspace = organization || "Workspace";

  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] md:grid-cols-[284px_minmax(0,1fr)]">
      <aside className="min-w-0 self-stretch bg-background">
        <div className="sticky top-0 h-dvh p-2 md:p-3">
          <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-[28px] border border-sidebar-border bg-sidebar p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <Link
              href="/app"
              className="mb-0.5 flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-[#dcdcdc] text-[15px] font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200"
              >
                {workspace.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-base font-semibold text-sidebar-foreground">
                {workspace}
              </span>
            </Link>
            <QuickSearch
              pages={searchPages}
              className="flex w-full items-center gap-2 rounded-full bg-sidebar-accent px-2 py-1.5 text-[15px] text-neutral-500 outline-none transition-colors hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40 dark:text-neutral-400"
            />
            <nav aria-label="Main" className="flex flex-col gap-0.5">
              {nav.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const count =
                  "count" in item && item.count
                    ? counts?.[item.count]
                    : undefined;
                const countId =
                  "count" in item ? `nav-count-${item.count}` : undefined;
                return (
                  <Fragment key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-describedby={count ? countId : undefined}
                      className={cn(navItem, active && navItemActive)}
                    >
                      <Icon aria-hidden className="size-[18px] shrink-0" />
                      {item.label}
                      <NavCount
                        count={count}
                        active={active}
                        alert={"count" in item && item.count === "decisions"}
                      />
                    </Link>
                    {count ? (
                      <span id={countId} className="sr-only">
                        {count} {"unit" in item ? item.unit : ""}
                      </span>
                    ) : null}
                  </Fragment>
                );
              })}
            </nav>
            {projectId && (
              <nav aria-label="Project shortcuts" className="grid gap-0.5">
                <p className="px-3 pb-1 text-xs font-medium tracking-wide text-neutral-400">
                  CURRENT PROJECT
                </p>
                <Link
                  href={conversationHref}
                  aria-current={
                    pathname === conversationHref ? "page" : undefined
                  }
                  className={cn(
                    navItem,
                    pathname === conversationHref && navItemActive,
                  )}
                >
                  <MessagesSquare
                    aria-hidden
                    className="size-[18px] shrink-0"
                  />
                  Conversation
                </Link>
              </nav>
            )}
            <div className="mt-auto flex flex-col gap-0.5">
              <div className="pb-2.5">
                <ThemeToggle />
              </div>
              <SettingsButton
                email={email || ""}
                name={name}
                timezone={timezone}
                organization={organization}
                className={cn(
                  navItem,
                  pathname === "/app/settings" && navItemActive,
                )}
              />
              <div className="pt-2.5">
                <ProfileMenu name={name} email={email || ""} />
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
