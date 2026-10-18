import { afterEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  database: {},
  inbox: {},
  listener: vi.fn(),
  batch: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("../../lib/db/postgres", () => ({
  getDatabase: () => dependencies.database,
}));
vi.mock("../../lib/assistant/automation", () => ({
  createProjectAutomationInbox: () => dependencies.inbox,
}));
vi.mock("../../lib/photon/spectrum", () => ({
  readSpectrumCredentials: () => ({ projectId: "instance" }),
}));
vi.mock("../../lib/photon/sdk-listener", () => ({
  runSpectrumSdkListener: dependencies.listener,
}));
vi.mock("../../lib/assistant/run-batch", () => ({
  runAutomationBatch: dependencies.batch,
}));
vi.mock("../../lib/assistant/sync-history", () => ({
  syncProjectAutomationHistory: dependencies.sync,
}));

import { runAutomationWorker } from "../../lib/assistant/run-worker";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("optional SDK worker", () => {
  it("overrides saved webhook mode without signing secrets and wakes an idle processor immediately", async () => {
    vi.stubEnv("AUTOMATION_INTAKE", "webhook");
    vi.stubEnv("PHOTON_WEBHOOK_INSTANCE_ID", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stopping = new AbortController();
    let listenerOptions!: {
      signal: AbortSignal;
      onCommitted(): void;
      catchUp(signal: AbortSignal): Promise<unknown>;
    };
    dependencies.listener.mockImplementation((options) => {
      listenerOptions = options;
      return new Promise<void>((resolve) =>
        options.signal.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
    });
    let ready!: () => void;
    const idle = new Promise<void>((resolve) => {
      ready = resolve;
    });
    dependencies.batch
      .mockImplementationOnce(async () => {
        ready();
        return { processed: 0, sent: 0 };
      })
      .mockImplementationOnce(async () => {
        stopping.abort();
        return { processed: 1, sent: 1 };
      });
    const running = runAutomationWorker({
      enabled: true,
      intake: "sdk",
      signal: stopping.signal,
    });
    await idle;
    // Let the pump enter its 2-second recovery wait. A committed SDK message
    // must wake it, without advancing a history polling interval.
    await new Promise((resolve) => setImmediate(resolve));
    listenerOptions.onCommitted();
    await running;
    expect(dependencies.batch).toHaveBeenCalledTimes(2);
    expect(dependencies.sync).not.toHaveBeenCalled();
    expect(dependencies.listener).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: "instance",
        inbox: dependencies.inbox,
      }),
    );
    await listenerOptions.catchUp(new AbortController().signal);
    expect(dependencies.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: "instance",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(listenerOptions.signal.aborted).toBe(true);
  }, 1500);

  it("webhook mode does not open an SDK listener or poll Photon history", async () => {
    vi.stubEnv("PHOTON_WEBHOOK_INSTANCE_ID", "instance");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stopping = new AbortController();
    dependencies.batch.mockImplementation(async () => {
      stopping.abort();
      return { processed: 0, sent: 0 };
    });
    await runAutomationWorker({
      enabled: true,
      intake: "webhook",
      signal: stopping.signal,
    });
    expect(dependencies.listener).not.toHaveBeenCalled();
    expect(dependencies.sync).not.toHaveBeenCalled();
    expect(dependencies.batch).toHaveBeenCalledTimes(1);
  });
});
