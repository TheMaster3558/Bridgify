import { after } from "next/server";
import { runAutomationBatch } from "@/lib/assistant/run-batch";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
import { taskDetailsSchema } from "@/lib/tasks/schema";
import { readJson } from "@/lib/body";

export const maxDuration = 60;
export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).taskId);
    const input = z.discriminatedUnion("action", [
      z.object({action:z.literal("edit"),expectedUpdatedAt:z.iso.datetime({offset:true}),details:taskDetailsSchema}).strict(),
      z.object({action:z.literal("status"),status:z.enum(["ready","in_progress","blocked","done","cancelled"]),expectedUpdatedAt:z.iso.datetime({offset:true}),note:z.string().trim().max(2000)}).strict(),
    ]).parse({action:"status",...await readJson(request) as object});
    const task=checked(await client.from("project_tasks").select("project_id").eq("id",id).maybeSingle());
    if(!task) throw new ApiError(404,"NOT_FOUND","Task unavailable.");
    const result=checked(await client.rpc("owner_task_command",{
      p_project:task.project_id,p_task:id,p_expected:input.expectedUpdatedAt,p_action:input.action,
      p_payload:input.action==="edit"?input.details:{status:input.status,note:input.note},p_key:idempotency(request),
    }));
    after(() => runAutomationBatch(result.project_id));
    return result;
  });
}
