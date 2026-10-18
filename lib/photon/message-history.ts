import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cloud, type SharedTokenData } from "@spectrum-ts/core";
import { createClient, type Message } from "@photon-ai/advanced-imessage/grpc";
import { z } from "zod";
import { ApiError } from "../api";
import {
  dmChatGuid,
  findPhotonUser,
  readSpectrumCredentials,
} from "./spectrum";
import type { ProjectChatMessage } from "./history-contract";

export type ChatConnection = {
  projectId: string;
  instanceId: string;
  userId: string;
  address: string;
  agentAddress: string | null;
  chatGuid: string;
};
export function connectionKey(connection: ChatConnection) {
  return createHash("sha256").update(JSON.stringify(connection)).digest("hex");
}
const cursorSchema = z
  .object({
    projectId: z.uuid(),
    connection: z.string().length(64),
    token: z.string().min(1).max(8000),
    expires: z.number().int(),
  })
  .strict();
export function encodeHistoryCursor(
  connection: ChatConnection,
  token: string,
  secret: string,
) {
  const encoded = Buffer.from(
    JSON.stringify({
      projectId: connection.projectId,
      connection: connectionKey(connection),
      token,
      expires: Date.now() + 3600000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`bridgify:history:v1:${encoded}`)
    .digest("base64url");
  return `${encoded}.${signature}`;
}
export function decodeHistoryCursor(
  connection: ChatConnection,
  cursor: string | undefined,
  secret: string,
) {
  if (!cursor) return undefined;
  try {
    if (cursor.length > 12000) throw new Error();
    const [encoded, signature, extra] = cursor.split(".");
    if (!encoded || !signature || extra) throw new Error();
    const expected = createHmac("sha256", secret)
      .update(`bridgify:history:v1:${encoded}`)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const parsed = cursorSchema.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    if (
      parsed.projectId !== connection.projectId ||
      parsed.connection !== connectionKey(connection) ||
      parsed.expires <= Date.now()
    )
      throw new Error();
    return parsed.token;
  } catch {
    throw new ApiError(
      400,
      "INVALID_CURSOR",
      "This history page expired or belongs to a different connection. Refresh the latest messages.",
    );
  }
}
export function normalizeHistoryMessage(
  message: Message,
  connection: ChatConnection,
): ProjectChatMessage | null {
  // The gateway is shared. Never show rows returned for a different chat or sender.
  if (
    !message.chatGuids.includes(connection.chatGuid) ||
    !message.guid ||
    !Number.isFinite(message.dateCreated.getTime())
  )
    return null;
  const address = message.sender?.address?.trim().toLowerCase();
  if (
    !message.isFromMe &&
    address &&
    address !== connection.address.trim().toLowerCase()
  )
    return null;
  const deleted = !!message.dateRetracted;
  return {
    id: message.guid,
    direction: message.isFromMe ? "outbound" : "inbound",
    sender: message.isFromMe ? "agent" : address ? "client" : "unknown",
    text: deleted ? null : message.content.text || null,
    sentAt: message.dateCreated.toISOString(),
    editedAt:
      message.dateEdited && Number.isFinite(message.dateEdited.getTime())
        ? message.dateEdited.toISOString()
        : null,
    deleted,
    delivery: !message.isFromMe
      ? null
      : message.sendErrorCode
        ? "failed"
        : message.dateRead
          ? "read"
          : message.isDelivered
            ? "delivered"
            : message.isSent
              ? "sent"
              : "pending",
    attachments: deleted
      ? []
      : message.content.attachments
          .filter((a) => !a.isHidden)
          .map((a) => ({
            name: a.fileName || "Attachment",
            mimeType: a.mimeType,
          })),
  };
}
let tokenCache: { key: string; token: string; until: number } | undefined;
async function sharedToken(projectId: string, projectSecret: string) {
  const key = createHash("sha256")
    .update(`${projectId}:${projectSecret}`)
    .digest("hex");
  if (tokenCache?.key === key && tokenCache.until > Date.now())
    return tokenCache.token;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await Promise.race([
      cloud.issueImessageTokens(projectId, projectSecret),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("token_timeout")), 8000);
      }),
    ]);
    if (token.type !== "shared")
      throw new ApiError(
        422,
        "PHOTON_CONNECTION",
        "Reconnect this project's client using the Photon Users picker.",
      );
    const shared = token as SharedTokenData;
    tokenCache = {
      key,
      token: shared.token,
      until: Date.now() + Math.max(0, shared.expiresIn - 60) * 1000,
    };
    return shared.token;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function readPhotonHistory(
  connection: ChatConnection,
  cursor?: string,
) {
  let credentials: ReturnType<typeof readSpectrumCredentials>;
  try {
    credentials = readSpectrumCredentials();
  } catch {
    throw new ApiError(
      503,
      "PHOTON_SETUP",
      "Configure the Photon Spectrum project ID and secret on the server to load iMessage history.",
    );
  }
  if (
    credentials.projectId !== connection.instanceId ||
    connection.chatGuid !== dmChatGuid(connection.address)
  )
    throw new ApiError(
      422,
      "PHOTON_CONNECTION",
      "This client connection no longer matches the configured Photon project. Reconnect the client in People & chat.",
    );
  const pageToken = decodeHistoryCursor(
    connection,
    cursor,
    credentials.projectSecret,
  );
  try {
    const user = await findPhotonUser(connection.userId);
    if (
      user.phoneNumber !== connection.address ||
      user.assignedPhoneNumber !== connection.agentAddress
    )
      throw new ApiError(
        422,
        "PHOTON_CONNECTION",
        "The client's Photon address or assigned agent changed. Reconnect them in People & chat.",
      );
    const token = await sharedToken(
      credentials.projectId,
      credentials.projectSecret,
    );
    // Same verified shared gateway and project token used by the installed iMessage provider.
    const client = createClient({
      address:
        process.env.SPECTRUM_IMESSAGE_ADDRESS ||
        "imessage.spectrum.photon.codes:443",
      token,
      timeout: 8000,
      retry: false,
      tls: true,
    });
    try {
      const page = await client.messages.listInChat(connection.chatGuid, {
        pageSize: 50,
        ...(pageToken ? { pageToken } : {}),
      });
      const messages = page.messages
        .map((m) => normalizeHistoryMessage(m, connection))
        .filter((m): m is ProjectChatMessage => m !== null);
      return {
        messages,
        nextCursor: page.nextPageToken
          ? encodeHistoryCursor(
              connection,
              page.nextPageToken,
              credentials.projectSecret,
            )
          : null,
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Do not expose SDK exceptions, tokens, phone numbers or message bodies in logs/errors.
    throw new ApiError(
      503,
      "PHOTON_HISTORY",
      "Photon message history could not be loaded. Check the connection and try Refresh.",
    );
  }
}
