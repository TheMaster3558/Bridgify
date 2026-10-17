import { describe, it, expect } from "vitest";
import {
  safeNext,
  centsFromInput,
  validateEvidence,
} from "@/lib/domain/security";
import {
  basicsSchema,
  peopleSchema,
  policySchema,
} from "@/lib/schemas/onboarding";
import { textSpans } from "@/lib/domain/agreement";
import { membershipHash, verifyGateway } from "@/lib/photon/connection";
describe("onboarding policy boundaries", () => {
  it("preserves the exact proposal and revision through authentication", () => {
    expect(safeNext("/proposals/abc?revision=7")).toBe(
      "/proposals/abc?revision=7",
    );
  });
  it.each([
    "https://evil.example/app",
    "//evil.example/app",
    "/\\evil.example/app",
    "/auth/signout",
    "javascript:alert(1)",
    "/app\nLocation: evil",
  ])("rejects unsafe return destination %s", (next) =>
    expect(safeNext(next)).toBe("/app"),
  );
  it("calculates decimal money without float rounding", () => {
    expect(centsFromInput("100.29")).toBe(10029);
    expect(centsFromInput("0.01")).toBe(1);
    expect(centsFromInput("0")).toBe(0);
    expect(() => centsFromInput("1.234")).toThrow();
    expect(() => centsFromInput("1e3")).toThrow();
  });
  it("validates agreed calendar dates and timezone", () => {
    const basics = {
      name: "Site",
      client_name: "Client",
      original_amount_cents: 0,
      currency: "USD",
      timezone: "America/Los_Angeles",
      agreed_due_date: null,
    };
    expect(basicsSchema.safeParse(basics).success).toBe(true);
    expect(
      basicsSchema.safeParse({ ...basics, agreed_due_date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      basicsSchema.safeParse({ ...basics, timezone: "Mars/City" }).success,
    ).toBe(false);
  });
  it("never treats a shared display name as a unique identity", () =>
    expect(
      peopleSchema.safeParse({
        owner_sender_id: "same",
        client_sender_id: "same",
        bot_sender_id: "bot",
        instance_id: "i",
        chat_guid: "g",
        identities_confirmed: true,
      }).success,
    ).toBe(false));
  it("disables automatic revision rounds", () =>
    expect(
      policySchema.safeParse({
        mode: "enabled",
        allowance_mode: "manual_rounds",
        allowance: 2,
        operations: ["replace_text"],
        targets: ["home.heading"],
        exclusions: "No new pages",
        max_open_tasks: 10,
        notifications: "dashboard",
      }).success,
    ).toBe(false));
  it("rejects fabricated or empty evidence", () => {
    expect(
      validateEvidence(
        [{ span_id: "a", quote: "included" }],
        [{ id: "a", text: "One page included" }],
      ),
    ).toBe(true);
    expect(
      validateEvidence(
        [{ span_id: "a", quote: "not included" }],
        [{ id: "a", text: "One page included" }],
      ),
    ).toBe(false);
    expect(
      validateEvidence(
        [{ span_id: "a", quote: "" }],
        [{ id: "a", text: "abc" }],
      ),
    ).toBe(false);
  });
  it("rejects over-limit text without silently truncating it", () =>
    expect(() => textSpans(["x".repeat(30001)])).toThrow(
      /Nothing was truncated/,
    ));
  it("rejects mixed text and scanned pages", () =>
    expect(() => textSpans(["A real agreement with text", ""])).toThrow(
      /scanned/,
    ));
  it("hashes full membership independently of order", () => {
    expect(membershipHash(["owner", "client", "bot"])).toBe(
      membershipHash(["bot", "owner", "client"]),
    );
    expect(membershipHash(["owner", "client", "bot", "stranger"])).not.toBe(
      membershipHash(["owner", "client", "bot"]),
    );
  });
  it("does not accept unconfigured webhooks", () => {
    expect(verifyGateway(new Headers())).toBe(false);
  });
});

import { readBody } from "@/lib/body";
it("limits chunked input even without Content-Length", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(20));
      controller.enqueue(new Uint8Array(20));
      controller.close();
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(readBody(request, 30)).rejects.toThrow(/too large/);
});
