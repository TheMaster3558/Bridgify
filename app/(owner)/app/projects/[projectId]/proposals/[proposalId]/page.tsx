import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { checked } from "@/lib/api";
import { ProposalEditor } from "@/components/proposals/proposal-editor";
export default async function Page({params,searchParams}:{params:Promise<{projectId:string;proposalId:string}>;searchParams:Promise<{revision?:string}>}){
 const {client}=await requireOwner();const {projectId,proposalId}=await params;const {revision}=await searchParams;
 let query=client.from("proposal_revisions").select("*").eq("project_id",projectId).eq("proposal_id",proposalId);if(revision)query=query.eq("revision",Number(revision));
 const row=checked(await query.order("revision",{ascending:false}).limit(1).maybeSingle());if(!row)notFound();
 const outbox=checked(await client.from("automation_outbox").select("id,state,provider_guid").eq("project_id",projectId).eq("purpose",`proposal:${proposalId}:r${row.revision}`).maybeSingle());
 return <main className="grid gap-4 p-6"><h1 className="text-2xl font-semibold">Proposal · revision {row.revision}</h1><p>Business status: {row.status} · Delivery: {outbox?.state??"Not submitted"}</p><Link className="underline" href={`/app/projects/${projectId}/automation`}>Inspect delivery and recovery</Link><ProposalEditor key={`${row.revision}-${row.version}`} projectId={projectId} proposal={row}/></main>;
}
