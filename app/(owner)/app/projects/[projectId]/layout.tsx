import { ProjectHeader } from "@/components/dashboard/project-header";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <>
      <ProjectHeader projectId={projectId} />
      {children}
    </>
  );
}
