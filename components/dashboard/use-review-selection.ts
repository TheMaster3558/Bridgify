"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "@/components/dashboard/dashboard-context";

export function useReviewSelection() {
  const dashboard = useDashboard();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);

  useEffect(() => {
    setTaskId(null);
    setDecisionId(null);
  }, [dashboard.project.id]);

  const task = dashboard.tasks.find((item) => item.id === taskId) ?? null;
  const decision = dashboard.decisions.find((item) => item.id === decisionId) ?? null;

  return {
    ...dashboard,
    task,
    decision,
    openTask(id: string) {
      setDecisionId(null);
      setTaskId(id);
    },
    openDecision(id: string) {
      setTaskId(null);
      setDecisionId(id);
    },
    closePanel() {
      setTaskId(null);
      setDecisionId(null);
    },
  };
}
