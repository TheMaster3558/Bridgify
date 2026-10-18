import { test, expect, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
import type { Bundle } from "../../lib/domain/types";

// Isolated UI transport fixture. Database/RLS/job semantics are tested in PGlite;
// this harness exercises the production wizard components, not live Auth/Gemini.
test.use({ actionTimeout: 5000 });
let javascript: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ProjectWizard} from './components/setup/project-wizard';import {ProjectsList} from './components/projects/projects-list';
      const root=createRoot(document.getElementById('root')); window.__refresh=async()=>{const bundle=await fetch('/fixture-state').then(r=>r.json()); const step=Number(new URL(location.href).searchParams.get('step')||bundle?.project?.setup_step||1); if(location.pathname==='/app/projects'){root.render(<ProjectsList workspaceProjects={bundle?[bundle.project]:[]}/>);return;}root.render(<ProjectWizard key={(bundle?.project.id||'new')+'-'+step+'-'+bundle?.documents[0]?.status} bundle={bundle||undefined} step={step}/>);}; window.__navigate=(url)=>{history.pushState({},'',url);window.__refresh();};window.__refresh();`,
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
        binding: null,
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
  await expect(
    page.getByRole("button", { name: "Save basics & continue" }),
  ).toBeDisabled();
  await page.getByLabel("Project name", { exact: true }).fill("Client site");
  await page.getByLabel("Client name", { exact: true }).fill("Client");
  await page
    .getByLabel("Original agreed price", { exact: true })
    .fill("100.00");
  await expect(
    page.getByRole("button", { name: "2. Agreement", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "3. People & chat", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "2. Agreement", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Upload / analyze agreement",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Paste the complete agreement").fill(text);
  await page
    .getByRole("button", { name: "Upload / analyze agreement", exact: true })
    .click();
  await expect(
    page.getByText("Analyzing agreement…", { exact: true }),
  ).toBeVisible();
  releaseAnalysis();
  await expect(page.getByText("Review ready", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Included work" }),
  ).toBeVisible();
  expect(importedText).toContain(text);
  await expect(
    page.getByRole("button", { name: "Confirm agreement & continue" }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("What does that number cover?", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("option", { name: "not_specified", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: "ambiguous", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Agreement price", { exact: true }).fill("200.001");
  await expect(
    page.getByLabel("Agreement price", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Agreement price", { exact: true }).fill("200.00");
  await page
    .getByRole("textbox", { name: "Reviewed wording", exact: true })
    .fill("One landing page");
  await page
    .getByLabel("What does that number cover?", { exact: true })
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
  await expect(
    page.getByLabel("What does that number cover?", { exact: true }),
  ).toHaveValue("rounds");
  await expect(
    page.getByLabel("Resolve price mismatch", { exact: true }),
  ).toHaveValue("agreement");
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "3. People & chat", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "3. People & chat", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "People & chat", exact: true }),
  ).toBeVisible();
  expect(bundle!.project.status).toBe("draft");
  await page.getByRole("button", { name: "2. Agreement", exact: true }).click();
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

function setupBundle(): Bundle {
  return {
    project: {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Client site",
      client_name: "Client",
      original_amount_cents: 10000,
      currency: "USD",
      timezone: "America/Los_Angeles",
      agreed_due_date: null,
      status: "draft",
      version: 1,
      setup_step: 5,
      scope_version: 1,
      policy_version: 1,
      activation_cutoff: null,
      disclosure_at: null,
      updated_at: new Date().toISOString(),
      people: {
        channel: "photon_shared",
        photon_user_id: "user-1",
        client_name: "Client",
        client_email: null,
        client_sender_id: "+12065550002",
        agent_number: null,
        instance_id: "photon-project",
        chat_guid: "any;-;+12065550002",
      },
      policy: {
        mode: "review_only",
        allowance_mode: "per_request",
        allowance: 2,
        targets: ["home.heading"],
        exclusions: "No new pages",
        operations: [],
        max_open_tasks: 10,
        notifications: "dashboard",
      },
    },
    documents: [],
    spans: [],
    scope: [],
    binding: {
      test_state: "sent",
      verified_at: new Date().toISOString(),
      disclosed_message_guid: "message-1",
      hold_reason: null,
      webhook_verified_at: null,
      introduction_text: "Hello! I organize requests for your project.",
    },
  };
}
async function fixture(
  page: Page,
  bundle: Bundle | null,
  step: number,
  handle?: (route: Route) => Promise<boolean>,
) {
  await page.route("https://agreement.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/bundle.js")
      return route.fulfill({
        contentType: "text/javascript",
        body: javascript,
      });
    if (path === "/fixture-state")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(bundle),
      });
    if (handle && (await handle(route))) return;
    if (path.endsWith("/integrations/photon/users"))
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ok: true,
            users: [
              { id: "user-1", name: "Client", phoneNumber: "+12065550002" },
            ],
          },
        }),
      });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    });
  });
  await page.goto(
    `https://agreement.test/app/projects/${bundle?.project.id || "new"}/setup?step=${step}`,
  );
}

