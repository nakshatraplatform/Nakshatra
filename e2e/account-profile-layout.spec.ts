import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

test("account names and sign-in details remain usable at narrow and wide widths", async ({ page, context }, testInfo) => {
  await context.addCookies([themeTestCookie]);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Your account profile" })).toBeVisible();
    await page.getByLabel("First name", { exact: true }).fill("Rahul");
    await page.getByLabel("Last name", { exact: true }).fill("Ranganatha");
    await expect(page.getByRole("button", { name: "Save names" })).toBeEnabled();
    await expect(page.getByText("Linked sign-in methods", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete account", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`account-${width}.png`), fullPage: true });
  }
});
