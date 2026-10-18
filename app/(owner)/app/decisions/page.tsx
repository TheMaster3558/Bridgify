import type { Metadata } from "next";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { listOwnerDecisions } from "@/lib/dashboard/work-management";
import { loadClientPhotos } from "@/lib/clients/photo-urls";

export const metadata: Metadata = { title: "Needs Attention" };

export default async function Page() {
  const { client } = await requireOwner();
  const decisions = await listOwnerDecisions(client);
  // review_only projects are activated and listed as Active elsewhere.
  const activeProjects =
    (checked(
      await client
        .from("projects")
        .select("id,name,client_name")
        .in("status", ["active", "review_only"])
        .order("name"),
    ) as { id: string; name: string; client_name: string }[] | null) ?? [];
  const clientPhotos = await loadClientPhotos(client, [
    ...decisions.map((decision) => decision.client_name),
    ...activeProjects.map((project) => project.client_name),
  ]);
  return (
    <NeedsAttention
      decisions={decisions}
      clientPhotos={clientPhotos}
      activeProjects={activeProjects}
    />
  );
}
