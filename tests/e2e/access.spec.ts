import { test, expect } from "@playwright/test";
test("sign-in uses email and password without seeded credentials", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await expect(
    page.getByRole("button", { name: "Email sign-in link" }),
  ).toHaveCount(0);
});
test("signup requires matching password fields and has no verification step", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("get started immediately", { exact: false }),
  ).toBeVisible();
});
test("private owner routes require authentication", async ({ page }) => {
  await page.goto("/app/projects/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fprojects%2Fnew/);
});
test("retired client pages expose no login or proposal terms", async ({page}) => {
  for (const path of ["/access","/invitations/old","/proposals/55555555-5555-4555-8555-555555555555?revision=7"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("SECRET OWNER NOTE")).toHaveCount(0);
  }
});
test("expired password reset links offer recovery without asking for a password", async ({
  page,
}) => {
  await page.goto("/login?mode=recover&error=expired&next=%2Fapp");
  await expect(
    page.getByRole("status").filter({ hasText: "invalid or expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send password reset link" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});
test("signup submits passwords and preserves an owner project destination", async ({
  page,
}) => {
  const next = "/app/projects/55555555-5555-4555-8555-555555555555";
  let submitted: Record<string, string> | undefined;
  await page.route("**/api/auth/password", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Unable to create your account. Try signing in or resetting your password.",
      }),
    });
  });
  await page.goto(`/login?mode=signup&next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("example password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Unable to create your account",
  );
  expect(submitted).toEqual({
    action: "signup",
    email: "owner@example.test",
    password: "example password",
    password_confirmation: "example password",
    next,
  });
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "owner@example.test",
  );
});
