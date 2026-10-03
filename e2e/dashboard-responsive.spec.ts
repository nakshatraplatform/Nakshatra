import { expect, test } from "@playwright/test";
import { dashboardTestCookie, themeTestCookie } from "./support/theme-session.mjs";

test("private dashboard remains navigable from small phones through desktop", async ({ page, context }) => {
  await context.addCookies([themeTestCookie]);

  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
    await expect(page.locator("#main-content")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    const menu = page.locator(".dashboard-mobile-menu");
    if (width <= 720) {
      await expect(menu).toBeVisible();
      await menu.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(menu.getByRole("link", { name: "My brokers" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Account and privacy" })).toBeVisible();
      await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Switch to Dark theme" })).toBeVisible();
    } else {
      await expect(menu).toBeHidden();
      await expect(page.getByRole("link", { name: "My brokers" })).toBeVisible();
    }
  }
});

test("published dashboard keeps every overview value and sharing control readable", async ({ page, context }, testInfo) => {
  await context.addCookies([dashboardTestCookie]);
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Your introduction is live." })).toBeVisible();
    const cards = page.locator(".dashboard-stat-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(1)).toContainText("Active until you unpublish");
    await expect(page.getByRole("button", { name: "Share on WhatsApp" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rotate link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview public Introduction" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview Complete Portfolio" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await cards.nth(1).evaluate((card) => {
      const status = card.querySelector("p");
      return Boolean(status && status.scrollWidth <= status.clientWidth + 1);
    })).toBe(true);
    if (width === 320 || width === 768) {
      await page.screenshot({ path: testInfo.outputPath(`published-dashboard-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
});
