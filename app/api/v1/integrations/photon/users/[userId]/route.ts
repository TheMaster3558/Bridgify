import { z } from "zod";
import { api, ApiError, checked } from "@/lib/api";
import { readJson } from "@/lib/body";
import { requirePhotonOwner } from "@/lib/photon/owner";
import { PhotonSetupError } from "@/lib/photon/spectrum";
import { deleteDraftPhotonUser } from "@/lib/db/delete-photon-user";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return api(request, async (client, owner) => {
    await requirePhotonOwner(client, owner.id);
    const userId = z.uuid().parse((await context.params).userId);
    const { projectId, phoneNumber } = z
      .object({
        projectId: z.uuid(),
        phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
      })
      .strict()
      .parse(await readJson(request));
    const project = checked(
      await client
        .from("projects")
        .select("id,status,activation_cutoff")
        .eq("id", projectId)
        .maybeSingle(),
    );
    if (!project)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Project unavailable to your account.",
      );
    if (project.status !== "draft" || project.activation_cutoff)
      throw new ApiError(
        409,
        "SETUP_LOCKED",
        "Delete Photon users from an unfinished project setup.",
      );
    try {
      return await deleteDraftPhotonUser(
        client,
        owner.id,
        projectId,
        userId,
        phoneNumber,
      );
    } catch (error) {
      if (error instanceof PhotonSetupError)
        throw new ApiError(422, "PHOTON_SETUP", error.message);
      throw error;
    }
  });
}
