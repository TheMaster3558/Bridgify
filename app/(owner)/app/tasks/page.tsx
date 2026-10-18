import type { Metadata } from "next";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";

export const metadata: Metadata = { title: "Actionable Tasks" };

export default function Page() {
  return <TasksWorkspace />;
}