test("Basics validates each field and maps server errors back to the input", async ({
  page,
}) => {
  let submissions = 0;
  await fixture(page, null, 1, async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/v1/projects")
      return false;
    submissions++;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "VALIDATION",
          message: "name: invalid",
          fieldErrors: {
            fieldErrors: { name: ["Choose a different project name."] },
          },
        },
      }),
    });
    return true;
  });
  const save = page.getByRole("button", { name: "Save basics & continue" });
  await expect(save).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "2. Agreement", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Project name", { exact: true }).fill("   ");
  await page.getByLabel("Client name", { exact: true }).fill("Client");
  await expect(
    page.getByLabel("Project name", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Project name", { exact: true }).fill("Website");
  await page.getByLabel("Original agreed price", { exact: true }).fill("1.234");
  await page.getByLabel("Currency", { exact: true }).fill("ZZZ");
  await page.getByLabel("Project time zone", { exact: true }).fill("Mars/City");
  await page.getByLabel("Client name", { exact: true }).focus();
  await expect(save).toBeDisabled();
  await expect(
    page.getByLabel("Original agreed price", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Currency", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByLabel("Project time zone", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(submissions).toBe(0);
  await page
    .getByLabel("Original agreed price", { exact: true })
    .fill("100.29");
  await page.getByLabel("Currency", { exact: true }).fill("usd");
  await page
    .getByLabel("Project time zone", { exact: true })
    .fill("America/Los_Angeles");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByLabel("Project name", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Choose a different project name."),
  ).toBeVisible();
  expect(submissions).toBe(1);
});

test("Agreement upload rejects empty, non-PDF and conflicting sources before submission", async ({
  page,
}) => {
  await fixture(page, setupBundle(), 2);
  const upload = page.getByRole("button", {
    name: "Upload / analyze agreement",
  });
  await expect(upload).toBeDisabled();
  const file = page.getByLabel("Or upload a text PDF (5 MB, 50 pages maximum)");
  await file.setInputFiles({
    name: "contract.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contract"),
  });
  await page.getByLabel("Paste the complete agreement").focus();
  await expect(file).toHaveAttribute("aria-invalid", "true");
  await expect(upload).toBeDisabled();
  await file.setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(""),
  });
  await expect(upload).toBeDisabled();
  await expect(
    page.getByText("This PDF is empty.", { exact: false }),
  ).toBeVisible();
  await file.setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  });
  await expect(upload).toBeEnabled();
  await page
    .getByLabel("Paste the complete agreement")
    .fill("One page included.");
  await expect(upload).toBeDisabled();
  await file.setInputFiles([]);
  await expect(upload).toBeEnabled();
});

