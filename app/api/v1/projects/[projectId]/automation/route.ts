import { after } from "next/server";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
import { readJson } from "@/lib/body";
import { adminDb } from "@/lib/db/admin";
import { policySchema, peopleSchema } from "@/lib/schemas/onboarding";
import { readPhotonHistory } from "@/lib/photon/message-history";
import { runAutomationBatch } from "@/lib/assistant/run-batch";
export const maxDuration = 60;
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, context: Context) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId);
    const project = checked(
      await client.from("projects").select("*").eq("id", id).maybeSingle(),
    );
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project unavailable.");
    const q = new URL(request.url).searchParams.get("q")?.slice(0, 100) ?? "";
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get("page") || 0);
    const tables = [
      "automation_outbox",
      "automation_jobs",
      "automation_requests",
      "automation_rounds",
      "automation_runtime_health",
    ] as const;
    const values = await Promise.all(
      tables.map((t) => {
        let query = client
          .from(t)
          .select("*")
          .eq("project_id", id)
          .order(
            t === "automation_runtime_health" ? "started_at" : "created_at",
            { ascending: false },
          );
        if (t === "automation_requests" && q)
          query = query.ilike("summary", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
        const offset = [
          "automation_outbox",
          "automation_jobs",
          "automation_requests",
          "automation_rounds",
        ].includes(t)
          ? page * 100
          : 0;
        return query.range(offset, offset + 99);
      }),
    );
    const tasks = checked(
      await client
        .from("project_tasks")
        .select("id,title,status,updated_at,value")
        .eq("project_id", id)
        .ilike("title", `%${q.replace(/[\\%_]/g, "\\$&")}%`)
        .order("updated_at", { ascending: false })
        .limit(50),
    );
    const scope=checked(await client.from("scope_versions").select("*").eq("project_id",id).eq("version",project.scope_version));
    const accounting = checked(
      await client.rpc("automation_accounting", { p_project: id }),
    );
    const requests=checked(values[tables.indexOf("automation_requests")])??[];
    const rounds=checked(values[tables.indexOf("automation_rounds")])??[];
    const annotations=checked(await client.rpc("automation_history_annotations",{p_project:id,p_requests:requests.map((r:{id:string})=>r.id),p_rounds:rounds.map((r:{id:string})=>r.id)}));
    const roundPage=annotations.openRound&&!rounds.some((r:{id:string})=>r.id===annotations.openRound.id)?[annotations.openRound,...rounds]:rounds;
    return {
      project,
      page,
      tasks,
      accounting,
      scope,
      fetchedAt: new Date().toISOString(),
      ...Object.fromEntries(tables.map((t, i) => [t, checked(values[i])])),
      automation_rounds:roundPage,roundCounts:annotations.roundCounts,
      automation_round_members:annotations.members,automation_revision_refunds:annotations.requestRefunds,automation_round_refunds:annotations.roundRefunds,
    };
  });
}
export async function POST(request: Request, context: Context) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId);
    const input = z
      .object({
        action: z.enum([
          "outbox_edit",
          "outbox_cancel",
          "outbox_retry",
          "outbox_reconcile",
          "retry_analysis",
          "apply_task_change",
          "refund_request",
          "round_open",
          "round_add",
          "round_close",
          "round_refund",
          "amend_policy",
        ]),
        payload: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(await readJson(request));
    const project = checked(
      await client
        .from("projects")
        .select("id,people")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!project) throw new ApiError(404, "NOT_FOUND", "Project unavailable.");
    if (input.action === "outbox_reconcile") {
      const payload = z
        .object({ id: z.uuid(), providerMessageId: z.string().min(1).max(256) })
        .strict()
        .parse(input.payload);
      const outbox = checked(
        await client
          .from("automation_outbox")
          .select("id")
          .eq("id", payload.id)
          .eq("project_id", id)
          .maybeSingle(),
      );
      if (!outbox) throw new ApiError(404, "NOT_FOUND", "Reply unavailable.");
      const p = peopleSchema.parse(project.people);
      const connection = {
        projectId: id,
        instanceId: p.instance_id,
        userId: p.photon_user_id,
        address: p.client_sender_id,
        agentAddress: p.agent_number,
        chatGuid: p.chat_guid,
      };
      const history = await readPhotonHistory(
        connection,
        undefined,
        payload.providerMessageId,
      );
      const receipt = history.messages.find(
        (m) =>
          m.id === payload.providerMessageId &&
          m.direction === "outbound" &&
          !m.deleted &&
          ["sent", "delivered", "read"].includes(m.delivery ?? ""),
      );
      if (!receipt?.text)
        throw new ApiError(
          422,
          "NO_RECEIPT",
          "Photon did not return a successful outbound receipt in this conversation.",
        );
      checked(
        await adminDb().rpc("reconcile_automation_reply", {
          p_id: payload.id,
          p_guid: receipt.id,
          p_text: receipt.text,
          p_at: receipt.sentAt,
          p_instance: p.instance_id,
          p_chat: p.chat_guid,
        }),
      );
      return { reconciled: true };
    }
    if (input.action === "amend_policy")
      input.payload.policy = policySchema.parse(input.payload.policy);
    const result = checked(
      await client.rpc("automation_owner_command", {
        p_project: id,
        p_action: input.action,
        p_payload: input.payload,
        p_key: idempotency(request),
      }),
    );
    after(() => runAutomationBatch(id));
    return result;
  });
}
