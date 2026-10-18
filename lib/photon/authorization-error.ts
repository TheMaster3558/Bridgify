import { AuthenticationError } from "@photon-ai/advanced-imessage/grpc";

export type PhotonAuthorizationFailure =
  "target_not_allowed" | "authentication";

/** Only a typed authorization rejection proves the request was not accepted. */
export function photonAuthorizationFailure(
  error: unknown,
): PhotonAuthorizationFailure | null {
  if (!(error instanceof AuthenticationError)) return null;
  // The shared gateway currently prefixes its message but omits `source`.
  return error.message.includes("Target not allowed for this project")
    ? "target_not_allowed"
    : "authentication";
}

export const PHOTON_TARGET_NOT_ALLOWED =
  "Photon has not authorized access to this client's number for your project. Check the client's shared-line assignment in Photon. If they are already listed correctly, contact Photon support to check recipient authorization.";
export const PHOTON_AUTHENTICATION_FAILED =
  "Photon rejected project authorization. Check the server's Spectrum project ID and secret, then restart the server.";