test("The introduction is editable, required and sent as entered", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.binding = null;
  let sent = "";
  await fixture(page, bundle, 3, async (route) => {
    if (!new URL(route.request().url()).pathname.endsWith("/chat-test"))
      return false;
    sent = route.request().postDataJSON().introduction;
    bundle.binding = {
      test_state: "sent",
      verified_at: new Date().toISOString(),
      disclosed_message_guid: "message-1",
      webhook_verified_at: null,
      hold_reason: null,
      introduction_text: sent,
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: { message: "Introduction sent." } }),
    });
    return true;
  });
  const message = page.getByLabel("Introduction message"),
    send = page.getByRole("button", { name: "Send introduction text" });
  await expect(
    page.getByRole("button", { name: "Continue to automation" }),
  ).toBeDisabled();
  await message.fill("   ");
  await expect(send).toBeDisabled();
  await expect(message).toHaveAttribute("aria-invalid", "true");
  await message.fill(
    "Hi, Alex! I help organize requests for your website project. Ask the owner to pause me at any time.",
  );
  await send.click();
  await expect.poll(() => sent).toContain("Hi, Alex!");
  await expect(
    page.getByRole("button", { name: "Continue to automation" }),
  ).toBeEnabled();
  await page.reload();
  await expect(message).toHaveValue(sent);
});

test("Automation shows readable advanced settings and blocks invalid permissions", async ({
  page,
}) => {
  await fixture(page, setupBundle(), 4);
  const save = page.getByRole("button", { name: "Save automation & continue" });
  await expect(save).toBeEnabled();
  await expect(
    page.getByText("Advanced settings", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Pages or elements covered by these permissions"),
  ).not.toBeVisible();
  await page
    .getByLabel("How should the assistant handle requests?")
    .selectOption("enabled");
  await expect(save).toBeEnabled();
  await expect(
    page.getByLabel("Pages or elements covered by these permissions"),
  ).not.toBeVisible();
  await page
    .getByText("Advanced settings · optional limits", {
      exact: true,
    })
    .click();
  await expect(page.locator('input[name="operations"]')).toHaveCount(0);
  await expect(save).toBeEnabled();
  await page.getByLabel("Included change requests", { exact: true }).fill("");
  await page.getByLabel("Maximum automatic tasks open at once").fill("11");
  await page
    .getByLabel("Pages or elements covered by these permissions")
    .fill("x".repeat(201));
  await page.getByLabel("What always needs your approval?").focus();
  await expect(save).toBeDisabled();
  await expect(
    page.getByLabel("Maximum automatic tasks open at once"),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Pages or elements covered by these permissions"),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Included change requests", { exact: true }).fill("2");
  await page.getByLabel("Maximum automatic tasks open at once").fill("5");
  await page
    .getByLabel("Pages or elements covered by these permissions")
    .fill("");
  await page
    .getByLabel("How are included changes counted?")
    .selectOption("manual_rounds");
  await page.getByLabel("What always needs your approval?").focus();
  await expect(save).toBeDisabled();
  await expect(
    page.getByLabel("How are included changes counted?"),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("How should the assistant handle requests?")
    .selectOption("review_only");
  await expect(save).toBeEnabled();
});

test("Activation requires consent and completed setup", async ({ page }) => {
  const bundle = setupBundle();
  await fixture(page, bundle, 5);
  const activate = page.getByRole("button", {
    name: "Activate in review-only mode",
  });
  await expect(activate).toBeEnabled();
  await activate.click();
  await expect(page.getByRole("alert")).toContainText(
    "Confirm that your client received the introduction",
  );
  await page.getByRole("checkbox").check();
  await expect(activate).toBeEnabled();
  await expect(
    page.getByText("Hello! I organize requests for your project."),
  ).toBeVisible();
  bundle.project.scope_version = 0;
  await page.reload();
  await page.getByRole("checkbox").check();
  await expect(activate).toBeEnabled();
  await activate.click();
  await expect(page.getByRole("alert")).toContainText(
    "Review and confirm the agreement",
  );
});

test("review identifies a missing introduction and cannot activate around it", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.binding = null;
  let submissions = 0;
  await fixture(page, bundle, 5, async (route) => {
    if (route.request().method() !== "PATCH") return false;
    submissions++;
    await route.fulfill({ json: { data: { project: bundle.project } } });
    return true;
  });
  const fix = page.getByRole("link", {
    name: "Send the assistant introduction for the current client connection in People & chat.",
  });
  await expect(fix).toHaveAttribute(
    "href",
    `/app/projects/${bundle.project.id}/setup?step=3`,
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Activate in review-only mode" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Send the assistant introduction",
  );
  expect(submissions).toBe(0);
  await fix.click();
  await expect(page).toHaveURL(/step=3$/);
});

test("New automation defaults save through the header without opening advanced settings", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.project.policy = null;
  bundle.project.policy_version = 0;
  bundle.project.setup_step = 4;
  let payload: Record<string, unknown> | undefined;
  await fixture(page, bundle, 4, async (route) => {
    if (route.request().method() !== "PATCH") return false;
    const input = route.request().postDataJSON();
    expect(input.section).toBe("policy");
    payload = input.payload;
    bundle.project.policy = input.payload;
    bundle.project.policy_version = 1;
    bundle.project.setup_step = 5;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: { project: bundle.project } }),
    });
    return true;
  });
  await expect(
    page.getByRole("button", { name: "Save automation & continue" }),
  ).toBeEnabled();
  const nextHeader = page.getByRole("button", {
    name: "5. Review & activate",
    exact: true,
  });
  await expect(nextHeader).toBeEnabled();
  await expect(
    page.getByLabel("Pages or elements covered by these permissions"),
  ).not.toBeVisible();
  await nextHeader.click();
  await expect(
    page.getByRole("heading", { name: "Review & activate", exact: true }),
  ).toBeVisible();
  expect(payload).toMatchObject({
    mode: "review_only",
    targets: [],
    allowance: 0,
    operations: [],
    permission_mode: "guidance",
    max_open_tasks: 10,
  });
});

