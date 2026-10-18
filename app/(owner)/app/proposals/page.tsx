import type { Metadata } from "next";
import { ProposalsWorkspace } from "@/components/dashboard/proposals-workspace";

export const metadata: Metadata = { title: "Proposals" };

export default function Page() {
  return <ProposalsWorkspace />;
}
