import "server-only";
import { ApiError } from "@/lib/api";
import { peopleSchema, peopleSelectionSchema } from "@/lib/schemas/onboarding";
import {
  PhotonSetupError,
  dmChatGuid,
  findPhotonUser,
  listPhotonUsers,
  readSpectrumCredentials,
  type PhotonUser,
} from "./spectrum";

export async function resolveProjectPeople(input: unknown) {
  const { photon_user_id } = peopleSelectionSchema.parse(input);
  try {
    const { projectId } = readSpectrumCredentials();
    const user = await findPhotonUser(photon_user_id);
    return peopleSchema.parse({
      channel: "photon_shared",
      photon_user_id: user.id,
      client_name: user.name,
      client_email: user.email,
      client_sender_id: user.phoneNumber,
      agent_number: user.assignedPhoneNumber,
      instance_id: projectId,
      chat_guid: dmChatGuid(user.phoneNumber),
    });
  } catch (error) {
    if (error instanceof PhotonSetupError)
      throw new ApiError(422, "PHOTON_SETUP", error.message);
    throw error;
  }
}

export type PhotonUsersResult =
  | { ok: true; users: PhotonUser[] }
  | { ok: false; message: string };

export async function loadPhotonUsers(): Promise<PhotonUsersResult> {
  try {
    return { ok: true, users: await listPhotonUsers() };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof PhotonSetupError
          ? error.message
          : "Photon users could not be loaded. Refresh to try again.",
    };
  }
}
