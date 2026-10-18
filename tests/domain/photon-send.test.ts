import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthenticationError } from "@photon-ai/advanced-imessage/grpc";
const f = vi.hoisted(() => ({
  start: vi.fn(),
  create: vi.fn(),
  send: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@spectrum-ts/core", () => ({ Spectrum: f.start }));
vi.mock("@spectrum-ts/imessage", () => ({
  imessage: Object.assign(() => ({ space: { create: f.create } }), {
    config: () => ({}),
  }),
}));
import { sendPhotonText } from "@/lib/photon/spectrum";

beforeEach(() => {
  vi.stubEnv("SPECTRUM_PROJECT_ID", "test-project");
  vi.stubEnv("SPECTRUM_PROJECT_SECRET", "private-test-secret");
  f.start.mockResolvedValue({ stop: f.stop });
  f.create.mockResolvedValue({ send: f.send });
  f.stop.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it("treats a typed recipient permission denial as a definite failure and sends once", async () => {
  f.send.mockRejectedValue(
    new AuthenticationError(
      "[spectrum-imessage] Target not allowed for this project",
      { code: "internalError", grpcCode: 7, retryable: false },
    ),
  );
  expect(await sendPhotonText("+12065550002", "Introduction")).toEqual({
    state: "failed",
    reason: "target_not_allowed",
  });
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.stop).toHaveBeenCalledTimes(1);
});
it("distinguishes credential rejection from recipient authorization", async () => {
  f.send.mockRejectedValue(
    new AuthenticationError("Expired token", {
      code: "tokenExpired",
      grpcCode: 16,
      retryable: false,
    }),
  );
  expect(await sendPhotonText("+12065550002", "Introduction")).toEqual({
    state: "failed",
    reason: "authentication",
  });
});
it("keeps ambiguous timeouts unknown without retrying even when their text resembles a denial", async () => {
  f.send.mockRejectedValue(
    new Error("Timeout: Target not allowed for this project"),
  );
  expect(await sendPhotonText("+12065550002", "Introduction")).toEqual({
    state: "unknown",
  });
  expect(f.send).toHaveBeenCalledTimes(1);
  expect(f.stop).toHaveBeenCalledTimes(1);
});
it("records the returned message ID while a missing receipt remains unknown", async () => {
  f.send
    .mockResolvedValueOnce({ id: "actual-provider-id" })
    .mockResolvedValueOnce(undefined);
  expect(await sendPhotonText("+12065550002", "Introduction")).toEqual({
    state: "sent",
    messageId: "actual-provider-id",
  });
  expect(await sendPhotonText("+12065550002", "Introduction")).toEqual({
    state: "unknown",
  });
});
