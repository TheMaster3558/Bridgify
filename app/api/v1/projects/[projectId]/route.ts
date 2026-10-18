import { adminDb } from "@/lib/db/admin";
import { cleanupDeletedProject } from "@/lib/db/project-deletion";
import { reviewedAgreementSchema } from "@/lib/schemas/agreement";
import { readJson } from "@/lib/body";
import { z } from "zod";
import { api, checked, idempotency, ApiError } from "@/lib/api";
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

export async function DELETE(request: Request, context: Context) {
  return api(request, async (client) => {
    const id = z.uuid().parse((await context.params).projectId);
    const { name } = z
      .object({ name: z.string().min(1).max(120) })
      .strict()
      .parse(await readJson(request));
    const result = await client.rpc("delete_project", {
      p_project: id,
      p_name: name,
    });
    if (result.error?.code === "PGRST202")
      throw new ApiError(
        503,
        "MIGRATION_REQUIRED",
        "Apply migration 202610170010_delete_projects.sql before deleting projects.",
      );
    const deleted = checked(result);
    let pending = true;
    try {
      pending = (await cleanupDeletedProject(adminDb(), id)).pending;
    } catch {
      /* durable receipt remains for the cleanup worker */
    }
    return { ...deleted, storageCleanupPending: pending };
  });
}
