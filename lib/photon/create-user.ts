import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import {
  photonUserInputSchema,
  type PhotonUserInput,
} from "@/lib/schemas/photon-user";
import {
  listPhotonUsers,
  readSpectrumCredentials,
  type PhotonUser,
} from "./spectrum";

// Verified against the deployed Stable Spectrum OpenAPI, /projects/{projectId}/users/ POST.
// Creation is idempotent on (project, shared user phone). No invite or message is sent.
const createdUserSchema = z.object({
  succeed: z.literal(true),
  data: z.object({
    id: z.string().min(1).max(200),
    projectId: z.string().min(1),
    type: z.literal("shared"),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string().nullable(),
    phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
    assignedPhoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
  }),
});
export async function createPhotonUser(
  input: PhotonUserInput,
): Promise<{ user: PhotonUser; existing: boolean }> {
  const fields = photonUserInputSchema.parse(input);
  const { projectId, projectSecret } = readSpectrumCredentials();
  // Selecting an existing user must not silently overwrite their provider profile.
  const existing = (await listPhotonUsers()).find(
    (user) => user.phoneNumber === fields.phoneNumber,
  );
  if (existing) return { user: existing, existing: true };
  let response: Response | undefined;
  try {
    response = await fetch(
      `https://spectrum.photon.codes/projects/${encodeURIComponent(projectId)}/users/`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "shared", ...fields }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (response.ok) {
      const parsed = createdUserSchema.safeParse(await response.json());
      if (
        parsed.success &&
        parsed.data.data.projectId === projectId &&
        parsed.data.data.phoneNumber === fields.phoneNumber
      ) {
        const user = parsed.data.data;
        return {
          existing: false,
          user: {
            id: user.id,
            name:
              [user.firstName, user.lastName]
                .filter((part) => part?.trim())
                .join(" ") || user.phoneNumber,
            email: user.email,
            phoneNumber: user.phoneNumber,
            assignedPhoneNumber: user.assignedPhoneNumber,
          },
        };
      }
    }
  } catch {
    /* A timeout or unreadable response may still have created the user. */
  }
  // Reconcile once, including provider duplicate responses. Repeating the same phone is safe.
  const recovered = await listPhotonUsers()
    .then((users) =>
      users.find((user) => user.phoneNumber === fields.phoneNumber),
    )
    .catch(() => undefined);
  if (recovered) return { user: recovered, existing: true };
  if (response?.status === 401)
    throw new ApiError(
      422,
      "PHOTON_SETUP",
      "Photon rejected the project credentials. Check the server's Photon project settings.",
    );
  if (response && [400, 402, 403, 404, 409, 422].includes(response.status))
    throw new ApiError(
      422,
      "PHOTON_USER_REJECTED",
      "Photon could not add this user. Check the contact details, project permissions and available user slots, then try again.",
    );
  if (response?.status === 429)
    throw new ApiError(
      503,
      "PHOTON_RATE_LIMIT",
      "Photon is receiving too many requests. Wait briefly and retry with the same phone number.",
    );
  throw new ApiError(
    503,
    "PHOTON_USER_UNCONFIRMED",
    "Photon did not confirm user creation. Refresh the users list or retry with the same phone number.",
  );
}
