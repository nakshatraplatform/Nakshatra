import { expect, test } from "@playwright/test";
import { publishedOwnerCookie, themeTestCookie } from "./support/theme-session.mjs";

test("avatar exposes account actions with keyboard, outside dismissal and responsive themes", async ({ page, context }, testInfo) => {
  await context.addCookies([themeTestCookie]);
  await page.goto("/dashboard");
  const header = page.getByRole("banner");
  const avatar = header.getByLabel("Account menu");
  const settings = header.getByRole("link", { name: "Account settings" });
  const signOut = header.getByRole("button", { name: "Sign out" });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await header.getByRole("switch", { name: "Dark mode", checked: false }).click();
    await expect(avatar).toBeVisible();
    await expect(settings).not.toBeVisible();
    await expect(signOut).not.toBeVisible();
    await avatar.focus();
    await page.keyboard.press("Enter");
    await expect(settings).toBeVisible();
    await expect(signOut).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await expect(signOut).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(settings).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(avatar).toBeFocused();
    await expect(settings).not.toBeVisible();
    await page.keyboard.press("Space");
    await expect(settings).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`avatar-menu-${theme}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const box = await header.locator('details > div').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await signOut.focus();
    await page.keyboard.press("Tab");
    await expect(settings).not.toBeVisible();
    await avatar.click();
    // The popup covers the heading on phones; use the clear viewport edge.
    await page.mouse.click(4, page.viewportSize()!.height - 4);
    await expect(settings).not.toBeVisible();
  }
  await avatar.click();
  await settings.click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
});

test("theme slider sits between Dashboard and avatar and retains its saved state", async ({ page, context }, testInfo) => {
  await context.addCookies([themeTestCookie]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  const header = page.getByRole("banner");
  const toggle = header.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).not.toBeChecked();
  await expect(toggle.locator(".app-theme-sun")).toBeVisible();
  await expect(toggle.locator(".app-theme-moon")).not.toBeVisible();
  await expect(toggle).toHaveCSS("width", "48px");
  await expect(toggle).toHaveCSS("height", "44px");
  await expect(toggle.locator(".app-theme-track")).toHaveCSS("height", "28px");
  const dashboardBox = await header.getByRole("link", { name: "Dashboard", exact: true }).boundingBox();
  const toggleBox = await toggle.boundingBox();
  const avatarBox = await header.getByLabel("Account menu").boundingBox();
  expect(dashboardBox!.x + dashboardBox!.width).toBeLessThan(toggleBox!.x);
  expect(toggleBox!.x + toggleBox!.width).toBeLessThan(avatarBox!.x);
  await expect(header.locator('a[href="/brokers"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("theme-slider-light.png") });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(toggle.locator(".app-theme-moon")).toBeVisible();
  await expect(toggle.locator(".app-theme-thumb")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 20, 0)");
  await page.reload();
  await expect(toggle).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("theme-slider-dark.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(toggle.locator(".app-theme-thumb")).toHaveCSS("transition-duration", "0s");
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(toggle.locator(".app-theme-thumb")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
});


test("account identity uses the owner's first and last name on every customer page", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  for (const route of ["/dashboard", "/account", "/brokers"]) {
    await page.goto(route);
    const header = page.getByRole("banner");
    await header.getByLabel("Account menu").click();
    await expect(header.locator("details strong")).toHaveText("Aditi Rao");
    await expect(header.getByRole("link", { name: "Account settings" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Sign out" })).toBeEnabled();
    await expect(header.getByText("Your account", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
