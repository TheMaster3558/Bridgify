import { afterEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ run: vi.fn(), after: vi.fn() }));
vi.mock("@/lib/assistant/run-batch", () => ({ runAutomationBatch: f.run }));
vi.mock("next/server", () => ({ after: f.after }));
import { POST, GET } from "@/app/api/internal/automation/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("rejects missing and wrong recovery secrets without running jobs", async () => {
  vi.stubEnv("AUTOMATION_RUNNER_SECRET", "s".repeat(64));
  for (const authorization of ["", "Bearer wrong"])
    expect(
      (
        await POST(
          new Request("https://owner.test/api/internal/automation", {
            method: "POST",
            headers: { authorization },
          }),
        )
      ).status,
    ).toBe(401);
  expect(f.run).not.toHaveBeenCalled();
});
it("authenticated health does not run work; recovery runs one bounded batch", async () => {
  vi.stubEnv("AUTOMATION_RUNNER_SECRET", "s".repeat(64));
  const req = () =>
    new Request("https://owner.test/api/internal/automation", {
      headers: { authorization: "Bearer " + "s".repeat(64) },
    });
  expect((await (await GET(req())).json()).version).toBe(
    "webhook-automation-v1",
  );
  expect(f.run).not.toHaveBeenCalled();
  f.run.mockResolvedValue({ processed: 1, sent: 1 });
  expect((await POST(req())).status).toBe(202);
  expect(f.run).not.toHaveBeenCalled();
  await f.after.mock.calls[0][0]();
  expect(f.run).toHaveBeenCalledTimes(1);
});
