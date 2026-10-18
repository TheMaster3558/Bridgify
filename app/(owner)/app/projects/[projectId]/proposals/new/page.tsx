import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { ProposalEditor } from "@/components/proposals/proposal-editor";
export default async function Page({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{request?:string}>}){
 const {client}=await requireOwner();const {projectId}=await params;const {request}=await searchParams;
 const source=request?checked(await client.from("automation_requests").select("id,summary").eq("id",request).eq("project_id",projectId).maybeSingle()):null;
 return <main className="grid gap-4 p-6"><h1 className="text-2xl font-semibold">New proposal</h1><ProposalEditor projectId={projectId} sourceRequestId={source?.id} sourceTitle={source?.summary}/></main>;
}
