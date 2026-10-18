import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  type Message,
} from "@photon-ai/advanced-imessage/grpc";
const f = vi.hoisted(() => ({
  tokens: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  close: vi.fn(),
  user: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@spectrum-ts/core", () => ({
  cloud: { issueImessageTokens: f.tokens },
}));
vi.mock("@photon-ai/advanced-imessage/grpc", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@photon-ai/advanced-imessage/grpc")
  >()),
  createClient: f.create,
}));
vi.mock("@/lib/photon/spectrum", () => ({
  readSpectrumCredentials: () => ({
    projectId: "spectrum-project",
    projectSecret: process.env.TEST_CURSOR_SECRET!,
  }),
  dmChatGuid: (address: string) => `any;-;${address}`,
  findPhotonUser: f.user,
}));
import {
  connectionKey,
  decodeHistoryCursor,
  encodeHistoryCursor,
  normalizeHistoryMessage,
  readPhotonHistory,
  type ChatConnection,
} from "../../lib/photon/message-history";
const connection: ChatConnection = {
  projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  instanceId: "spectrum-project",
  userId: "photon-client",
  address: "+14155550100",
  agentAddress: "+14155550200",
  chatGuid: "any;-;+14155550100",
};
function message(patch: Partial<Message> = {}): Message {
  return {
    guid: "provider-message",
    chatGuids: [connection.chatGuid],
    isFromMe: false,
    dateCreated: new Date("2026-10-17T20:00:00Z"),
    sender: { address: connection.address },
    content: { text: "Client request", attachments: [] },
    isSent: true,
    isDelivered: true,
    sendErrorCode: 0,
    ...patch,
  } as Message;
}
beforeEach(() => {
  vi.stubEnv("TEST_CURSOR_SECRET", crypto.randomUUID());
  f.tokens.mockResolvedValue({
    type: "shared",
    token: "private-provider-token",
    expiresIn: 300,
  });
  f.user.mockResolvedValue({
    phoneNumber: connection.address,
    assignedPhoneNumber: connection.agentAddress,
  });
  f.create.mockReturnValue({
    messages: { listInChat: f.list },
    close: f.close,
  });
  f.close.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
describe("Photon project history", () => {
  it("loads existing inbound and outbound messages from the exact linked chat without sending", async () => {
    f.list.mockResolvedValue({
      messages: [
        message(),
        message({
          guid: "agent-reply",
          isFromMe: true,
          sender: undefined,
          dateRead: new Date(),
        }),
      ],
      nextPageToken: "opaque-provider-token",
    });
    const result = await readPhotonHistory(connection);
    expect(f.list).toHaveBeenCalledWith(connection.chatGuid, { pageSize: 50 });
    expect(result.messages.map((m) => m.sender)).toEqual(["client", "agent"]);
    expect(result.messages[1].delivery).toBe("read");
    expect(result.nextCursor).toBeTruthy();
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("private-provider-token");
  });
  it("binds signed pagination to the project and exact client connection", () => {
    const cursor = encodeHistoryCursor(connection, "opaque-token", "secret");
    expect(decodeHistoryCursor(connection, cursor, "secret")).toBe(
      "opaque-token",
    );
    for (const altered of [
      { ...connection, projectId: crypto.randomUUID() },
      { ...connection, userId: "another-client" },
      { ...connection, agentAddress: "another-line" },
    ])
      expect(() => decodeHistoryCursor(altered, cursor, "secret")).toThrow(
        /different connection/,
      );
    expect(() =>
      decodeHistoryCursor(connection, cursor + "x", "secret"),
    ).toThrow();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3600001);
    expect(() => decodeHistoryCursor(connection, cursor, "secret")).toThrow();
    vi.useRealTimers();
    expect(connectionKey(connection)).not.toContain(connection.address);
  });
  it("rejects tampered cursors and mismatched provider bindings before reading messages", async () => {
    await expect(
      readPhotonHistory(connection, "bad-cursor"),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.list).not.toHaveBeenCalled();
    expect(f.user).not.toHaveBeenCalled();
    await expect(
      readPhotonHistory({ ...connection, instanceId: "another-project" }),
    ).rejects.toMatchObject({ status: 422 });
    expect(f.list).not.toHaveBeenCalled();
    f.user.mockResolvedValue({
      phoneNumber: "different-client",
      assignedPhoneNumber: connection.agentAddress,
    });
    await expect(readPhotonHistory(connection)).rejects.toMatchObject({
      status: 422,
    });
    expect(f.list).not.toHaveBeenCalled();
  });
  it("excludes unrelated chat/sender rows and preserves deletion, edit and attachment metadata", () => {
    expect(
      normalizeHistoryMessage(
        message({ chatGuids: ["another-chat"] }),
        connection,
      ),
    ).toBeNull();
    expect(
      normalizeHistoryMessage(
        message({ sender: { address: "unknown" } as Message["sender"] }),
        connection,
      ),
    ).toBeNull();
    const deleted = normalizeHistoryMessage(
      message({ dateRetracted: new Date() }),
      connection,
    );
    expect(deleted?.text).toBeNull();
    expect(deleted?.deleted).toBe(true);
    const edited = normalizeHistoryMessage(
      message({ dateEdited: new Date("2026-10-17T20:01:00Z") }),
      connection,
    );
    expect(edited?.editedAt).toBeTruthy();
  });
  it("closes the connection after provider failure and never exposes raw private errors", async () => {
    f.list.mockRejectedValue(new Error("private message and token"));
    const result = readPhotonHistory(connection);
    await expect(result).rejects.toMatchObject({
      status: 503,
      code: "PHOTON_HISTORY",
    });
    await expect(result).rejects.not.toThrow(/private message/);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("explains a registered client's recipient authorization rejection without leaking provider details", async () => {
    f.list.mockRejectedValue(
      new AuthenticationError(
        "[spectrum-imessage] Target not allowed for this project; private-provider-token",
        { code: "internalError", grpcCode: 7, retryable: false },
      ),
    );
    const result = readPhotonHistory(connection);
    await expect(result).rejects.toMatchObject({
      status: 422,
      code: "PHOTON_TARGET_NOT_ALLOWED",
    });
    await expect(result).rejects.toThrow(/shared-line assignment/);
    await expect(result).rejects.not.toThrow(/private-provider-token/);
    expect(f.close).toHaveBeenCalledTimes(1);
  });
});
