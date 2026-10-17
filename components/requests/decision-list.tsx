"use client";

import type { Decision } from "@/lib/fixtures/types";

export function DecisionList({
  decisions,
  onSelect,
  emptyLabel,
}: {
  decisions: Decision[];
  onSelect: (decisionId: string) => void;
  emptyLabel: string;
}) {
  if (decisions.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul>
      {decisions.map((decision) => (
        <li key={decision.id} className="border-b last:border-b-0">
          <button
            type="button"
            onClick={() => onSelect(decision.id)}
            className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="text-xs font-medium text-warn">{decision.reasonLabel}</span>
            <span className="font-medium">{decision.clientMessage}</span>
            <span className="text-xs text-muted-foreground">{decision.id}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
