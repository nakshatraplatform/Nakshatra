import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

test("activated family dashboard shows metadata and navigates older pages", async ({ page, context }) => {
  await context.addCookies([themeTestCookie]);
  await page.goto("/family");
  await expect(page.getByRole("heading", { name: "Your family introductions" })).toBeVisible();
  await expect(page.getByText("Supporting Family fixture candidate")).toBeVisible();
  await expect(page.getByText("Awaiting responses", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /interested|decline|accept/i })).toHaveCount(0);
  await page.getByRole("link", { name: "Open profile" }).click();
  await expect(page.getByRole("heading", { name: "Broker Standard Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: /interested|decline|accept/i })).toHaveCount(0);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  await page.getByRole("link", { name: "Back to family introductions" }).click();
  await page.getByRole("link", { name: "Older introductions" }).click();
  await expect(page.getByText("Response period ended")).toBeVisible();
  await expect(page.getByRole("link", { name: "Older introductions" })).toHaveCount(0);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/family?limit=1");
  await expect(page.getByText("Supporting " + "A".repeat(180))).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("signed-out visitors need a live account for the family dashboard", async ({ page }) => {
  await page.goto("/family");
  await expect(page).toHaveURL(/\/login\?redirect=%2Ffamily/);
  await expect(page.getByText("Supporting Family fixture candidate")).toHaveCount(0);
});
