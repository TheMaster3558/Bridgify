import { test, expect } from "@playwright/test";
import { build } from "esbuild";
let javascript: string;
const projectId = "22222222-2222-4222-8222-222222222222";
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import{AutomationManagement}from'./components/automation/management';createRoot(document.getElementById('root')).render(<AutomationManagement projectId="${projectId}"/>);`,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  javascript = result.outputFiles[0].text;
});
function fixture(state = "queued") {
  return {
    fetchedAt: new Date().toISOString(),
    project: {
      id: projectId,
      version: 5,
      status: "review_only",
      policy_version: 1,
      scope_version: 1,
      policy: {
        mode: "review_only",
        allowance_mode: "per_request",
        allowance: 3,
        operations: ["change_color"],
        targets: ["home.heading"],
        exclusions: "Commercial changes require approval",
        max_open_tasks: 3,
        notifications: "dashboard",
        replies: {
          status_questions: true,
          clarifications: true,
          review_acknowledgments: true,
          progress_updates: false,
        },
      },
    },
    scope: [],
    tasks: [],
    accounting: {
      requestsUsed: 0,
      roundsUsed: 0,
      queued: state === "queued" ? 1 : 0,
      failedJobs: 0,
    },
    automation_outbox: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        state,
        text: "Your change awaits review.",
        created_at: new Date().toISOString(),
        updated_at: "2026-10-18T00:00:00.000Z",
      },
    ],
    automation_jobs: [],
    automation_requests: [],
    automation_rounds: [],
    automation_round_members: [],
    automation_revision_refunds: [],
    automation_round_refunds: [],
    automation_runtime_health: [],
  };
}
async function setup(page: import("@playwright/test").Page, state = "queued") {
  const data = fixture(state);
  await page.route("https://management.test/**", async (route) => {
    const r = route.request();
    if (r.url().includes("/api/")) {
      if (r.method() === "POST") {
        const v = r.postDataJSON();
        if (v.action === "outbox_cancel")
          data.automation_outbox[0].state = "cancelled";
        if (v.action === "amend_policy") {
          data.project.policy = v.payload.policy;
          data.project.version++;
        }
        return route.fulfill({ json: { data: { saved: true } } });
      }
      return route.fulfill({ json: { data } });
    }
    return route.fulfill({
      contentType: r.url().endsWith("bundle.js")
        ? "text/javascript"
        : "text/html",
      body: r.url().endsWith("bundle.js")
        ? javascript
        : '<div id="root"></div><script src="/bundle.js"></script>',
    });
  });
  await page.goto("https://management.test/");
}
test("owner cancels a queued reply with its concurrency timestamp and audit reason", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByLabel("Reason for your next action (private)")
    .fill("Owner will send a personal response");
  const request = page.waitForRequest((r) => r.method() === "POST");
  await page.getByRole("button", { name: "Cancel queued reply" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    action: "outbox_cancel",
    payload: {
      expectedUpdatedAt: "2026-10-18T00:00:00.000Z",
      reason: "Owner will send a personal response",
    },
  });
  await expect(
    page.getByRole("button", { name: "Cancel queued reply" }),
  ).toHaveCount(0);
});
test("unknown delivery needs a reason and explicit non-delivery confirmation before retry", async ({
  page,
}) => {
  await setup(page, "unknown");
  const retry = page.getByRole("button", { name: "Queue an explicit retry" });
  await expect(retry).toBeDisabled();
  await page
    .getByLabel("Reason for your next action (private)")
    .fill("Client confirmed no reply arrived");
  await expect(retry).toBeDisabled();
  await page.getByLabel("I checked with the client").check();
  const req = page.waitForRequest((r) => r.method() === "POST");
  await retry.click();
  expect((await req).postDataJSON()).toMatchObject({
    action: "outbox_retry",
    payload: { confirmedNotDelivered: true },
  });
});
test("activated policy amendments save a version and selected progress notifications", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByLabel("Reason for your next action (private)")
    .fill("Client wants progress updates");
  await page.getByText("Amend saved automation policy").click();
  await page
    .getByLabel("Send updates when I start, block, complete or cancel work")
    .selectOption("on");
  const req = page.waitForRequest((r) => r.method() === "POST");
  await page.getByRole("button", { name: "Save policy amendment" }).click();
  expect((await req).postDataJSON()).toMatchObject({
    action: "amend_policy",
    payload: {
      expectedVersion: 5,
      policy: { replies: { progress_updates: true } },
    },
  });
});
