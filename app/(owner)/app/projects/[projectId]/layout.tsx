import { ProjectWorkspace } from "@/components/projects/project-workspace";
import type { Project } from "@/lib/domain/types";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/session";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { client } = await requireOwner();
  const id = (await params).projectId;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load project. Retry.");
  if (!data) notFound();
  return (
    <ProjectWorkspace project={data as Project}>{children}</ProjectWorkspace>
  );
}
