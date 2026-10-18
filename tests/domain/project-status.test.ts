import { describe, expect, it } from "vitest";
import { projectListStatus } from "@/lib/projects/status";
describe("project list lifecycle", () => {
  it("keeps unfinished setup draft, including projects that have reached review but have not activated", () => {
    expect(projectListStatus("draft")).toBe("draft");
  });
  it("shows both successfully activated modes as active without changing the policy", () => {
    expect(projectListStatus("active")).toBe("active");
    expect(projectListStatus("review_only")).toBe("active");
  });
  it("preserves paused/closed states and does not disguise unknown states as drafts", () => {
    for (const state of ["paused", "completed", "archived"] as const)
      expect(projectListStatus(state)).toBe(state);
    expect(projectListStatus("unexpected")).toBe("unknown");
  });
});
