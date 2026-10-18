import type { Metadata } from "next";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { requireOwner } from "@/lib/auth/session";
import { listOwnerDecisions } from "@/lib/dashboard/work-management";

export const metadata: Metadata = { title: "Needs Attention" };

export default async function Page() {
  const { client } = await requireOwner();
  const decisions = await listOwnerDecisions(client);
  return <NeedsAttention decisions={decisions} />;
}
