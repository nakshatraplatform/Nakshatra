import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("landing labels and keyboard indicators meet contrast in both themes", async ({ page }) => {
  for (const route of ["/", "/landing/control", "/landing/story"]) {
    await page.goto(route);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("button", { name: `Switch to ${theme === "dark" ? "Dark" : "Light"} theme` }).click();
      await expect(page.locator("main").getByRole("link", { name: "View a sample introduction", exact: true }).first()).toHaveCSS("background-color", "rgb(35, 75, 104)");
      const measurements = await page.locator('[class*="controlGrid"] article > span, [class*="introduction"] strong, [class*="samplesHeading"] > p, [class*="tourNavigation"] a > span').evaluateAll(elements => {
        const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const c = color.startsWith("color(srgb ") ? value : value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        return elements.map(element => {
          let background: Element | null = element;
          while (background && getComputedStyle(background).backgroundColor === "rgba(0, 0, 0, 0)") background = background.parentElement;
          const style = getComputedStyle(element);
          const a = luminance(style.color), b = luminance(getComputedStyle(background!).backgroundColor);
          return { text: element.textContent, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), size: parseFloat(style.fontSize) };
        });
      });
      expect(measurements.length).toBeGreaterThan(5);
      for (const item of measurements) {
        expect(item.ratio, `${route} ${theme}: ${item.text}`).toBeGreaterThanOrEqual(4.5);
        expect(item.size).toBeGreaterThanOrEqual(12);
      }
      await page.keyboard.press("Tab");
      await page.getByRole("link", { name: "Sign in", exact: true }).first().focus();
      await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toHaveCSS("outline-style", "solid");
      const focusRatio = await page.getByRole("link", { name: "Sign in", exact: true }).first().evaluate(element => {
        const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const c = color.startsWith("color(srgb ") ? value : value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const a = luminance(getComputedStyle(element).outlineColor);
        const b = luminance(getComputedStyle(element.closest("[data-landing-variant]")!).backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(focusRatio).toBeGreaterThanOrEqual(3);
    }
  }
});

test("owner explanatory note passes text contrast on the actual portfolio surface", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/p/e2e-portfolio-token");
  const note = page.locator(".interest-owner-action > span");
  await expect(note).toBeVisible();
  const ratio = await note.evaluate(element => {
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
});

test("tall tour spacing is bounded instead of growing with viewport height", async ({ page }) => {
  for (const height of [1200, 1600]) {
    await page.setViewportSize({ width: 1440, height });
    await page.goto("/");
    const card = page.locator("#tour-step-01");
    await expect(card).toHaveCSS("position", "sticky");
    expect(await card.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(1000);
    await expect(card).toHaveCSS("margin-bottom", "32px");
  }
});

test("portaled brand uses the portfolio appearance with the opposite app theme", async ({ page }) => {
  for (const [token, appearance, appTheme] of [["e2e-portfolio-token", "light", "dark"], ["e2e-dark-portfolio-token", "dark", "light"]]) {
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), appTheme);
    await page.goto(`/p/${token}`);
    await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const image = dialog.locator('[data-brand-variant="stacked"] img');
    await expect(image).toHaveCount(1);
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", new RegExp(`stacked-${appearance === "dark" ? "reverse" : "primary"}\\.svg`));
    await expect(dialog).toHaveCSS("color-scheme", appearance);
    await expect(dialog).toHaveCSS("background-color", appearance === "dark" ? "rgb(27, 41, 50)" : "rgb(255, 253, 248)");
    await dialog.getByRole("button", { name: "Continue as a new visitor" }).click();
    const searchCountry = dialog.getByLabel("Your location search country");
    await expect(searchCountry.locator("..")).toHaveCSS("color", appearance === "dark" ? "rgb(237, 242, 239)" : "rgb(36, 52, 67)");
  }
});
