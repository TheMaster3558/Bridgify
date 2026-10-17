import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, projectCommand } from "@/lib/api";
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const body = z
      .object({
        expectedVersion: z.number().int().positive(),
        disclosed: z.literal(true),
        mode: z.enum(["active", "review_only"]),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(await readJson(request));
    return projectCommand(
      request,
      z.uuid().parse((await context.params).projectId),
      "lifecycle",
      body.expectedVersion,
      { status: body.mode, disclosed: body.disclosed, reason: body.reason },
      client,
    );
  });
}
