import { expect, test } from "@playwright/test";

test("landing page explains the product and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Design your vocal tone");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("the dashboard requires sign-in", async ({ page }) => {
  await page.goto("/dashboard/grit-lab");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
});

test("sign-up validates before contacting the server", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
});

test.describe("with a live Neon Auth project", () => {
  test.skip(!process.env.E2E_AUTH, "Set E2E_AUTH=1 (and .env.local) to run the full auth flow.");

  test("sign up, open Grit Lab, play a tone, sign out", async ({ page }) => {
    const email = `e2e+${Date.now()}@example.com`;
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("E2E Singer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: "Grit Lab" }).first().click();
    await expect(page.getByRole("heading", { name: "Melody studio" })).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: /E2E Singer/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
  });
});
