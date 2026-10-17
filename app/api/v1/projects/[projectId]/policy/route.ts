import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, ApiError, projectCommand } from "@/lib/api";
import { policySchema } from "@/lib/schemas/onboarding";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, context: Context) {
  return api(request, async (client) => {
    const row = checked(
      await client
        .from("projects")
        .select("policy,policy_version")
        .eq("id", z.uuid().parse((await context.params).projectId))
        .maybeSingle(),
    );
    if (!row) throw new ApiError(404, "NOT_FOUND", "Project unavailable.");
    return row;
  });
}
export async function PUT(request: Request, context: Context) {
  return api(request, async (client) => {
    const body = z
      .object({
        expectedVersion: z.number().int().positive(),
        policy: policySchema,
      })
      .parse(await readJson(request));
    return projectCommand(
      request,
      z.uuid().parse((await context.params).projectId),
      "policy",
      body.expectedVersion,
      body.policy,
      client,
    );
  });
}
