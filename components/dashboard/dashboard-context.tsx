"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  decisions,
  isActionableTask,
  projectById,
  projects,
  proposalSummaries,
  tasks,
} from "@/lib/fixtures/dashboard";
import type { Decision, Project, Task } from "@/lib/fixtures/types";

type DashboardContextValue = {
  projects: Project[];
  project: Project;
  setProjectId: (id: string) => void;
  tasks: Task[];
  actionableTasks: Task[];
  decisions: Decision[];
  awaitingApprovalCount: number;
  integrationHealthy: boolean;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState(projects[0].id);
  const project = projectById(projectId);

  const value = useMemo<DashboardContextValue>(() => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectDecisions = decisions.filter((decision) => decision.projectId === project.id);
    return {
      projects,
      project,
      setProjectId,
      tasks: projectTasks,
      actionableTasks: projectTasks.filter(isActionableTask),
      decisions: projectDecisions,
      awaitingApprovalCount: proposalSummaries.filter(
        (proposal) => proposal.projectId === project.id && proposal.status === "awaiting_client",
      ).length,
      integrationHealthy: project.imessage === "connected",
    };
  }, [project]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }
  return value;
}
