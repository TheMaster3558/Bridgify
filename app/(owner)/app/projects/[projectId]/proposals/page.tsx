import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { queryList,listInput,type SearchParams } from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
import { ProposalsWorkspace } from "@/components/dashboard/proposals-workspace";
import type { ProposalRevisionRecord } from "@/lib/dashboard/work-management-types";
export default async function Page({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<SearchParams>}){
 const {client}=await requireOwner();const {projectId}=await params;const input=listInput({...await searchParams,project:projectId});const result=await queryList(client,"proposals",input);
 return <><Link className="m-6 inline-block rounded border p-2" href={`/app/projects/${projectId}/proposals/new`}>New proposal</Link><ListControls input={input} total={result.total} statuses={["all","draft","awaiting_client","approved","declined","changes_requested","withdrawn","superseded"]}/><ProposalsWorkspace key={JSON.stringify(input)} proposals={result.items as unknown as ProposalRevisionRecord[]} serverManaged/></>;
}