test("automatic setup saves without advanced targets and activates with confirmed client consent", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.project.policy = null;
  bundle.project.policy_version = 0;
  bundle.project.setup_step = 4;
  const sections: string[] = [];
  await fixture(page, bundle, 4, async (route) => {
    if (route.request().method() !== "PATCH") return false;
    const body = route.request().postDataJSON();
    sections.push(body.section);
    if (body.section === "policy") {
      expect(body.payload).toMatchObject({
        permission_mode: "guidance",
        operations: [],
        targets: [],
        mode: "enabled",
      });
      bundle.project.policy = body.payload;
      bundle.project.policy_version = 1;
      bundle.project.setup_step = 5;
    } else {
      expect(body.payload).toMatchObject({ status: "active", disclosed: true });
      bundle.project.status = "active";
      bundle.project.activation_cutoff = new Date().toISOString();
    }
    bundle.project.version++;
    await route.fulfill({ json: { data: { project: bundle.project } } });
    return true;
  });
  await page
    .getByLabel("How should the assistant handle requests?")
    .selectOption("enabled");
  await page.getByLabel("Included change requests", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Save automation & continue" })
    .click();
  await expect(
    page.getByRole("button", { name: "Activate automation", exact: true }),
  ).toBeEnabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Activate automation", exact: true })
    .click();
  await expect(page).toHaveURL(
    `https://agreement.test/app/projects/${bundle.project.id}`,
  );
  expect(sections).toEqual(["policy", "lifecycle"]);
});

test("Forward headers track unsaved validity instead of previously completed setup steps", async ({
  page,
}) => {
  const bundle = setupBundle();
  await fixture(page, bundle, 4);
  const header = page.getByRole("button", {
    name: "5. Review & activate",
    exact: true,
  });
  await expect(header).toBeEnabled();
  await page.getByLabel("Included change requests", { exact: true }).fill("");
  await expect(header).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save automation & continue" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "1. Basics", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "2. Agreement", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "5. Review & activate", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Project name", { exact: true }).fill(" ");
  await expect(
    page.getByRole("button", { name: "2. Agreement", exact: true }),
  ).toBeDisabled();
});

