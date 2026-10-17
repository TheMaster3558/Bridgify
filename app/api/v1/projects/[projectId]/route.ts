import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, idempotency } from "@/lib/api";
import { projectBundle } from "@/lib/db/project";
import { mutationSchema, sectionSchemas } from "@/lib/schemas/onboarding";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, context: Context) {
  return api(request, async (client) =>
    projectBundle(client, z.uuid().parse((await context.params).projectId)),
  );
}
export async function PATCH(request: Request, context: Context) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId),
      input = mutationSchema.parse(await readJson(request));
    return checked(
      await client.rpc("onboarding_command", {
        p_project: id,
        p_expected: input.expectedVersion,
        p_section: input.section,
        p_payload: sectionSchemas[input.section].parse(input.payload),
        p_key: idempotency(request),
      }),
    );
  });
}
