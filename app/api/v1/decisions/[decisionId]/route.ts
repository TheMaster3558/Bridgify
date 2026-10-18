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
        action: z.enum(["approve", "decline", "dismiss"]),
        note: z.string().trim().min(3).max(2000),
        reply: z.string().trim().max(4000),
      })
      .strict()
      .parse(await readJson(request));
    return checked(
      await client.rpc("automation_review_command", {
        p_decision: id,
        p_action: input.action,
        p_note: input.note,
        p_reply: input.reply,
        p_key: idempotency(request),
      }),
    );
  });
}
