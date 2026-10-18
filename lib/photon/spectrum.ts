import "server-only";
import { Spectrum } from "@spectrum-ts/core";
import { imessage } from "@spectrum-ts/imessage";
import { z } from "zod";

const SPECTRUM_API = "https://spectrum.photon.codes";

export type PhotonUser = {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string;
  assignedPhoneNumber: string | null;
};

export class PhotonSetupError extends Error {}

const userSchema = z
  .object({
    id: z.string().min(1).max(200),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    email: z.string().nullish(),
    phoneNumber: z.string().nullish(),
    assignedPhoneNumber: z.string().nullish(),
  })
  .passthrough();
const usersResponseSchema = z.object({
  data: z.object({ users: z.array(userSchema) }).passthrough(),
});

export function readSpectrumCredentials(env: Record<string, string | undefined> = process.env) {
  const projectId = env.SPECTRUM_PROJECT_ID?.trim(),
    projectSecret = env.SPECTRUM_PROJECT_SECRET?.trim();
  if (!projectId || !projectSecret)
    throw new PhotonSetupError(
      "Add SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET from your Photon project Settings to the server environment, then restart.",
    );
  return { projectId, projectSecret };
}

/** Shared-pool DMs have a deterministic chat ID derived from the user's address. */
export const dmChatGuid = (address: string) => `any;-;${address}`;

export async function listPhotonUsers(): Promise<PhotonUser[]> {
  const { projectId, projectSecret } = readSpectrumCredentials();
  let response: Response;
  try {
    response = await fetch(
      `${SPECTRUM_API}/projects/${encodeURIComponent(projectId)}/users?limit=500`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString("base64")}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    throw new PhotonSetupError("Photon could not be reached. Check your connection and refresh.");
  }
  if (response.status === 401)
    throw new PhotonSetupError("Photon rejected the project ID or secret. Copy them again from Photon project Settings.");
  if (!response.ok)
    throw new PhotonSetupError("Photon could not return your users right now. Refresh to try again.");
  const parsed = usersResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new PhotonSetupError("Photon returned an unexpected users list.");
  return parsed.data.data.users
    .filter((u) => u.phoneNumber?.trim())
    .map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter((part) => part?.trim()).join(" ") || u.phoneNumber!.trim(),
      email: u.email?.trim() || null,
      phoneNumber: u.phoneNumber!.trim(),
      assignedPhoneNumber: u.assignedPhoneNumber?.trim() || null,
    }));
}

export async function findPhotonUser(id: string) {
  const user = (await listPhotonUsers()).find((u) => u.id === id);
  if (!user)
    throw new PhotonSetupError("That person is no longer on your Photon Users page. Refresh and choose again.");
  return user;
}

export type PhotonSendResult =
  | { state: "sent"; messageId: string }
  | { state: "failed" }
  | { state: "unknown" };

/**
 * Sends one text to a user's DM on the project's shared line. Message streams
 * are never subscribed, so this does not compete with a running listener.
 * Failures before the send call are "failed"; anything after may have been
 * accepted by Photon and is "unknown".
 */
export async function sendPhotonText(address: string, text: string): Promise<PhotonSendResult> {
  let app: Awaited<ReturnType<typeof Spectrum>>;
  let space: { send(text: string): Promise<unknown> };
  try {
    app = await Spectrum({
      ...readSpectrumCredentials(),
      providers: [imessage.config()],
      options: { logLevel: "error" },
      telemetry: false,
    });
  } catch {
    return { state: "failed" };
  }
  try {
    try {
      space = await imessage(app).space.create(address);
    } catch {
      return { state: "failed" };
    }
    try {
      const sent = (await space.send(text)) as { id?: string } | undefined;
      return sent?.id ? { state: "sent", messageId: sent.id } : { state: "unknown" };
    } catch {
      return { state: "unknown" };
    }
  } finally {
    await app.stop().catch(() => undefined);
  }
}
