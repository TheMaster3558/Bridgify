import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { compile } from "@tailwindcss/node";

let javascript: string, css: string;
test.beforeAll(async () => {
  const shell = await readFile("components/dashboard/app-shell.tsx", "utf8");
  const styles = await compile(await readFile("app/globals.css", "utf8"), {
    base: process.cwd(),
    onDependency() {},
  });
  css = styles.build(
    [...shell.matchAll(/"([^"\n]+)"/g)].flatMap((match) =>
      match[1].split(/\s+/),
    ),
  );
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {AppShell} from './components/dashboard/app-shell'; createRoot(document.getElementById('root')).render(<AppShell name="Owner" email="owner@example.test" timezone="America/Los_Angeles" organization="Workspace"><main data-testid="content" style={{minHeight:2000}}><h1>Project content</h1><div data-testid="wide-table" style={{overflowX:'auto'}}><div style={{width:1600,display:'flex',justifyContent:'space-between'}}><button>First project</button><button>Last project</button></div></div><button style={{marginTop:1500}}>Bottom project</button></main></AppShell>);`,
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
        name: "test-navigation",
        setup(builder) {
          builder.onResolve(
            { filter: /^next\/(navigation|link)$/ },
            (args) => ({ path: args.path, namespace: "test-next" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "test-next" }, (args) => ({
            loader: "jsx",
            resolveDir: process.cwd(),
            contents: args.path.endsWith("navigation")
              ? 'export const usePathname=()=>"/app/projects"; export const useRouter=()=>({push(){},refresh(){}});'
              : 'import React from "react"; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}',
          }));
        },
      },
    ],
  });
  javascript = result.outputFiles[0].text;
});

for (const width of [400, 700, 1280]) {
  test(`Main navigation fills the page without covering content at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://sidebar.test/**", (route) =>
      new URL(route.request().url()).pathname === "/bundle.js"
        ? route.fulfill({ contentType: "text/javascript", body: javascript })
        : route.fulfill({
            contentType: "text/html",
            body: `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
          }),
    );
    await page.goto("https://sidebar.test/app/projects");
    const nav = page.getByRole("navigation", { name: "Main", exact: true });
    const home = await nav
      .getByRole("link", { name: "Home", exact: true })
      .boundingBox();
    const projects = await nav
      .getByRole("link", { name: "Projects", exact: true })
      .boundingBox();
    const tasks = await nav
      .getByRole("link", { name: "Actionable Tasks", exact: true })
      .boundingBox();
    const content = await page.getByTestId("content").boundingBox();
    const sidebar = await page.locator("aside").boundingBox();
    const pageHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    expect(home && projects && tasks && content).toBeTruthy();
    expect(sidebar!.height).toBeGreaterThanOrEqual(pageHeight);
    expect(projects!.y).toBeGreaterThan(home!.y);
    expect(tasks!.y).toBeGreaterThan(projects!.y);
    expect(projects!.x).toBe(home!.x);
    expect(content!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
    await expect(
      page.getByRole("button", { name: "First project", exact: true }),
    ).toBeInViewport();
    await page
      .getByRole("button", { name: "Last project", exact: true })
      .scrollIntoViewIfNeeded();
    const lastProject = await page
      .getByRole("button", { name: "Last project", exact: true })
      .boundingBox();
    expect(lastProject!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width);
    await expect(
      page.getByRole("button", { name: "Last project", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page
      .getByRole("button", { name: "Bottom project", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      nav.getByRole("link", { name: "Home", exact: true }),
    ).toBeInViewport();
    await expect(
      nav.getByRole("button", { name: "Settings", exact: true }),
    ).toBeInViewport();
    const bottomProject = await page
      .getByRole("button", { name: "Bottom project", exact: true })
      .boundingBox();
    expect(bottomProject!.x).toBeGreaterThanOrEqual(
      sidebar!.x + sidebar!.width,
    );
    await page.screenshot({ path: testInfo.outputPath("sidebar.png") });
  });
}
