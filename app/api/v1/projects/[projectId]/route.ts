import { reviewedAgreementSchema } from "@/lib/schemas/agreement";
import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, idempotency } from "@/lib/api";
import { projectBundle } from "@/lib/db/project";
import { mutationSchema, sectionSchemas } from "@/lib/schemas/onboarding";
import { resolveProjectPeople } from "@/lib/photon/people";
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
    const payload =
      input.section === "people"
        ? await resolveProjectPeople(input.payload)
        : sectionSchemas[input.section].parse(input.payload);
    if (input.section === "scope")
      Object.assign(payload, {
        review: reviewedAgreementSchema.parse(
          (payload as { review?: unknown }).review,
        ),
      });
    return checked(
      await client.rpc("onboarding_command", {
        p_project: id,
        p_expected: input.expectedVersion,
        p_section: input.section,
        p_payload: payload,
        p_key: idempotency(request),
      }),
    );
  });
}
