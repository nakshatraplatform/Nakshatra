import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

test("Lenis spans public and authenticated routes without overflow or hydration errors", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.addCookies([themeTestCookie]);
  for (const route of ["/", "/privacy", "/demo", "/dashboard", "/account", "/brokerdesk/onboarding"]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveClass(/\blenis\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("wheel, keyboard, anchors and browser back remain usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/\blenis\b/);
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
  await page.keyboard.press("Home");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.locator('a[href="#tour-step-01"]').click();
  await expect(page).toHaveURL(/#tour-step-01$/);
  await expect(page.locator("#tour-step-01")).toBeInViewport();
  // A fresh path exercises native back restoration, rather than the hash history entry.
  await page.goto("/privacy");
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  const before = await page.evaluate(() => scrollY);
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.goBack();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(Math.min(before, 200));
});

test("editor scroll stays native while background inertia is locked", async ({ page, context }) => {
  await context.addCookies([themeTestCookie]);
  await page.goto("/dashboard?edit=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/lenis-stopped/);
  const panel = page.locator(".dashboard-editor-scroll");
  await panel.hover();
  const background = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => panel.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(background);
  await dialog.getByRole("button", { name: /Back to dashboard|^Dashboard$/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/lenis-stopped/);
});

test("reduced motion tracks wheel without an animated tail and keeps anchors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
  const settled = await page.evaluate(() => scrollY);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.evaluate(() => scrollY)).toBe(settled);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.locator('a[href="#tour-step-01"]').click();
  await expect(page.locator("#tour-step-01")).toBeInViewport();
});

test("keyboard End interrupts pending wheel momentum and reduced motion changes live", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/\blenis\b/);
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 2000);
  await page.keyboard.press("End");
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)))).toBeLessThanOrEqual(2);
  await page.evaluate(() => new Promise<void>(resolve => {
    let frames = 15;
    const step = () => { if (--frames === 0) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }));
  expect(await page.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)))).toBeLessThanOrEqual(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveClass(/\blenis\b/);
});
