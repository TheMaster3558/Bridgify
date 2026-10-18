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

test("owner composes, sends and checks uncertain delivery without creating a new attempt", async ({
  page,
}) => {
  const state: ProjectChatHistory = {
    projectName: "Website",
    timezone: "UTC",
    connected: true,
    connectionKey: "a".repeat(64),
    clientName: "Alex",
    agentAddress: "+14155550200",
    messages: [],
    nextCursor: null,
    fetchedAt: new Date().toISOString(),
  };
  const sends: {
    key: string;
    body: { text: string; connectionKey: string };
  }[] = [];
  let outcome: "sent" | "unknown" | "failed" = "sent";
  await page.route("https://history.test/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.pathname === "/bundle.js")
      return route.fulfill({
        contentType: "text/javascript",
        body: javascript,
      });
    if (url.pathname.includes("/api/")) {
      if (req.method() === "POST") {
        sends.push({
          key: req.headers()["idempotency-key"],
          body: req.postDataJSON(),
        });
        if (outcome === "sent")
          state.messages.push(
            message(`manual-${sends.length}`, req.postDataJSON().text, true),
          );
        return route.fulfill({
          json: {
            data: {
              state: outcome,
              messageId: outcome === "sent" ? "provider-guid" : undefined,
            },
          },
        });
      }
      return route.fulfill({ json: { data: state } });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<div id="root"></div><script src="/bundle.js"></script>',
    });
  });
  await page.goto("https://history.test/conversation");
  const box = page.getByRole("textbox", { name: "Message Alex" }),
    button = page.getByRole("button", { name: "Send message", exact: true });
  await expect(button).toBeDisabled();
  await box.fill("Sure, will do");
  await button.click();
  await expect(box).toHaveValue("");
  await expect(page.getByText("Sure, will do", { exact: true })).toBeVisible();
  expect(sends).toHaveLength(1);
  expect(sends[0].body).toEqual({
    text: "Sure, will do",
    connectionKey: state.connectionKey,
  });
  outcome = "unknown";
  await box.fill("Another reply");
  await button.click();
  await expect(page.getByRole("alert")).toContainText(
    "Delivery is unconfirmed",
  );
  await expect(box).toBeDisabled();
  await page.getByRole("button", { name: "Check send status" }).click();
  expect(sends[1].key).toBe(sends[2].key);
  await page.getByRole("button", { name: "Compose another message" }).click();
  await expect(box).toBeEnabled();
  outcome = "failed";
  await box.fill("Try after reconnecting");
  await button.click();
  await expect(page.getByRole("alert")).toContainText(
    "The message was not sent",
  );
  await expect(box).toHaveValue("Try after reconnecting");
  expect(sends[3].key).not.toBe(sends[2].key);
});