test("People headers cannot skip an unsent or uncertain introduction", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.binding = null;
  await fixture(page, bundle, 3);
  await expect(
    page.getByRole("button", { name: "4. Automation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "5. Review & activate", exact: true }),
  ).toBeDisabled();
  bundle.binding = {
    test_state: "unknown",
    verified_at: null,
    disclosed_message_guid: null,
    webhook_verified_at: null,
    hold_reason: "Check delivery with your client first.",
  };
  await page.reload();
  await expect(
    page.getByRole("button", { name: "4. Automation", exact: true }),
  ).toBeDisabled();
});

test("completed manual-approval setup redirects to overview and appears Active in Projects", async ({
  page,
}) => {
  const bundle = setupBundle();
  await fixture(page, bundle, 5, async (route) => {
    if (route.request().method() !== "PATCH") return false;
    const body = route.request().postDataJSON();
    expect(body.section).toBe("lifecycle");
    expect(body.payload.status).toBe("review_only");
    bundle.project.status = "review_only";
    bundle.project.activation_cutoff = new Date().toISOString();
    bundle.project.version++;
    await route.fulfill({ json: { data: { project: bundle.project } } });
    return true;
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Activate in review-only mode" })
    .click();
  await expect(page).toHaveURL(
    `https://agreement.test/app/projects/${bundle.project.id}`,
  );
  await page.goto("https://agreement.test/app/projects");
  const row = page.getByRole("row").filter({ hasText: bundle.project.name });
  await expect(row.getByText("active", { exact: true })).toBeVisible();
  await expect(row.getByText("Review only", { exact: true })).toBeVisible();
  await expect(
    row.getByRole("link", { name: "Open", exact: true }),
  ).toHaveAttribute("href", `/app/projects/${bundle.project.id}`);
  await page.getByLabel("Filter by state").selectOption("active");
  await expect(row).toBeVisible();
  await page.getByLabel("Filter by state").selectOption("draft");
  await expect(row).toHaveCount(0);
});

test("leaving setup midway or at review without activation keeps the project Draft", async ({
  page,
}) => {
  const bundle = setupBundle();
  await fixture(page, bundle, 4);
  await page.goto("https://agreement.test/app/projects");
  const row = page.getByRole("row").filter({ hasText: bundle.project.name });
  await expect(row.getByText("draft", { exact: true })).toBeVisible();
  await expect(row.getByRole("link", { name: "Resume setup" })).toBeVisible();
  bundle.project.setup_step = 5;
  await page.reload();
  await expect(row.getByText("draft", { exact: true })).toBeVisible();
});

test("failed activation remains on review and keeps the stored project draft", async ({
  page,
}) => {
  const bundle = setupBundle();
  await fixture(page, bundle, 5, async (route) => {
    if (route.request().method() !== "PATCH") return false;
    await route.fulfill({
      status: 503,
      json: { error: { message: "Activation unavailable. Retry." } },
    });
    return true;
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Activate in review-only mode" })
    .click();
  await expect(page.getByText("Activation unavailable. Retry.")).toBeVisible();
  await expect(page).toHaveURL(/setup\?step=5$/);
  await page.goto("https://agreement.test/app/projects");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: bundle.project.name })
      .getByText("draft", { exact: true }),
  ).toBeVisible();
});

test("project deletion requires the exact name, supports cancel and preserves errors before a successful delete", async ({
  page,
}) => {
  const bundle = setupBundle();
  let calls = 0;
  await fixture(page, bundle, 3, async (route) => {
    if (route.request().method() !== "DELETE") return false;
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      name: bundle.project.name,
    });
    await route.fulfill(
      calls === 1
        ? {
            status: 503,
            json: { error: { message: "Delete unavailable. Retry." } },
          }
        : { json: { data: { deleted: true, storageCleanupPending: true } } },
    );
    return true;
  });
  await page.goto("https://agreement.test/app/projects");
  const trigger = page.getByRole("button", {
    name: `Project actions for ${bundle.project.name}`,
    exact: true,
  });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog"),
    confirm = dialog.getByRole("button", {
      name: "Delete project permanently",
    });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByLabel("Type the project name to confirm")
    .fill("wrong name");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(calls).toBe(0);
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await page
    .getByRole("menuitem", { name: "Delete", exact: true })
    .press("Enter");
  await dialog
    .getByLabel("Type the project name to confirm")
    .fill(bundle.project.name);
  await confirm.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Delete unavailable. Retry.",
  );
  await confirm.click();
  await expect(
    dialog.getByRole("heading", { name: "Project deleted" }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "The project was deleted. Private agreement file cleanup is pending.",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Back to projects" }).click();
  await expect(page).toHaveURL("https://agreement.test/app/projects");
});

test("Add user creates in Photon, selects the returned user and persists through the existing connect action", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.project.people = null;
  const added = {
    id: "new-photon-user",
    name: "Ada Lovelace",
    email: "ada@example.test",
    phoneNumber: "+14155550100",
    assignedPhoneNumber: "+14155550200",
  };
  let created = false,
    creates = 0,
    connections = 0;
  await fixture(page, bundle, 3, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/integrations/photon/users")) {
      if (route.request().method() === "POST") {
        creates++;
        expect(route.request().postDataJSON()).toEqual({
          projectId: bundle.project.id,
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          phoneNumber: added.phoneNumber,
        });
        created = true;
        await route.fulfill({
          json: { data: { user: added, existing: false } },
        });
      } else
        await route.fulfill({
          json: { data: { ok: true, users: created ? [added] : [] } },
        });
      return true;
    }
    if (path.endsWith("/chat-binding")) {
      connections++;
      expect(route.request().postDataJSON().people).toEqual({
        photon_user_id: added.id,
      });
      bundle.project.people = {
        channel: "photon_shared",
        photon_user_id: added.id,
        client_name: added.name,
        client_email: added.email,
        client_sender_id: added.phoneNumber,
        agent_number: added.assignedPhoneNumber,
        instance_id: "photon-project",
        chat_guid: `any;-;${added.phoneNumber}`,
      };
      await route.fulfill({ json: { data: { project: bundle.project } } });
      return true;
    }
    return false;
  });
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  const form = page.getByRole("form", { name: "Add a Photon user" });
  const submit = form.getByRole("button", { name: "Create Photon user" });
  await expect(submit).toBeDisabled();
  await form.getByLabel("First name", { exact: true }).fill("Ada");
  await form.getByLabel("Last name (optional)").fill("Lovelace");
  await form.getByLabel("Email", { exact: true }).fill("ada@example.test");
  await form.getByLabel("Phone number", { exact: true }).fill("4155550100");
  await expect(submit).toBeDisabled();
  await form
    .getByLabel("Phone number", { exact: true })
    .fill("+1 (415) 555-0100");
  await submit.click();
  await expect(page.getByRole("radio", { name: /Ada Lovelace/ })).toBeChecked();
  await expect(page.getByText(/Photon user added and selected/)).toBeVisible();
  expect(creates).toBe(1);
  expect(connections).toBe(0);
  await page
    .getByRole("button", { name: "Connect this client", exact: true })
    .click();
  await expect.poll(() => connections).toBe(1);
  await page.reload();
  await expect(page.getByText("Connected:", { exact: false })).toContainText(
    "Ada Lovelace",
  );
});

