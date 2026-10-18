import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  project: vi.fn(),
  rpc: vi.fn(),
  send: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: async (_request: Request, run: (client: unknown) => unknown) =>
    run({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: f.project }) }),
      }),
      rpc: f.rpc,
    }),
  checked: (result: { data: unknown }) => result.data,
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
vi.mock("@/lib/db/admin", () => ({
  adminDb: () => ({ from: () => ({ update: f.update }) }),
}));
vi.mock("@/lib/photon/spectrum", () => ({
  readSpectrumCredentials: () => ({ projectId: "photon-project" }),
  dmChatGuid: (phone: string) => `any;-;${phone}`,
  sendPhotonText: f.send,
  PhotonSetupError: class extends Error {},
}));
import { POST } from "../../app/api/v1/projects/[projectId]/chat-test/route";
afterEach(() => vi.resetAllMocks());
const context = {
  params: Promise.resolve({
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }),
};
function request(introduction: string) {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({ expectedVersion: 1, introduction }),
  });
}
beforeEach(() => {
  f.project.mockResolvedValue({
    data: {
      people: {
        channel: "photon_shared",
        photon_user_id: "user-1",
        client_name: "Client",
        client_email: null,
        client_sender_id: "+12065550002",
        agent_number: null,
        instance_id: "photon-project",
        chat_guid: "any;-;+12065550002",
      },
    },
  });
  f.rpc.mockResolvedValue({ data: {} });
  f.send.mockResolvedValue({ state: "sent", messageId: "message-1" });
  const chain = { eq: vi.fn() };
  chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ error: null });
  f.update.mockReturnValue(chain);
});
it("sends the edited introduction and records exactly what the client received", async () => {
  await POST(
    request("Hello! I help organize requests for your website project."),
    context,
  );
  expect(f.send).toHaveBeenCalledWith(
    "+12065550002",
    "Hello! I help organize requests for your website project.",
  );
  expect(f.update).toHaveBeenCalledWith(
    expect.objectContaining({
      introduction_text:
        "Hello! I help organize requests for your website project.",
      test_state: "sent",
    }),
  );
});
it("rejects an empty introduction before contacting Photon or starting a send", async () => {
  await expect(POST(request("  "), context)).rejects.toThrow();
  expect(f.rpc).not.toHaveBeenCalled();
  expect(f.send).not.toHaveBeenCalled();
});
it("records recipient authorization rejection as failed with an actionable error instead of blocking as unknown", async () => {
  f.send.mockResolvedValue({ state: "failed", reason: "target_not_allowed" });
  await expect(
    POST(request("Project introduction"), context),
  ).rejects.toMatchObject({
    status: 422,
    code: "PHOTON_TARGET_NOT_ALLOWED",
    message: expect.stringContaining("shared-line assignment"),
  });
  expect(f.update).toHaveBeenCalledWith({
    test_state: "failed",
    hold_reason: expect.stringContaining("recipient authorization"),
  });
  expect(f.send).toHaveBeenCalledTimes(1);
});
it("preserves unknown delivery and its retry hold for an ambiguous provider result", async () => {
  f.send.mockResolvedValue({ state: "unknown" });
  await expect(
    POST(request("Project introduction"), context),
  ).rejects.toMatchObject({
    status: 503,
    code: "DELIVERY_UNKNOWN",
  });
  expect(f.update).toHaveBeenCalledWith({
    test_state: "unknown",
    hold_reason: expect.stringContaining("unknown"),
  });
  expect(f.send).toHaveBeenCalledTimes(1);
});
