import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

test("avatar exposes account actions with keyboard, outside dismissal and responsive themes", async ({ page, context }, testInfo) => {
  await context.addCookies([themeTestCookie]);
  await page.goto("/dashboard");
  const header = page.getByRole("banner");
  const avatar = header.getByLabel("Account menu");
  const settings = header.getByRole("link", { name: "Account settings" });
  const signOut = header.getByRole("button", { name: "Sign out" });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await header.getByRole("button", { name: "Switch to Dark theme" }).click();
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
