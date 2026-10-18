"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  CircleAlert,
  FileText,
  FolderKanban,
  House,
  ListChecks,
  LogOut,
  MessagesSquare,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";

import { SettingsButton } from "@/components/dashboard/settings-button";

const nav = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/tasks", label: "Actionable Tasks", icon: ListChecks },
  { href: "/app/decisions", label: "Needs Attention", icon: CircleAlert },
  { href: "/app/proposals", label: "Proposals", icon: FileText },
];

const navItem =
  "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-[15px] font-medium whitespace-nowrap text-neutral-500 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40";
const navItemActive =
  "border-[#1f5ae6] bg-gradient-to-b from-[#4a82ff] to-[#2563eb] text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(37,99,235,0.35)] hover:bg-transparent hover:text-sidebar-primary-foreground";

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function WorkspaceMenu({ organization }: { organization: string }) {
  const signoutForm = useRef<HTMLFormElement>(null);
  const workspace = organization || "Workspace";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Workspace: ${workspace}`}
        className="flex min-w-0 items-center gap-2.5 rounded-xl p-1 pr-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dcdcdc] text-base font-semibold text-neutral-600"
        >
          {workspace.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-base font-semibold text-sidebar-foreground">
          {workspace}
        </span>
        <ChevronsUpDown
          aria-hidden
          className="size-4 shrink-0 text-neutral-500"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
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
  const conversationHref = projectId
    ? `/app/projects/${projectId}/conversation`
    : "";

  return (
    <div className="grid min-h-screen grid-cols-[216px_minmax(0,1fr)] md:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="min-w-0 self-stretch bg-background">
        <div className="sticky top-0 h-dvh p-2 md:p-3">
          <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-[28px] border border-sidebar-border bg-sidebar p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex min-w-0 items-center pt-1">
              <WorkspaceMenu organization={organization} />
            </div>
            <nav aria-label="Main" className="flex flex-col gap-1">
              {nav.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(navItem, active && navItemActive)}
                  >
                    <Icon aria-hidden className="size-[18px] shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
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
            </nav>
            {projectId && (
              <nav aria-label="Project shortcuts" className="grid gap-1">
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
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
