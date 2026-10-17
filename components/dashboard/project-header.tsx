"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/dashboard/status-pill";
import { projectById } from "@/lib/sample";
import { cn } from "@/lib/utils";

const tabs = [
  { slug: "", label: "Overview" },
  { slug: "/work", label: "Work" },
  { slug: "/requests", label: "Requests" },
  { slug: "/scope", label: "Scope & Revisions" },
  { slug: "/proposals", label: "Proposals" },
  { slug: "/conversation", label: "Conversation" },
  { slug: "/activity", label: "Activity" },
  { slug: "/automation", label: "Automation" },
];

export function ProjectHeader({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const project = projectById(projectId);
  const base = `/app/projects/${projectId}`;

  return (
    <div className="border-b bg-card px-6 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {project.client} · {project.contact}
            </span>
            <StatusPill tone={project.state === "Active" ? "ok" : "neutral"}>
              {project.state}
            </StatusPill>
            <StatusPill tone={project.automation === "Enabled" ? "ok" : "neutral"}>
              Automation {project.automation === "Enabled" ? "on" : "off"}
            </StatusPill>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button">
            Pause automation
          </Button>
          <Button asChild>
            <Link href="/app/decisions">Review decisions</Link>
          </Button>
        </div>
      </div>
      <nav aria-label="Project" className="mt-3 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const href = `${base}${tab.slug}`;
          const active =
            tab.slug === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
                active && "border-primary text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
