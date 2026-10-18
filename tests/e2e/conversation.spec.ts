import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import type {
  ProjectChatHistory,
  ProjectChatMessage,
} from "../../lib/photon/history-contract";
let javascript: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ProjectConversation} from './components/projects/project-conversation';createRoot(document.getElementById('root')).render(<ProjectConversation projectId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "test-link",
        setup(builder) {
          builder.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            loader: "jsx",
            resolveDir: process.cwd(),
            contents:
              "import React from 'react';export default function Link(props){return <a {...props}/>;}",
          }));
        },
      },
    ],
  });
  javascript = result.outputFiles[0].text;
});
function message(
  id: string,
  text: string,
  outbound = false,
): ProjectChatMessage {
  return {
    id,
    text,
    direction: outbound ? "outbound" : "inbound",
    sender: outbound ? "agent" : "client",
    sentAt: `2026-10-17T${id === "old" ? "09" : "10"}:00:00Z`,
    editedAt: null,
    deleted: false,
    delivery: outbound ? "read" : null,
    attachments: [],
  };
}
test("production conversation displays both directions, pagination, refresh and recoverable errors", async ({
  page,
}) => {
  let fail = false;
  const state: ProjectChatHistory = {
    projectName: "Website",
    timezone: "America/Los_Angeles",
    connected: true,
    connectionKey: "one",
    clientName: "Alex",
    agentAddress: "+14155550200",
    messages: [
      message("client", "Please change the heading"),
      message("agent", "I have recorded your request", true),
    ],
    nextCursor: "signed-older",
    fetchedAt: new Date().toISOString(),
  };
  await page.route("https://history.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/bundle.js")
      return route.fulfill({
        contentType: "text/javascript",
        body: javascript,
      });
    if (url.pathname.includes("/api/")) {
      if (fail)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Photon is unavailable. Try Refresh." } },
        });
      return route.fulfill({
        json: {
          data: url.searchParams.has("cursor")
            ? {
                ...state,
                messages: [
                  message("old", "Earlier conversation"),
                  state.messages[0],
                ],
                nextCursor: null,
              }
            : state,
        },
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<div id="root"></div><script src="/bundle.js"></script>',
    });
  });
  await page.goto("https://history.test/conversation");
  await expect(page.getByText("Please change the heading")).toBeVisible();
  await expect(page.getByText("I have recorded your request")).toBeVisible();
  await expect(page.getByText("read", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Load older messages", exact: true })
    .click();
  await expect(page.getByText("Earlier conversation")).toBeVisible();
  await expect(page.getByText("Please change the heading")).toHaveCount(1);
  fail = true;
  await page.getByRole("button", { name: "Refresh messages" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Previously loaded messages remain below",
  );
  await expect(page.getByText("Please change the heading")).toBeVisible();
  fail = false;
  state.messages.push(message("new", "A new reply", true));
  await page.getByRole("button", { name: "Refresh messages" }).click();
  await expect(page.getByText("A new reply")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  state.connectionKey = "replacement";
  state.messages = [message("replacement", "Different connected client")];
  await page.getByRole("button", { name: "Refresh messages" }).click();
  await expect(page.getByText("Different connected client")).toBeVisible();
  await expect(page.getByText("Please change the heading")).toHaveCount(0);
  state.connected = false;
  state.connectionKey = null;
  state.messages = [];
  await page.getByRole("button", { name: "Refresh messages" }).click();
  await expect(
    page.getByRole("link", { name: "Connect client in People & chat" }),
  ).toBeVisible();
});
