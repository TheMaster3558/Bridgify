import type { Metadata } from "next";
import { NeedsAttention } from "@/components/dashboard/needs-attention";

export const metadata: Metadata = { title: "Needs Attention" };

export default function Page() {
  return <NeedsAttention />;
}
