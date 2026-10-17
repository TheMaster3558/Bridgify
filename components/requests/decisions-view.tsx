"use client";

import { useState } from "react";
import Link from "next/link";
import { PageBody, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decisions } from "@/lib/sample";
import { cn } from "@/lib/utils";

const actions = [
  "Accept included work",
  "Allow an extra revision",
  "Ask client",
  "Prepare proposal",
  "Decline",
  "Dismiss",
];

export function DecisionsView() {
  const [selectedId, setSelectedId] = useState(decisions[0].id);
  const decision = decisions.find((item) => item.id === selectedId) ?? decisions[0];

  return (
    <PageBody>
      <div>
        <h1 className="text-2xl font-semibold">Needs Attention</h1>
        <p className="text-sm text-muted-foreground">
          Decisions the assistant isn’t allowed to make. Routine requests never land here.
        </p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Panel bodyClassName="p-0">
          <ul>
            {decisions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full border-b px-4 py-3 text-left last:border-b-0",
                    item.id === decision.id && "bg-accent",
                  )}
                >
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.reason} · {item.request} · {item.age}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={decision.title} description={`${decision.id} · ${decision.request} · Harbor & Pine`}>
          <div className="space-y-4 text-sm">
            <blockquote className="border-l-4 border-info bg-muted px-3 py-2">
              {decision.source}
              <cite className="mt-1 block text-xs text-muted-foreground not-italic">{decision.sourceMeta}</cite>
            </blockquote>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Scope evidence</p>
              <p className="mt-1">{decision.evidence}</p>
              <p className="mt-2 text-muted-foreground">{decision.policy}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) =>
                action === "Prepare proposal" ? (
                  <Button key={action} variant="outline" size="sm" asChild>
                    <Link href="/app/projects/harbor-pine/proposals/P-001">{action}</Link>
                  </Button>
                ) : (
                  <Button key={action} variant="outline" size="sm" type="button">
                    {action}
                  </Button>
                ),
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Override reason
              </p>
              <Input placeholder="Required to accept when the policy check failed" />
            </div>
            <div className="rounded-xl bg-muted p-3">{decision.reply}</div>
            {decision.note ? (
              <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-amber-950">
                Private note · {decision.note}
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </PageBody>
  );
}
