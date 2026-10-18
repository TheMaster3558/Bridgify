import type { Metadata } from "next";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { requireOwner } from "@/lib/auth/session";
import { listOwnerDecisions } from "@/lib/dashboard/work-management";
import { loadClientPhotos } from "@/lib/clients/photo-urls";

export const metadata: Metadata = { title: "Needs Attention" };

export default async function Page() {
  const { client } = await requireOwner();
  const decisions = await listOwnerDecisions(client);
  const clientPhotos = await loadClientPhotos(
    client,
    decisions.map((decision) => decision.client_name),
  );
  return <NeedsAttention decisions={decisions} clientPhotos={clientPhotos} />;
}
