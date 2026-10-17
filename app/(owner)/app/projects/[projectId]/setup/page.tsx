import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/session";
import { projectBundle } from "@/lib/db/project";
import { ProjectWizard } from "@/components/setup/project-wizard";
import type { Bundle } from "@/lib/domain/types";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { client } = await requireOwner();
  const id = (await params).projectId;
  if (!z.uuid().safeParse(id).success) notFound();
  const bundle = (await projectBundle(client, id)) as Bundle;
  const raw = Number((await searchParams).step || bundle.project.setup_step);
  const step = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : 1;
  return (
    <ProjectWizard
      key={`${id}-${step}-${bundle.documents[0]?.id}-${bundle.documents[0]?.status}`}
      bundle={bundle}
      step={step}
    />
  );
}
