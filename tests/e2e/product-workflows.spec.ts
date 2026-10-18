import { test, expect } from "@playwright/test";
import { build } from "esbuild";
let javascript: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {TaskEditor} from './components/tasks/task-editor';
 import {ProposalEditor} from './components/proposals/proposal-editor';
 import {RecordResponse} from './components/proposals/record-response';
 import {ConnectionRecovery} from './components/setup/connection-recovery';
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const root=createRoot(document.getElementById('root'));
 root.render(location.pathname==='/task'?<TaskEditor projectId={id}/>:
 location.pathname==='/proposal'?<ProposalEditor projectId={id}/>:
 location.pathname==='/response'?<RecordResponse proposalId={id} revision={2} version={3} projectVersion={4} termsHash={'a'.repeat(64)} messages={[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',text:'I approve proposal revision 2 and its exact terms.',occurred_at:'2026-10-18T12:00:00Z'}]}/>:
 <ConnectionRecovery bundle={{project:{id,version:1,status:'paused',people:{client_name:'Client'}},binding:{test_state:'unknown',introduction_text:'Assistant disclosure',hold_reason:'Inspect delivery'}}}/>);
 `,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "fixture-next",
        setup(builder) {
          builder.onResolve(
            { filter: /^next\/(navigation|link)$/ },
            (args) => ({ path: args.path, namespace: "fixture-next" }),
          );
          builder.onLoad(
            { filter: /.*/, namespace: "fixture-next" },
            (args) => ({
              loader: "jsx",
              resolveDir: process.cwd(),
              contents: args.path.endsWith("navigation")
                ? "export const useRouter=()=>({refresh(){},push(url){window.savedUrl=url}});"
                : 'import React from "react";export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}',
            }),
          );
        },
      },
    ],
  });
  javascript = result.outputFiles[0].text;
});
test.beforeEach(async ({ page }) => {
  await page.route("https://product.test/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/api/"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            proposal_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            revision: 1,
          },
        }),
      });
    return route.fulfill({
      contentType: path === "/bundle.js" ? "text/javascript" : "text/html",
      body:
        path === "/bundle.js"
          ? javascript
          : '<!doctype html><div id="root"></div><script src="/bundle.js"></script>',
    });
  });
});
test("manual task creation saves private details and a separate internal date", async ({
  page,
}) => {
  await page.goto("https://product.test/task");
  await page.getByText("New task", { exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Implement agreed footer");
  await page
    .getByLabel("Instructions", { exact: true })
    .fill("Use the confirmed wording");
  await page
    .getByLabel("Acceptance criteria", { exact: true })
    .fill("Matches agreement");
  await page
    .getByLabel("Internal target date", { exact: true })
    .fill("2026-12-01");
  await page
    .getByLabel("Private notes", { exact: true })
    .fill("Private owner context");
  const pending = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/tasks"),
  );
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const request = await pending;
  expect(request.postDataJSON()).toMatchObject({
    title: "Implement agreed footer",
    internal_due_date: "2026-12-01",
    internal_note: "Private owner context",
  });
  expect(request.postDataJSON()).not.toHaveProperty("agreed_due_date");
  expect(request.headers()["idempotency-key"]).toBeTruthy();
});
test("proposal drafts convert entered prices to exact cents and do not send immediately", async ({
  page,
}) => {
  await page.goto("https://product.test/proposal");
  await page.getByLabel("Title", { exact: true }).fill("Additional page");
  await page
    .getByLabel("Client explanation", { exact: true })
    .fill("Add the agreed campaign page");
  await page.getByLabel("Deliverable 1", { exact: true }).fill("Campaign page");
  await page
    .getByLabel("Additional price (project currency)", { exact: true })
    .fill("125.49");
  const pending = page.waitForRequest((r) => r.method() === "POST");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const request = await pending;
  expect(request.postDataJSON()).toMatchObject({
    amount_cents: 12549,
    change_due_date: false,
    allowance_delta: 0,
    lines: [{ title: "Campaign page" }],
  });
  expect(request.url()).toContain("/proposals");
  expect(request.postDataJSON()).not.toHaveProperty("action", "send");
});
test("recording client decisions requires evidence, attestation and preserves drafts and retry identity", async ({
  page,
}) => {
  let attempts = 0;
  const keys: string[] = [];
  await page.route("**/api/v1/proposals/*/response", async (route) => {
    attempts++;
    keys.push(route.request().headers()["idempotency-key"]);
    await route.fulfill({
      status: attempts === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1
          ? { error: { message: "Retry saved approval" } }
          : { data: { outcome: "approved" } },
      ),
    });
  });
  await page.goto("https://product.test/response");
  const submit = page.getByRole("button", {
    name: "Record client decision",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Your explanation", exact: true })
    .fill("Reviewed the exact terms with the client");
  await page
    .getByLabel("I approve proposal revision 2", { exact: false })
    .check();
  await expect(submit).toBeDisabled();
  await page.getByLabel("I reviewed the evidence", { exact: false }).check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText("Retry saved approval");
  await expect(
    page.getByRole("textbox", { name: "Your explanation", exact: true }),
  ).toHaveValue("Reviewed the exact terms with the client");
  await submit.click();
  await expect.poll(() => attempts).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
test("uncertain introductions require explicit non-delivery and a reason before retry", async ({
  page,
}) => {
  await page.goto("https://product.test/connection");
  const retry = page.getByRole("button", {
    name: "Authorize another introduction attempt",
    exact: true,
  });
  await expect(retry).toBeDisabled();
  await page.getByLabel("I checked the conversation", { exact: false }).check();
  await expect(retry).toBeDisabled();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Client confirmed non-delivery");
  const pending = page.waitForRequest((r) => r.method() === "POST");
  await retry.click();
  expect((await pending).postDataJSON()).toMatchObject({
    action: "retry",
    confirmedNotDelivered: true,
    expectedVersion: 1,
    reason: "Client confirmed non-delivery",
  });
});
