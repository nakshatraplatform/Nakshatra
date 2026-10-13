import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("sample exposes its empty-photo alternative and preloads only primary typography", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("img", { name: "Portfolio photo has not been added" })).toBeVisible();
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("print view omits interactive navigation but retains portfolio content and policies", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Portfolio help and policies" })).toBeVisible();
});

test("published owner actions belong to the link and completed liveness stays quiet", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/identity-verification/current**", route => route.fulfill({ json: {
    state: "verified", attemptId: null, deadline: null, cleanupPending: false, canResume: false, canCancel: false, canStart: false,
  } }));
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    const sharing = page.getByRole("region", { name: "Introduction link", exact: true });
    for (const name of ["Edit details", "Share on WhatsApp", "Copy link"]) {
      await expect(sharing.getByRole("button", { name, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(1);
    }
    await expect(page.getByText("Introduction link active", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Liveness check", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), animations: "disabled" });
    await sharing.getByText("Manage link", { exact: true }).click();
    await expect(sharing.getByRole("button", { name: "Rotate link", exact: true })).toBeVisible();
  }
});

test("viewer chrome has predictable sections, compact header and readable policies", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1024, 1440]) {
    for (const token of ["e2e-portfolio-token", "e2e-dark-portfolio-token"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/p/${token}`);
      const header = page.getByRole("banner");
      const menu = header.getByRole("button");
      const interest = header.getByRole("link", { name: "Show Interest", exact: true });
      await expect(interest).toBeVisible();
      const headerBox = (await header.boundingBox())!;
      expect(headerBox.height).toBeLessThanOrEqual(80);
      expect((await interest.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (width < 1100) {
        await menu.focus();
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("aria-expanded", "true");
      }
      const nav = page.getByRole("navigation", { name: "Introduction quick actions" });
      await expect(nav.getByRole("link", { name: "Education & work", exact: true })).toHaveAttribute("href", "#journey");
      await nav.getByRole("link", { name: "Education & work", exact: true }).click();
      await expect(page).toHaveURL(/#journey$/);
      expect((await page.locator("#journey").boundingBox())!.y).toBeGreaterThanOrEqual(headerBox.height - 1);
      if (width < 1100) {
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await menu.click();
        await page.keyboard.press("Escape");
        await expect(menu).toBeFocused();
        await expect(menu).toHaveAttribute("aria-expanded", "false");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`navigation-${width}-${token}.png`), animations: "disabled" });
      const footer = page.getByRole("contentinfo");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer.getByRole("navigation", { name: "Portfolio help and policies" }).getByRole("link")).toHaveCount(4);
      expect(await footer.evaluate(el => Number.parseFloat(getComputedStyle(el).paddingBottom))).toBeLessThanOrEqual(32);
      await page.screenshot({ path: testInfo.outputPath(`footer-${width}-${token}.png`), animations: "disabled" });
      await footer.getByRole("link", { name: "Back to top", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
    }
  }
});
