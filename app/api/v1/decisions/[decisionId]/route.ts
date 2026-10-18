import { getDatabase } from "@/lib/db/postgres";
import { after } from "next/server";
import { runAutomationBatch } from "@/lib/assistant/run-batch";
import { z } from "zod";
import { api, checked, idempotency } from "@/lib/api";
import { readJson } from "@/lib/body";

export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ decisionId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).decisionId);
    const input = z
      .object({
        action: z.enum(["approve", "decline", "dismiss", "delete", "clarify"]),
        expectedUpdatedAt: z.iso.datetime({offset:true}),
        extraRevision: z.boolean().default(false),
        note: z.string().trim().max(2000).default(""),
        reply: z.string().trim().max(4000).default(""),
        taskTitle: z.string().trim().min(3).max(500).optional(),
      })
      .strict()
      .parse(await readJson(request));
    const result = checked(
      await client.rpc("owner_review_command", {
        p_decision: id,
        p_expected:input.expectedUpdatedAt,
        p_extra:input.extraRevision,
        p_action: input.action,
        p_note: input.note,
        p_reply: input.reply,
        p_key: idempotency(request),
        p_title: input.taskTitle ?? null,
      }),
    );
    after(async () => {
      const project = await getDatabase().query<{ project_id: string }>(
        "select project_id from owner_decisions where id=$1",
        [id],
      );
      if (project.rows[0]) await runAutomationBatch(project.rows[0].project_id);
    });
    return result;
  });
}
