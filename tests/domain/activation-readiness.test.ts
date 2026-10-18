import { describe, expect, it } from "vitest";
import { activationIssues } from "../../lib/projects/activation-readiness";
import type { Bundle } from "../../lib/domain/types";
const ready = {
  project: { scope_version: 1, policy_version: 1, policy: {}, people: {} },
  binding: {
    test_state: "sent",
    verified_at: "verified",
    disclosed_message_guid: "intro",
    hold_reason: null,
  },
} as unknown as Pick<Bundle, "project" | "binding">;
describe("activation readiness", () => {
  it("identifies the exact missing introduction instead of blocking without explanation", () => {
    expect(activationIssues({ ...ready, binding: null })).toEqual([
      {
        step: 3,
        message: expect.stringContaining("Send the assistant introduction"),
      },
    ]);
    expect(activationIssues(ready)).toEqual([]);
  });
  it("keeps pending sends and recipient holds from authorizing activation", () => {
    expect(
      activationIssues({
        ...ready,
        binding: { ...ready.binding!, test_state: "unknown" },
      })[0].step,
    ).toBe(3);
    expect(
      activationIssues({
        ...ready,
        binding: {
          ...ready.binding!,
          hold_reason: "Recipient authorization rejected",
        },
      })[0].message,
    ).toContain("authorization");
  });
});
