import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

test.beforeEach(async ({ context }) => { await context.addCookies([themeTestCookie]); });

test("deletion confirmation contains keyboard focus and restores it without a request", async ({ page }) => {
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Delete account", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Schedule account deletion?" });
  const close = dialog.getByRole("button", { name: "Close deletion confirmation" });
  await expect(close).toBeFocused();
  expect(await trigger.evaluate(element => Boolean(element.closest("[inert]")))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByLabel(/Type DELETE/)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await trigger.evaluate(element => Boolean(element.closest("[inert]")))).toBe(false);
});

test("editor Escape preserves the dirty-draft decision in reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard?edit=1");
  const dialog = page.getByRole("dialog", { name: "Portfolio details" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.getByLabel("First name", { exact: true }).fill("Unsaved");
  page.once("dialog", dialog => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("Escape closes an expanded editor dropdown before the editor", async ({ page }) => {
  await page.goto("/dashboard?edit=1");
  const dialog = page.getByRole("dialog", { name: "Portfolio details" });
  const mobileSection = dialog.getByRole("combobox", { name: "Go to portfolio section" });
  if (await mobileSection.isVisible()) {
    await mobileSection.selectOption({ label: "2. Personal story & lifestyle" });
  } else {
    await dialog.getByRole("navigation", { name: "Portfolio form sections" }).getByRole("button", { name: /Personal story & lifestyle/ }).click();
  }
  const languages = dialog.getByRole("combobox", { name: "Languages", exact: true });
  await languages.focus();
  await expect(languages).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("listbox", { name: "Languages suggestions" }).getByRole("option").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(languages).toHaveAttribute("aria-expanded", "false");
  await expect(languages).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
