import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, projectCommand } from "@/lib/api";
import { peopleSchema } from "@/lib/schemas/onboarding";
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const body = z
      .object({
        expectedVersion: z.number().int().positive(),
        people: peopleSchema,
      })
      .parse(await readJson(request));
    return projectCommand(
      request,
      z.uuid().parse((await context.params).projectId),
      "people",
      body.expectedVersion,
      body.people,
      client,
    );
  });
}
