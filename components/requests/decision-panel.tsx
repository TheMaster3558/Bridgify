"use client";

import { useState } from "react";
import { SlideOver } from "@/components/dashboard/slide-over";
import { Button } from "@/components/ui/button";
import type { Decision } from "@/lib/fixtures/types";

const actions = [
  "Override / Include",
  "Grant Extra Revision",
  "Request Clarification",
  "Draft Proposal",
] as const;

export function DecisionResolutionPanel({
  decision,
  onClose,
}: {
  decision: Decision | null;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<{ decisionId: string; action: string } | null>(null);
  const selected = choice && decision && choice.decisionId === decision.id ? choice.action : null;

  return (
    <SlideOver
      open={decision !== null}
      title={decision?.reasonLabel ?? "Decision"}
      description={decision ? `${decision.id} · ${decision.reason}` : undefined}
      onClose={onClose}
    >
      {decision ? (
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold">Client message</h3>
            <p className="mt-2 rounded-md border px-3 py-2 text-sm">{decision.clientMessage}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">Why this needs you</h3>
            <p className="mt-2 text-sm text-muted-foreground">{decision.evidence}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">Recommended action</h3>
            <p className="mt-2 text-sm">{decision.recommendedAction}</p>
          </section>
          <div className="flex flex-col gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={selected === action ? "default" : "outline"}
                aria-pressed={selected === action}
                onClick={() => setChoice({ decisionId: decision.id, action })}
              >
                {action}
              </Button>
            ))}
          </div>
          {selected ? (
            <p role="status" className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
              Preview only — nothing was sent. Selected: {selected}.
            </p>
          ) : null}
        </div>
      ) : null}
    </SlideOver>
  );
}
