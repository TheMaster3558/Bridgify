import { z } from "zod";
import { api, checked } from "@/lib/api";
import { readJson } from "@/lib/body";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).taskId);
    const input = z
      .object({
        status: z.enum([
          "ready",
          "in_progress",
          "blocked",
          "done",
          "cancelled",
        ]),
        expectedUpdatedAt: z.iso.datetime({ offset: true }),
        note: z.string().trim().max(2000),
      })
      .strict()
      .parse(await readJson(request));
    return checked(
      await client.rpc("automation_task_status", {
        p_task: id,
        p_status: input.status,
        p_expected: input.expectedUpdatedAt,
        p_note: input.note,
      }),
    );
  });
}
