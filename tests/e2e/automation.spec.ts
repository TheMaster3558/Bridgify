import { test, expect } from "@playwright/test";
import { build } from "esbuild";

let javascript: string;
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {DecisionActions} from './components/dashboard/decision-actions';
      import {TaskStatusActions} from './components/tasks/task-status-actions';
      import {AutomationSetup} from './components/setup/automation-setup';
      import {NeedsAttention} from './components/dashboard/needs-attention';
      const task={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',status:'ready',updated_at:'2026-10-17T12:00:00.000Z'};
      const decision={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'Change the heading color',automation_request_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',reason:location.pathname==='/failed-decision'?'failed_processing':'policy_denied',severity:'warning',history:[],missing_details:[],suggested_options:[],updated_at:'2026-10-17T12:00:00.000Z'};
      const project={policy:null,scope_version:0};
      const root=createRoot(document.getElementById('root'));
      root.render(location.pathname==='/reviews'?<NeedsAttention decisions={[decision]}/>:location.pathname==='/settings'?<AutomationSetup project={project} bundle={{scope:[]}} locked={false} onSave={async p=>{await fetch('/saved-policy',{method:'POST',body:JSON.stringify(p)})}}/>:
        location.pathname.includes('decision')?<DecisionActions decision={decision}/>:<TaskStatusActions task={task} onSaved={t=>window.savedTask=t}/>);`,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "test-navigation",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, (args) => ({
            path: args.path,
            namespace: "test-navigation",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "test-navigation" },
            () => ({
              contents:
                "export const useRouter=()=>({refresh:()=>{window.refreshed=true}});",
            }),
          );
        },
      },
    ],
  });
  javascript = bundle.outputFiles[0].text;
});
test.beforeEach(async ({ page }) => {
  await page.route("https://automation.test/**", (route) => {
    if (
      route.request().url().includes("/api/") ||
      route.request().url().includes("/saved-policy")
    )
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { status: "done" } }),
      });
    return route.fulfill({
      contentType: route.request().url().endsWith("bundle.js")
        ? "text/javascript"
        : "text/html",
      body: route.request().url().endsWith("bundle.js")
        ? javascript
        : '<div id="root"></div><script src="/bundle.js"></script>',
    });
  });
});
test("owner approval submits the real review command with note and optional reply", async ({
  page,
}) => {
  await page.goto("https://automation.test/decision");
  await expect(
    page.getByRole("button", { name: "Accept work" }),
  ).toBeDisabled();
  await page
    .getByLabel("Decision reason (private)")
    .fill("Approved one extra revision");
  await page
    .getByLabel("Client reply (optional)")
    .fill("I approved your change.");
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().includes("/api/v1/decisions/"),
  );
  await page.getByRole("button", { name: "Accept work" }).click();
  const sent = await request;
  expect(sent.postDataJSON()).toEqual({
    action: "approve",
    note: "Approved one extra revision",
    reply: "I approved your change.",
    taskTitle: "Change the heading color",
  });
  expect(sent.headers()["idempotency-key"]).toBeTruthy();
});
test("task updates submit a saved status and optimistic concurrency timestamp", async ({
  page,
}) => {
  await page.goto("https://automation.test/task");
  await page.getByLabel("Task status").selectOption("done");
  await page.getByLabel("Internal update").fill("Heading color updated");
  const request = page.waitForRequest((r) => r.method() === "PATCH");
  await page.getByRole("button", { name: "Save task status" }).click();
  expect((await request).postDataJSON()).toEqual({
    status: "done",
    note: "Heading color updated",
    expectedUpdatedAt: "2026-10-17T12:00:00.000Z",
  });
});
test("project creation saves independent reply preferences with manual approval", async ({
  page,
}) => {
  await page.goto("https://automation.test/settings");
  await page
    .getByLabel("Answer status questions from saved task information")
    .selectOption("off");
  const request = page.waitForRequest((r) => r.url().endsWith("/saved-policy"));
  await page
    .getByRole("button", { name: "Save automation & continue" })
    .click();
  expect((await request).postDataJSON()).toMatchObject({
    mode: "review_only",
    replies: {
      status_questions: false,
      clarifications: true,
      review_acknowledgments: true,
    },
  });
});

test("failed processing reviews allow approval with an owner-edited task title", async ({
  page,
}) => {
  await page.goto("https://automation.test/failed-decision");
  await expect(
    page.getByText("Automatic interpretation failed.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Decision reason (private)")
    .fill("Source checked and accepted");
  await page.getByLabel("Task to approve").fill("Make the heading blue");
  const request = page.waitForRequest((r) => r.method() === "POST");
  await page.getByRole("button", { name: "Accept work" }).click();
  expect((await request).postDataJSON().taskTitle).toBe(
    "Make the heading blue",
  );
});

test("delete works without an approval note and submits a backend action", async ({
  page,
}) => {
  await page.goto("https://automation.test/failed-decision");
  const request = page.waitForRequest((r) => r.method() === "POST");
  await page.getByRole("button", { name: "Delete review" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    action: "delete",
    note: "",
    reply: "",
  });
});

test("the review disappears from the list only after a successful backend save",async({page})=>{
  await page.goto("https://automation.test/reviews");
  await page.getByRole("button",{name:"Delete review"}).click();
  await expect(page.getByText("No decisions are waiting for review.")).toBeVisible();
  await expect(page.getByRole("button",{name:"All (0)"})).toBeVisible();
});
