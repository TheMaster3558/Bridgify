import { z } from "zod";
import { api, checked, idempotency } from "@/lib/api";
import { readJson } from "@/lib/body";
import { taskDetailsSchema } from "@/lib/tasks/schema";
export async function POST(request:Request,context:{params:Promise<{projectId:string}>}) {
 return api(request,async client => checked(await client.rpc("owner_task_command",{
 p_project:z.uuid().parse((await context.params).projectId),p_task:null,p_expected:null,p_action:"create",p_payload:taskDetailsSchema.parse(await readJson(request)),p_key:idempotency(request)
 })));
}