test("Add user preserves form details after failure and reuses an existing returned user without duplicates", async ({
  page,
}) => {
  const bundle = setupBundle();
  let creates = 0;
  const existing = {
    id: "user-1",
    name: "Existing Profile",
    email: "original@example.test",
    phoneNumber: "+12065550002",
    assignedPhoneNumber: null,
  };
  await fixture(page, bundle, 3, async (route) => {
    if (
      !new URL(route.request().url()).pathname.endsWith(
        "/integrations/photon/users",
      )
    )
      return false;
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: { ok: true, users: [existing] } } });
      return true;
    }
    creates++;
    await route.fulfill(
      creates === 1
        ? {
            status: 503,
            json: {
              error: {
                message:
                  "Photon did not confirm user creation. Retry with the same phone number.",
              },
            },
          }
        : { json: { data: { user: existing, existing: true } } },
    );
    return true;
  });
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  const form = page.getByRole("form", { name: "Add a Photon user" });
  await form.getByLabel("First name", { exact: true }).fill("New name");
  await form
    .getByLabel("Email", { exact: true })
    .fill("different@example.test");
  await form
    .getByLabel("Phone number", { exact: true })
    .fill(existing.phoneNumber);
  await form.getByRole("button", { name: "Create Photon user" }).click();
  await expect(form.getByRole("alert")).toContainText("Photon did not confirm");
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue(
    "different@example.test",
  );
  await form.getByRole("button", { name: "Create Photon user" }).click();
  await expect(page.getByRole("radio")).toHaveCount(1);
  await expect(
    page.getByRole("radio", { name: /Existing Profile/ }),
  ).toBeChecked();
  await expect(
    page.getByText(/This phone number is already in Photon/),
  ).toBeVisible();
  expect(creates).toBe(2);
});

