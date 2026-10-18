import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { listPhotonUsers, readSpectrumCredentials } from "./spectrum";
const deletedSchema = z.object({
  succeed: z.literal(true),
  data: z.object({ userId: z.string().min(1) }),
});
// Stable Spectrum OpenAPI: DELETE soft-deletes this exact project-scoped UUID.
export async function deletePhotonUser(userId: string) {
  z.uuid().parse(userId);
  const { projectId, projectSecret } = readSpectrumCredentials();
  let response: Response | undefined;
  try {
    response = await fetch(
      `https://spectrum.photon.codes/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(userId)}/`,
      {
        method: "DELETE",
        headers: {
          authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString("base64")}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.ok) {
      const parsed = deletedSchema.safeParse(await response.json());
      if (parsed.success && parsed.data.data.userId === userId) return;
    }
  } catch {
    /* A lost response may still have deleted the provider user. */
  }
  // Never treat a transport error or a 404 by itself as confirmed deletion.
  const users = await listPhotonUsers().catch(() => null);
  if (users && !users.some((user) => user.id === userId)) return;
  if (response?.status === 401)
    throw new ApiError(
      422,
      "PHOTON_SETUP",
      "Photon rejected the project credentials. Correct the server configuration and retry deletion.",
    );
  if (response && [400, 402, 403, 409, 422].includes(response.status))
    throw new ApiError(
      422,
      "PHOTON_DELETE_REJECTED",
      "Photon could not delete this user. Check the project permissions and retry deletion.",
    );
  throw new ApiError(
    503,
    "PHOTON_DELETE_UNCONFIRMED",
    "Photon did not confirm deletion. Refresh the users list or retry. This user remains reserved for deletion until its status is resolved.",
  );
}
