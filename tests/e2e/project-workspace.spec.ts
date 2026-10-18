import { readFile } from "node:fs/promises";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { test, expect } from "@playwright/test";
import { build } from "esbuild";
let javascript: string;
let stylesheet: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {AppShell} from './components/dashboard/app-shell';import {ProjectWorkspace} from './components/projects/project-workspace';import {ProjectOverview} from './components/projects/project-overview';
  const project={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Saved project title',client_name:'Saved client',status:'draft',original_amount_cents:120000,currency:'USD',timezone:'America/Los_Angeles',agreed_due_date:null,scope_version:0,policy_version:0,people:null,policy:null,activation_cutoff:null,version:1,setup_step:2};
  const root=createRoot(document.getElementById('root'));window.__navigate=url=>{history.pushState({},'',url);render()};
  function render(){root.render(<AppShell email="owner@example.test" name="Owner" timezone="UTC" organization="Workspace"><ProjectWorkspace project={project}>{location.pathname.endsWith('/conversation')?<h2>Connected conversation component</h2>:location.pathname.endsWith('/work')?<h2>Work</h2>:<ProjectOverview bundle={{project,scope:[],documents:[],spans:[],members:[],binding:null,invitations:[]}} owner="Owner"/>}</ProjectWorkspace></AppShell>)};render();`,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "navigation",
        setup(builder) {
          builder.onResolve(
            { filter: /^next\/(navigation|link)$/ },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "jsx",
            resolveDir: process.cwd(),
            contents: args.path.endsWith("navigation")
              ? "export const usePathname=()=>location.pathname;export const useRouter=()=>({push:window.__navigate,refresh:()=>{}});"
              : "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props} onClick={e=>{e.preventDefault();window.__navigate(href)}}>{children}</a>}",
          }));
        },
      },
    ],
  });
  javascript = result.outputFiles[0].text;
  const compiler = await compile(await readFile("app/globals.css", "utf8"), {
    base: process.cwd() + "/app",
    onDependency: () => {},
  });
  const scanner = new Scanner({
    sources: [
      { base: process.cwd(), pattern: "components/**/*.tsx", negated: false },
    ],
  });
  stylesheet = compiler.build(scanner.scan());
});
test("project header, plain tab navigation and sidebar conversation link", async ({
  page,
}, testInfo) => {
  await page.route("http://project.test/**", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith("/bundle.js")
        ? "text/javascript"
        : "text/html",
      body: route.request().url().endsWith("/bundle.js")
        ? javascript
        : `<style>${stylesheet}</style><div id="root"></div><script src="/bundle.js"></script>`,
    }),
  );
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(
    "http://project.test/app/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  await expect(
    page.getByRole("heading", { name: "Saved project title", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".project-workspace")).toHaveCSS(
    "background-color",
    "rgb(243, 245, 246)",
  );
  const tabs = page.getByRole("navigation", { name: "Project sections" });
  await expect(tabs.getByRole("link")).toHaveCount(8);
  await expect(
    tabs.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("$1,200.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Harbor & Pine Bakery")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("project-overview.png"),
    fullPage: true,
  });
  await tabs.getByRole("link", { name: "Work", exact: true }).click();
  await expect(
    tabs.getByRole("link", { name: "Work", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Work", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Project shortcuts" })
    .getByRole("link", { name: "Conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/conversation$/);
  await expect(
    tabs.getByRole("link", { name: "Conversation", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
