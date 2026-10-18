import { z } from "zod";
import { api, checked, idempotency } from "@/lib/api";
import { readJson } from "@/lib/body";

export async function POST(
  request: Request,
  context: { params: Promise<{ decisionId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).decisionId);
    const input = z
      .object({
        action: z.enum(["approve", "decline", "dismiss", "delete"]),
        note: z.string().trim().max(2000).default(""),
        reply: z.string().trim().max(4000).default(""),
        taskTitle: z.string().trim().min(3).max(500).optional(),
      })
      .strict()
      .parse(await readJson(request));
    return checked(
      await client.rpc("resolve_automation_review", {
        p_decision: id,
        p_action: input.action,
        p_note: input.note,
        p_reply: input.reply,
        p_key: idempotency(request),
        p_task_title: input.taskTitle ?? null,
      }),
    );
  });
}
