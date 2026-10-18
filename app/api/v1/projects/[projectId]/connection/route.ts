import { z } from "zod";
import { api,checked,idempotency,ApiError } from "@/lib/api";
import { readJson } from "@/lib/body";
import { adminDb } from "@/lib/db/admin";
import { peopleSchema } from "@/lib/schemas/onboarding";
import { readPhotonHistory } from "@/lib/photon/message-history";
import { findPhotonUser,readSpectrumCredentials } from "@/lib/photon/spectrum";
export async function POST(request:Request,context:{params:Promise<{projectId:string}>}){
 return api(request,async(client,user)=>{
 const id=z.uuid().parse((await context.params).projectId);
 const input=z.discriminatedUnion("action",[
 z.object({action:z.literal("retry"),expectedVersion:z.number().int().positive(),confirmedNotDelivered:z.literal(true),reason:z.string().trim().min(3).max(1000)}).strict(),
 z.object({action:z.literal("verify"),expectedVersion:z.number().int().positive(),providerMessageId:z.string().min(1).max(256),disclosed:z.literal(true)}).strict(),
 ]).parse(await readJson(request));
 if(input.action==="retry")return checked(await client.rpc("reset_chat_verification",{p_project:id,p_expected:input.expectedVersion,p_confirmed:input.confirmedNotDelivered,p_reason:input.reason,p_key:idempotency(request)}));
 const project=checked(await client.from("projects").select("id,people,status,version").eq("id",id).maybeSingle());if(!project)throw new ApiError(404,"NOT_FOUND","Project unavailable.");
 const p=peopleSchema.parse(project.people);const person=await findPhotonUser(p.photon_user_id);
 if(person.phoneNumber!==p.client_sender_id||person.assignedPhoneNumber!==p.agent_number||readSpectrumCredentials().projectId!==p.instance_id)throw new ApiError(422,"IDENTITY_CHANGED","Saved Photon identity changed. Keep the project paused and review the connection.");
 const history=await readPhotonHistory({projectId:id,instanceId:p.instance_id,userId:p.photon_user_id,address:p.client_sender_id,agentAddress:p.agent_number,chatGuid:p.chat_guid},undefined,input.providerMessageId);
 const receipt=history.messages.find(m=>m.id===input.providerMessageId&&m.direction==="outbound"&&!m.deleted&&!m.editedAt&&["sent","delivered","read"].includes(m.delivery??""));
 if(!receipt?.text)throw new ApiError(422,"NO_RECEIPT","No successful, unedited introduction receipt was found in this conversation.");
 checked(await adminDb().rpc("confirm_chat_receipt",{p_project:id,p_expected:input.expectedVersion,p_actor:user.id,p_guid:receipt.id,p_text:receipt.text,p_at:receipt.sentAt,p_instance:p.instance_id,p_chat:p.chat_guid}));return {verified:true};
 });
}
