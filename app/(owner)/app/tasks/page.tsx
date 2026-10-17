import { WorkSurface } from "@/components/tasks/work-surface";

export const metadata = { title: "Actionable Tasks" };

export default function TasksPage() {
  return (
    <WorkSurface
      heading={{
        title: "Actionable Tasks",
        description: "Confirmed work across projects. Same records as each project’s Work tab.",
      }}
      showProject
    />
  );
}
