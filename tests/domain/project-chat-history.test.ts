import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ read: vi.fn(), project: vi.fn() }));
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
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw new Error("Database failed");
    return r.data;
  },
}));
vi.mock("@/lib/photon/message-history", () => ({
  readPhotonHistory: f.read,
  connectionKey: () => "connection-hash",
}));
import { getProjectChatHistory } from "../../lib/db/project-chat-history";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const client = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: f.project,
  })),
} as unknown as Parameters<typeof getProjectChatHistory>[0];
const people = {
  channel: "photon_shared",
  photon_user_id: "user",
  client_name: "Client",
  client_email: null,
  client_sender_id: "+14155550100",
  agent_number: "+14155550200",
  instance_id: "spectrum-project",
  chat_guid: "any;-;+14155550100",
};
beforeEach(() => vi.clearAllMocks());
describe("authorized project history", () => {
  it("denies another user's project before calling Photon", async () => {
    f.project.mockResolvedValue({ data: null, error: null });
    await expect(getProjectChatHistory(client, id)).rejects.toMatchObject({
      status: 404,
    });
    expect(f.read).not.toHaveBeenCalled();
  });
  it("offers setup for a draft with no linked client, without querying a guessed chat", async () => {
    f.project.mockResolvedValue({
      data: {
        id,
        name: "Draft",
        timezone: "America/Los_Angeles",
        people: null,
      },
      error: null,
    });
    expect(await getProjectChatHistory(client, id)).toMatchObject({
      connected: false,
      messages: [],
    });
    expect(f.read).not.toHaveBeenCalled();
  });
  it("resolves target exclusively from persisted project people and keeps credentials out of the DTO", async () => {
    f.project.mockResolvedValue({
      data: { id, name: "Website", timezone: "America/Los_Angeles", people },
      error: null,
    });
    f.read.mockResolvedValue({
      messages: [{ id: "provider-message" }],
      nextCursor: null,
    });
    const result = await getProjectChatHistory(client, id);
    expect(result.connected).toBe(true);
    expect(f.read).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: id,
        userId: "user",
        chatGuid: people.chat_guid,
      }),
      undefined,
    );
    expect(result).not.toHaveProperty("projectSecret");
  });
});
