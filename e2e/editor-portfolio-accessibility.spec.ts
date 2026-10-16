import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("published horoscope status and remove action retain contrast in both themes", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/portfolio-horoscope", route => route.fulfill({ json: { horoscope: {
    id: "e2e-horoscope", portfolio_id: "e2e-portfolio", storage_path: "mock.webp",
    mime_type: "image/webp", file_extension: "webp", byte_size: 1024, language_label: null,
    page_count: null, published_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  } } }));
  await page.goto("/dashboard?edit=1");
  const editor = page.getByRole("dialog", { name: "Introduction details", exact: true });
  const sectionSelect = editor.getByRole("combobox", { name: "Go to introduction section" });
  if (await sectionSelect.isVisible()) await sectionSelect.selectOption("astrology");
  else await editor.getByRole("button", { name: /Astrology & horoscope/ }).click();
  await editor.locator('input[type="file"]').setInputFiles({ name: "mock.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  const status = editor.getByText("Published for approved viewers", { exact: true });
  const remove = editor.getByRole("button", { name: "Remove", exact: true });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await editor.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(status).toBeVisible();
    for (const element of [status, remove]) {
      const ratio = await element.evaluate(element => {
        const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const c = color.startsWith("color(srgb ") ? value : value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        let background: Element | null = element;
        while (background && getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)") background = background.parentElement;
        const a = luminance(getComputedStyle(element).color), b = luminance(getComputedStyle(background!).backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect((await remove.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("long narrative disclosure keeps prose full-width and expands without overflow", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/p/e2e-long-narrative-token");
    const opener = page.getByRole("button", { name: /^Read more:/ }).first();
    await expect(opener).toBeVisible();
    const controlledId = await opener.getAttribute("aria-controls");
    const button = page.locator(`button[aria-controls="${controlledId}"]`);
    const paragraph = page.locator(`[id="${controlledId}"]`);
    const dimensions = await paragraph.evaluate(element => ({
      prose: element.getBoundingClientRect().width,
      wrapper: element.parentElement!.getBoundingClientRect().width,
    }));
    expect(dimensions.prose).toBeGreaterThan(200);
    expect(dimensions.prose).toBeGreaterThanOrEqual(dimensions.wrapper - 1);
    await expect(paragraph).toContainText("…");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(paragraph).toHaveText("I value curiosity, kindness and time with family. ".repeat(24).trim());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  }
});

test("editor suggestions support virtual focus and dark contrast", async ({ page, context }, testInfo) => {
  await page.route("**/api/reference/location-suggestions", route => route.fulfill({ json: { options: [{
    id: "zippopotam:02108:0", label: "Boston, Massachusetts 02108", provider: "zippopotam",
    country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA",
    city: "Boston", postalCode: "02108", locationSource: "zippopotam",
  }] } }));
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Introduction details", exact: true });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await editor.getByRole("button", { name: "Switch to Dark theme" }).click();
    await editor.getByRole("button", { name: "Change", exact: true }).click();
    const city = editor.getByRole("combobox", { name: "ZIP or PIN code", exact: true });
    await city.fill("02108");
    const list = editor.getByRole("listbox", { name: "Location suggestions" });
    await expect(list.getByRole("option", { name: "Boston, Massachusetts 02108", exact: true })).toBeVisible();
    await city.press("ArrowDown");
    await expect(city).toBeFocused();
    const option = list.getByRole("option", { name: "Boston, Massachusetts 02108", exact: true });
    await expect(city).toHaveAttribute("aria-activedescendant", (await option.getAttribute("id"))!);
    const ratio = await list.evaluate(element => {
      const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const n = value / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const style = getComputedStyle(element), a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath(`city-suggestions-${theme}.png`), animations: "disabled" });
    await city.press("Enter");
    await expect(editor.getByText("Boston, Massachusetts, United States · 02108")).toBeVisible();
    await expect(editor.getByRole("button", { name: "Change", exact: true })).toBeFocused();
  }
  const sections = editor.getByRole("combobox", { name: "Go to introduction section" });
  if (await sections.isVisible()) await sections.selectOption("story");
  else await editor.getByRole("navigation", { name: "Introduction form sections" }).getByRole("button", { name: /Personal story/ }).click();
  const tags = editor.getByRole("combobox", { name: "Values that matter to you" });
  await tags.fill("Kind");
  await tags.press("ArrowDown");
  await expect(tags).toBeFocused();
  await expect(tags).toHaveAttribute("aria-activedescendant", /option-/);
  await tags.press("Enter");
  await expect(editor.getByRole("button", { name: "Remove Kindness" })).toBeVisible();
});

test("mobile chapter navigation remains reachable at 720px and below", async ({ page }) => {
  for (const width of [320, 720]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/p/e2e-portfolio-token");
    const opener = page.getByRole("button", { name: "Open introduction sections" });
    await expect(opener).toBeVisible();
    await opener.click();
    const nav = page.getByRole("navigation", { name: "Introduction quick actions" });
    await expect(nav).toBeVisible();
    for (const link of await nav.getByRole("link").all()) {
      const href = (await link.getAttribute("href"))!;
      await expect(page.locator(href)).toHaveCount(1);
    }
    await nav.getByRole("link", { name: "Family", exact: true }).click();
    await expect(page.locator("#family")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test("lightbox traps focus, inerts background and restores its trigger", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  const trigger = page.locator(".portfolio-gallery-open");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Gallery photo viewer" });
  const close = dialog.getByRole("button", { name: "Close photo and return to gallery" });
  await expect(close).toBeFocused();
  expect(await page.locator(".portfolio-root").evaluate(element => Boolean(element.closest("[inert]")))).toBe(true);
  await close.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Show next available photo" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.locator(".portfolio-root").evaluate(element => Boolean(element.closest("[inert]")))).toBe(false);
});
