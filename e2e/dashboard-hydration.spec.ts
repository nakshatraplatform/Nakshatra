import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test.use({ timezoneId: "America/Los_Angeles" });

test("dashboard hydrates request dates in a different viewer timezone", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review requests", exact: true }).click();
  await expect(page.getByText("Oct 3 · Verified email", { exact: true })).toBeVisible();
  // Interaction proves hydration completed before inspecting recoverable React errors.
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Introduction details", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
