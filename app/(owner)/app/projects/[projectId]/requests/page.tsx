import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { queryList,listInput,type SearchParams } from "@/lib/dashboard/list-query";
import { ListControls } from "@/components/dashboard/list-controls";
export default async function Page({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<SearchParams>}){
 const {client}=await requireOwner();const {projectId}=await params;const input=listInput({...await searchParams,project:projectId});const result=await queryList(client,"requests",input);
 return <main className="grid gap-4 p-6"><h1 className="text-2xl font-semibold">Requests</h1><ListControls input={input} total={result.total} statuses={["all","owner_review","awaiting_details","accepted","closed"]}/>{!result.items.length&&<p>No matching requests.</p>}<ul className="grid gap-3">{result.items.map(r=><li className="rounded border p-4" key={String(r.id)}><Link className="underline" href={`/app/projects/${projectId}/requests/${r.id}`}>{String(r.summary)}</Link><p className="text-sm text-muted-foreground">{String(r.state).replaceAll("_"," ")} · updated {String(r.updated_at)}</p></li>)}</ul></main>;
}
