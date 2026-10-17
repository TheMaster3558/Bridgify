import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, idempotency } from "@/lib/api";
import { invitationSchema } from "@/lib/schemas/onboarding";
export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  return api(request, async (client) => {
    const body = z
      .object({
        expectedVersion: z.number().int().positive(),
        invitation: invitationSchema,
      })
      .parse(await readJson(request));
    const result = checked(
      await client.rpc("onboarding_command", {
        p_project: z.uuid().parse((await context.params).projectId),
        p_expected: body.expectedVersion,
        p_section: "invite",
        p_payload: body.invitation,
        p_key: idempotency(request),
      }),
    );
    return {
      ...result,
      invitationUrl: `${process.env.APP_BASE_URL}/invitations/${result.invitationToken}`,
    };
  });
}
