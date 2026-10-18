import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { ProjectWizard } from "@/components/setup/project-wizard";
export const metadata: Metadata = { title: "New project" };
export default async function Page() {
  await requireOwner();
  return <ProjectWizard />;
}
