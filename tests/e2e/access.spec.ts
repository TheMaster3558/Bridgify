import { test, expect } from "@playwright/test";
test("a new owner sees a real account entry instead of seeded credentials", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in or create your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
});
test("private owner routes require authentication", async ({ page }) => {
  await page.goto("/app/projects/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fprojects%2Fnew/);
});
test("proposal navigation preserves the exact revision before authentication", async ({
  page,
}) => {
  await page.goto("/proposals/55555555-5555-4555-8555-555555555555?revision=7");
  await expect(page).toHaveURL(
    /\/login\?next=%2Fproposals%2F55555555-5555-4555-8555-555555555555%3Frevision%3D7/,
  );
  await expect(page.getByText("SECRET OWNER NOTE")).toHaveCount(0);
});
test("expired authentication links have a neutral recovery state", async ({
  page,
}) => {
  await page.goto("/login?error=expired&next=%2Fapp");
  await expect(
    page.getByRole("alert").filter({ hasText: "invalid or expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email sign-in link" }),
  ).toBeVisible();
});
