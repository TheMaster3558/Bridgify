import { requirePhotonOwner } from "@/lib/photon/owner";
import { readJson } from "@/lib/body";
import { addPhotonUserRequestSchema } from "@/lib/schemas/photon-user";
import { createPhotonUser } from "@/lib/photon/create-user";
import { PhotonSetupError } from "@/lib/photon/spectrum";
import { api, ApiError, checked } from "@/lib/api";
import { loadPhotonUsers } from "@/lib/photon/people";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  return api(request, async (client, user) => {
    await requirePhotonOwner(client, user.id);
    return loadPhotonUsers();
  });
}
export async function POST(request: Request) {
  return api(request, async (client, user) => {
    await requirePhotonOwner(client, user.id);
    const { projectId, ...fields } = addPhotonUserRequestSchema.parse(
      await readJson(request),
    );
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
        "This project's setup is closed. Add clients while creating a draft project.",
      );
    try {
      return await createPhotonUser(fields);
    } catch (error) {
      if (error instanceof PhotonSetupError)
        throw new ApiError(422, "PHOTON_SETUP", error.message);
      throw error;
    }
  });
}
