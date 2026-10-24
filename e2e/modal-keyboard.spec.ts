import { expect, test } from "@playwright/test";
import { publishedOwnerCookie, themeTestCookie } from "./support/theme-session.mjs";

test.beforeEach(async ({ context }) => { await context.addCookies([themeTestCookie]); });

test("privacy help preserves the editor after a failed autosave", async ({ page }) => {
  let saves = 0;
  await page.route("**/api/dashboard", async route => {
    if (route.request().method() !== "PUT") return route.continue();
    saves += 1;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "DASHBOARD_SAVE_FAILED", error: "Save unavailable" }) });
  });
  await page.goto("/dashboard?edit=1");
  const editor = page.getByRole("dialog", { name: "Introduction details" });
  await expect(editor.getByRole("heading", { name: "Introduction details" })).toBeFocused();
  const firstName = editor.getByLabel("First name", { exact: true });
  await firstName.fill("Unsaved privacy help");
  await expect.poll(() => saves).toBeGreaterThan(0);
  await expect(editor.getByText("Changes not saved", { exact: true })).toBeVisible();
  const [help] = await Promise.all([
    page.waitForEvent("popup"),
    editor.getByRole("link", { name: "Location search privacy (opens in a new tab)" }).click(),
  ]);
  await help.waitForURL("**/privacy#location-search");
  await expect(editor).toBeVisible();
  await expect(firstName).toHaveValue("Unsaved privacy help");
  await expect(page).toHaveURL(/\/dashboard\?edit=1$/);
  await help.close();
});

test("deletion confirmation contains keyboard focus and restores it without a request", async ({ page }) => {
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Delete account", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Schedule account deletion?" });
  const close = dialog.getByRole("button", { name: "Close deletion confirmation" });
  await expect(dialog.getByRole("heading", { name: "Schedule account deletion?" })).toBeFocused();
  await page.keyboard.press("Tab");
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
  const dialog = page.getByRole("dialog", { name: "Introduction details" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  const heading = dialog.getByRole("heading", { name: "Introduction details" });
  await expect(heading).toBeFocused();
  // Basics now ends with persistent Continue; Review is primary only on the last section.
  const lastAction = dialog.locator(".dashboard-editor-footer").getByRole("button", { name: /^Continue:/ });
  await page.keyboard.press("Shift+Tab");
  await expect(lastAction).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("switch", { name: "Dark mode" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(lastAction).toBeFocused();
  await heading.focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("switch", { name: "Dark mode" })).toBeFocused();
  await page.getByLabel("First name", { exact: true }).fill("Unsaved");
  page.once("dialog", dialog => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("First name", { exact: true })).toHaveValue("Unsaved");
  page.once("dialog", dialog => dialog.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("Escape closes an expanded editor dropdown before the editor", async ({ page, context }) => {
  // Story navigation now requires valid Basics; exercise Escape, not that separate guard.
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/dashboard?edit=1");
  const dialog = page.getByRole("dialog", { name: "Introduction details" });
  await expect(dialog).toBeVisible();
  const mobileSection = dialog.getByRole("combobox", { name: "Go to introduction section" });
  if (await mobileSection.isVisible()) {
    await mobileSection.selectOption("story");
  } else {
    await dialog.getByRole("navigation", { name: "Introduction form sections" }).getByRole("button", { name: /Personal story & lifestyle/ }).click();
  }
  const languages = dialog.getByRole("combobox", { name: "Languages", exact: true });
  await languages.focus();
  await expect(languages).toHaveAttribute("aria-expanded", "true");
  // Main now uses aria-activedescendant: options are intentionally outside Tab order.
  // Exercise the defensive option-focus path without changing that keyboard model.
  const option = dialog.getByRole("listbox", { name: "Languages suggestions" }).getByRole("option").first();
  await option.evaluate(element => (element as HTMLElement).focus());
  await expect(option).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(languages).toHaveAttribute("aria-expanded", "false");
  await expect(languages).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
