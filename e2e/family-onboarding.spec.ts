import { expect, test } from "@playwright/test";

test("family invitation clears its fragment and continues through Google-only sign-in", async ({ page }) => {
  await page.route("**/api/v1/family-invitations/exchange", route => route.fulfill({ json: { ready: true } }));
  await page.route("**/api/v1/family-invitations/accept", route => route.fulfill({ status: 401, json: { available: false } }));
  await page.goto(`/join/family#token=${"z".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Support your family member on VivIntro" })).toBeVisible();
  await expect(page).toHaveURL(/\/join\/family$/);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept family access" }).click();
  await page.getByRole("link", { name: "Sign in securely" }).click();
  await expect(page.getByRole("heading", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
});

test("family setup without an invitation stays neutral and regular sign-in retains password access", async ({ page }) => {
  await page.route("**/api/v1/family-invitations/exchange", route => route.fulfill({ json: { ready: false } }));
  await page.goto("/join/family");
  await expect(page.getByRole("heading", { name: "Ask the candidate for a new invitation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept family access" })).toHaveCount(0);
  await page.goto("/login");
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});