test("Photon user deletion requires confirmation, handles cancel/failure and clears an unlinked selection after success", async ({
  page,
}) => {
  const bundle = setupBundle();
  bundle.project.people = null;
  const user = {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    name: "Unused Contact",
    email: "unused@example.test",
    phoneNumber: "+14155550800",
    assignedPhoneNumber: "+14155550801",
  };
  let deleted = false,
    calls = 0;
  await fixture(page, bundle, 3, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/integrations/photon/users")) {
      await route.fulfill({
        json: { data: { ok: true, users: deleted ? [] : [user] } },
      });
      return true;
    }
    if (path.endsWith(`/users/${user.id}`)) {
      expect(route.request().method()).toBe("DELETE");
      expect(route.request().postDataJSON()).toEqual({
        projectId: bundle.project.id,
        phoneNumber: user.phoneNumber,
      });
      calls++;
      if (calls === 1)
        await route.fulfill({
          status: 503,
          json: { error: { message: "Deletion unconfirmed. Retry." } },
        });
      else {
        deleted = true;
        await route.fulfill({
          json: { data: { deleted: true, userId: user.id } },
        });
      }
      return true;
    }
    return false;
  });
  await page.getByRole("radio", { name: /Unused Contact/ }).check();
  const menu = page.getByRole("button", {
    name: "User actions for Unused Contact",
    exact: true,
  });
  await menu.click();
  await page
    .getByRole("menuitem", { name: "Delete user", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    confirm = dialog.getByRole("button", {
      name: "Delete from Photon",
      exact: true,
    });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(calls).toBe(0);
  await expect(menu).toBeFocused();
  await menu.press("Enter");
  await page
    .getByRole("menuitem", { name: "Delete user", exact: true })
    .press("Enter");
  await dialog.getByRole("textbox").fill("wrong");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox").fill(user.phoneNumber);
  await confirm.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Deletion unconfirmed. Retry.",
  );
  // The modal correctly hides background roles; the selected user remains in the DOM.
  await expect(
    page.locator(`input[type="radio"][value="${user.id}"]`),
  ).toBeChecked();
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect this client", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("radio")).toHaveCount(0);
  expect(calls).toBe(2);
});

test("the current connected Photon client cannot be deleted through its menu", async ({
  page,
}) => {
  const bundle = setupBundle();
  await fixture(page, bundle, 3);
  await page
    .getByRole("button", { name: "User actions for Client", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Delete user", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText("Switch this project's client before deleting this user.", {
      exact: true,
    }),
  ).toBeVisible();
});
