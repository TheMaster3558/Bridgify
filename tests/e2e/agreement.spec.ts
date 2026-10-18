import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import type { Bundle } from "../../lib/domain/types";

// Isolated UI transport fixture. Database/RLS/job semantics are tested in PGlite;
// this harness exercises the production wizard components, not live Auth/Gemini.
test.use({ actionTimeout: 5000 });
let javascript: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ProjectWizard} from './components/setup/project-wizard';
      const root=createRoot(document.getElementById('root')); window.__refresh=async()=>{const bundle=await fetch('/fixture-state').then(r=>r.json()); const step=Number(new URL(location.href).searchParams.get('step')||bundle?.project?.setup_step||1); root.render(<ProjectWizard key={(bundle?.project.id||'new')+'-'+step+'-'+bundle?.documents[0]?.status} bundle={bundle||undefined} step={step}/>);}; window.__navigate=(url)=>{history.pushState({},'',url);window.__refresh();};window.__refresh();`,
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
              ? "export const useRouter=()=>({push:window.__navigate,refresh:window.__refresh});"
              : "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props} onClick={e=>{e.preventDefault();window.__navigate(href)}}>{children}</a>}",
          }));
        },
      },
    ],
  });
  javascript = result.outputFiles[0].text;
});

test("Basics → paste → review/edit → refresh → confirm → next step", async ({
  page,
}) => {
  page.on("pageerror", (e) => console.log("UI error:", e.message));
  let bundle: Bundle | null = null;
  let importedText = "";
  let failNextImport = false;
  let analysisCalls = 0;
  let releaseAnalysis!: () => void;
  const firstAnalysis = new Promise<void>((resolve) => {
    releaseAnalysis = resolve;
  });
  const documentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    spanId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const text = "Landing page included. USD 200.00. Two revisions.";
  await page.route("https://agreement.test/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const json = (data: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/bundle.js")
      return route.fulfill({
        contentType: "text/javascript",
        body: javascript,
      });
    if (url.pathname === "/fixture-state") return json(bundle);
    if (url.pathname === "/api/v1/projects") {
      bundle = {
        project: {
          ...request.postDataJSON(),
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          status: "draft",
          version: 1,
          setup_step: 2,
          scope_version: 0,
          policy_version: 0,
          people: null,
          policy: null,
          activation_cutoff: null,
          disclosure_at: null,
          updated_at: new Date().toISOString(),
        },
        documents: [],
        spans: [],
        scope: [],
        members: [],
        binding: null,
        invitations: [],
      };
      return json({ data: { project: bundle.project } });
    }
    if (url.pathname.endsWith("/documents")) {
      importedText = request.postData() || "";
      bundle!.project.version++;
      bundle!.project.setup_step = 2;
      bundle!.project.scope_version = 0;
      bundle!.documents = [
        {
          id: documentId,
          status: failNextImport ? "failed" : "ready",
          kind: "text",
          error: failNextImport ? "Extraction unavailable. Retry." : null,
          original_text: text,
          review_draft: null,
          review_version: 0,
          extraction: {
            model: "gemini-3.1-flash-lite",
            fallback_from: "gemini-3.8-flash",
            terms: [
              {
                kind: "inclusion",
                text: "Landing page",
                span_id: spanId,
                quote: "Landing page included",
              },
            ],
            commercial: {
              price: {
                amount_cents: 20000,
                currency: "USD",
                span_id: spanId,
                quote: "USD 200.00",
              },
              due_date: { value: null, span_id: null, quote: null },
              revision: {
                allowance: 2,
                unit: "ambiguous",
                span_id: spanId,
                quote: "Two revisions",
              },
            },
            warnings: ["Two revisions is ambiguous"],
          },
        },
      ];
      bundle!.project.current_agreement_document_id = documentId;
      bundle!.spans = [
        {
          id: spanId,
          document_id: documentId,
          page: 1,
          start_offset: 0,
          end_offset: text.length,
          text,
        },
      ];
      analysisCalls++;
      if (analysisCalls === 1) await firstAnalysis;
      return json({
        data: {
          project: bundle!.project,
          documentId,
          analysis: { status: failNextImport ? "failed" : "ready" },
        },
      });
    }
    if (url.pathname.endsWith("/agreement")) {
      const input = request.postDataJSON();
      if (input.action === "retry") {
        bundle!.documents[0].status = "ready";
        bundle!.documents[0].error = null;
        return json({ data: { project: bundle!.project } });
      }
      bundle!.documents[0].review_draft = input.review;
      bundle!.documents[0].review_version++;
      return json({
        data: { reviewVersion: bundle!.documents[0].review_version },
      });
    }
    if (url.pathname.endsWith("/integrations/photon/users"))
      return json({ data: { ok: true, users: [] } });
    if (url.pathname.endsWith("/scope/confirm")) {
      const input = request.postDataJSON();
      expect(input.review.commercial.revision.unit).toBe("rounds");
      expect(input.review.price_choice).toBe("agreement");
      bundle!.project.setup_step = 3;
      bundle!.project.scope_version = 1;
      return json({ data: { project: bundle!.project } });
    }
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    });
  });
  await page.goto("https://agreement.test/app/projects/new");
  await page.getByLabel("Project name", { exact: true }).fill("Client site");
  await page.getByLabel("Client name", { exact: true }).fill("Client");
  await page
    .getByLabel("Original agreed price", { exact: true })
    .fill("100.00");
  await page.getByRole("button", { name: "Save basics & continue" }).click();
  await page.getByLabel("Paste the complete agreement").fill(text);
  await page
    .getByRole("button", { name: "Upload / analyze agreement", exact: true })
    .click();
  await expect(
    page.getByText("Analyzing agreement with Gemini…", { exact: true }),
  ).toBeVisible();
  releaseAnalysis();
  await expect(page.getByText("Review ready", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Analyzed with gemini-3.1-flash-lite.", { exact: false }),
  ).toBeVisible();
  expect(importedText).toContain(text);
  await page
    .getByRole("textbox", { name: "Reviewed wording", exact: true })
    .fill("One landing page");
  await page
    .getByLabel("Revision unit", { exact: true })
    .selectOption("rounds");
  await page
    .getByLabel("Resolution 1", { exact: true })
    .fill("Confirmed with owner: two rounds");
  await page
    .getByLabel("Resolve price mismatch", { exact: true })
    .selectOption("agreement");
  await page
    .getByRole("button", { name: "Save review draft", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Reviewed wording", exact: true }),
  ).toHaveValue("One landing page");
  await expect(page.getByLabel("Revision unit", { exact: true })).toHaveValue(
    "rounds",
  );
  await expect(
    page.getByLabel("Resolve price mismatch", { exact: true }),
  ).toHaveValue("agreement");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm baseline & continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "People & chat", exact: true }),
  ).toBeVisible();
  expect(bundle!.project.status).toBe("draft");
  await page.getByRole("link", { name: "2. Agreement", exact: true }).click();
  failNextImport = true;
  await page
    .getByLabel("Or upload a text PDF (5 MB, 50 pages maximum)")
    .setInputFiles({
      name: "agreement.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\nBrowser submission fixture; parser is tested separately.",
      ),
    });
  await page
    .getByRole("button", {
      name: "Upload replacement / analyze new text",
      exact: true,
    })
    .click();
  await expect.poll(() => importedText).toContain('filename="agreement.pdf"');
  await expect(page.getByRole("alert")).toHaveText(
    "Extraction unavailable. Retry.",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Retry extraction", exact: true })
    .click();
  await expect(page.getByText("Review ready", { exact: false })).toBeVisible();
});
