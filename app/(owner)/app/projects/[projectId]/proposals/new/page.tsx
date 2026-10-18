import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { ProposalEditor } from "@/components/proposals/proposal-editor";
export default async function Page({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{request?:string}>}){
 const {client}=await requireOwner();const {projectId}=await params;const {request}=await searchParams;
 const project=checked(await client.from("projects").select("scope_version").eq("id",projectId).single());if(!project)notFound();
 const scope=checked(await client.from("scope_versions").select("terms").eq("project_id",projectId).eq("version",project.scope_version).single());if(!scope)notFound();
 const source=request?checked(await client.from("automation_requests").select("id,summary").eq("id",request).eq("project_id",projectId).maybeSingle()):null;
 return <main className="grid gap-4 p-6"><h1 className="text-2xl font-semibold">New proposal</h1><ProposalEditor projectId={projectId} baselineTerms={(scope.terms as {text:string}[]).map(t=>t.text)} sourceRequestId={source?.id} sourceTitle={source?.summary}/></main>;
}
