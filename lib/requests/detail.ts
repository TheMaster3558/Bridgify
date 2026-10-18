import { checked, ApiError } from "@/lib/api";
import type { db } from "@/lib/db/server";
export async function requestDetail(client:Awaited<ReturnType<typeof db>>,projectId:string,requestId:string){
 const request=checked(await client.from("automation_requests").select("*").eq("project_id",projectId).eq("id",requestId).maybeSingle());
 if(!request)throw new ApiError(404,"NOT_FOUND","Request unavailable.");
 const ids=Array.isArray(request.source_ids)?request.source_ids.filter((id:unknown)=>typeof id==="string"):[];
 const [messages,job,usage,refund,decision]=await Promise.all([
 ids.length?client.from("automation_messages").select("id,provider_guid,role,text,occurred_at").eq("project_id",projectId).in("id",ids).order("occurred_at"):Promise.resolve({data:[],error:null}),
 client.from("automation_jobs").select("id,analysis,model,prompt_version,error_code").eq("project_id",projectId).eq("id",request.job_id).maybeSingle(),
 client.from("automation_revision_uses").select("*").eq("project_id",projectId).eq("request_id",request.id).maybeSingle(),
 client.from("automation_revision_refunds").select("*").eq("project_id",projectId).eq("request_id",request.id).maybeSingle(),
 client.from("owner_decisions").select("id,status,reason,history,updated_at").eq("project_id",projectId).eq("automation_request_id",request.id).maybeSingle(),
 ]);
 return {request,messages:checked(messages),job:checked(job),usage:checked(usage),refund:checked(refund),decision:checked(decision)};
}
