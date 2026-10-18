import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  project: vi.fn(),
  membership: vi.fn(),
  insert: vi.fn(),
  prior: vi.fn(),
  save: vi.fn(),
  user: vi.fn(),
  send: vi.fn(),
  admin: vi.fn(),
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
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw new Error("Database failed");
    return r.data;
  },
}));
vi.mock("@/lib/db/admin", () => ({ adminDb: f.admin }));
vi.mock("@/lib/photon/spectrum", () => ({
  readSpectrumCredentials: () => ({ projectId: "spectrum-project" }),
  dmChatGuid: (a: string) => `any;-;${a}`,
  findPhotonUser: f.user,
  sendPhotonText: f.send,
}));
vi.mock("@/lib/photon/message-history", () => ({
  connectionKey: () => "a".repeat(64),
}));
import {
  ownerMessageSchema,
  sendProjectMessage,
} from "../../lib/db/send-project-message";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const people = {
  channel: "photon_shared",
  photon_user_id: "photon-client",
  client_name: "Client",
  client_email: null,
  client_sender_id: "+14155550100",
  agent_number: "+14155550200",
  instance_id: "spectrum-project",
  chat_guid: "any;-;+14155550100",
};
const body = { text: "Sure, will do", connectionKey: "a".repeat(64) };
function chain(end: Record<string, unknown>) {
  const c: Record<string, unknown> = { ...end };
  c.select = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  return c;
}
const client = {
  from: (table: string) =>
    chain({ maybeSingle: table === "projects" ? f.project : f.membership }),
} as unknown as Parameters<typeof sendProjectMessage>[0];
const run = (input = body) =>
  sendProjectMessage(client, "owner", id, "unique-key-123456", input);
beforeEach(() => {
  vi.resetAllMocks();
  f.project.mockResolvedValue({
    data: { people, organization_id: "organization" },
    error: null,
  });
  f.membership.mockResolvedValue({
    data: { organization_id: "organization" },
    error: null,
  });
  f.user.mockResolvedValue({
    phoneNumber: people.client_sender_id,
    assignedPhoneNumber: people.agent_number,
  });
  f.insert.mockResolvedValue({ error: null });
  f.save.mockResolvedValue({ error: null });
  f.admin.mockReturnValue({
    from: () => ({
      insert: f.insert,
      select: () => chain({ single: f.prior }),
      update: () => ({ eq: () => ({ eq: f.save }) }),
    }),
  });
  f.send.mockResolvedValue({ state: "sent", messageId: "provider-guid" });
});
describe("owner dashboard sends", () => {
  it("sends only to the persisted client and records a durable claim before Photon", async () => {
    expect(await run()).toEqual({ state: "sent", messageId: "provider-guid" });
    expect(f.send).toHaveBeenCalledExactlyOnceWith(
      people.client_sender_id,
      body.text,
    );
    expect(f.insert.mock.invocationCallOrder[0]).toBeLessThan(
      f.send.mock.invocationCallOrder[0],
    );
    expect(f.insert.mock.calls[0][0].result.state).toBe("sending");
  });
  it("denies another user's project before privileged writes or provider access", async () => {
    f.project.mockResolvedValue({ data: null, error: null });
    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(f.admin).not.toHaveBeenCalled();
    expect(f.user).not.toHaveBeenCalled();
    expect(f.send).not.toHaveBeenCalled();
  });
  it("rejects readable projects for users without owner membership", async () => {
    f.membership.mockResolvedValue({ data: null, error: null });
    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(f.send).not.toHaveBeenCalled();
    expect(f.admin).not.toHaveBeenCalled();
  });
  it("validates text, disallows arbitrary recipients and rejects a stale connection", async () => {
    expect(ownerMessageSchema.safeParse({ ...body, text: "  " }).success).toBe(
      false,
    );
    expect(
      ownerMessageSchema.safeParse({ ...body, text: "x".repeat(4001) }).success,
    ).toBe(false);
    expect(
      ownerMessageSchema.safeParse({ ...body, address: "attacker" }).success,
    ).toBe(false);
    await expect(
      run({ ...body, connectionKey: "b".repeat(64) }),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.send).not.toHaveBeenCalled();
  });
  it("blocks sending when the provider client or agent assignment changed", async () => {
    f.user.mockResolvedValue({
      phoneNumber: people.client_sender_id,
      assignedPhoneNumber: "different-agent",
    });
    await expect(run()).rejects.toMatchObject({ status: 422 });
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.send).not.toHaveBeenCalled();
  });
  it("does not send if the durable claim cannot be stored", async () => {
    f.insert.mockResolvedValue({ error: { code: "database-unavailable" } });
    await expect(run()).rejects.toThrow();
    expect(f.send).not.toHaveBeenCalled();
  });
  it.each(["sending", "unknown", "sent", "failed"])(
    "deduplicates repeated/concurrent delivery with a %s receipt",
    async (state) => {
      await run();
      const fingerprint = f.insert.mock.calls[0][0].fingerprint;
      f.send.mockClear();
      f.insert.mockResolvedValue({ error: { code: "23505" } });
      f.prior.mockResolvedValue({
        data: { fingerprint, result: { state, messageId: "provider-guid" } },
        error: null,
      });
      expect((await run()).state).toBe(state === "sending" ? "unknown" : state);
      expect(f.send).not.toHaveBeenCalled();
    },
  );
  it("rejects reusing a key for different content", async () => {
    f.insert.mockResolvedValue({ error: { code: "23505" } });
    f.prior.mockResolvedValue({
      data: { fingerprint: "other", result: { state: "sent" } },
      error: null,
    });
    await expect(run()).rejects.toMatchObject({ status: 409 });
    expect(f.send).not.toHaveBeenCalled();
  });
  it("reports unknown after a send exception or failed receipt update, without resending", async () => {
    f.send.mockRejectedValue(new Error("provider timeout"));
    expect(await run()).toEqual({ state: "unknown" });
    f.send.mockResolvedValue({ state: "sent", messageId: "guid" });
    f.save.mockResolvedValue({ error: { code: "unavailable" } });
    expect(await run()).toEqual({ state: "unknown" });
  });
});
