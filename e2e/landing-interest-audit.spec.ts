import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("landing labels and keyboard indicators meet contrast in both themes", async ({ page }) => {
  for (const route of ["/", "/landing/control", "/landing/story"]) {
    await page.goto(route);
    for (const theme of ["light", "dark"]) {
      if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("switch", { name: "Dark mode", checked: theme !== "dark" }).click();
      await expect(page.locator("main").getByRole("link", { name: "Create your Vivara", exact: true }).first()).toHaveCSS("background-color", "rgb(35, 75, 104)");
      const measurements = await page.locator('#product-story article p, #product-story dt, #product-story dd, nav[aria-label="Guided tour steps"] a > span').evaluateAll(elements => {
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
    // Geometry assertions require the enhanced layout, not its pre-hydration fallback.
    await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: /^01/ }).click();
    const book = page.locator('[data-tour-step="01"]');
    await expect(book).toHaveAttribute("data-active", "true");
    await expect(page.locator("[data-shelf-scene]")).toHaveCSS("position", "sticky");
    expect(await book.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(600);
    await expect(book.locator("h3")).toBeInViewport();
    await expect(book.locator("[data-shelf-paper] li").last()).toBeInViewport();
  }
});

test("portaled brand uses the portfolio appearance with the opposite app theme", async ({ page }) => {
  for (const [token, appearance, appTheme] of [["e2e-portfolio-token", "light", "dark"], ["e2e-dark-portfolio-token", "dark", "light"]]) {
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), appTheme);
    await page.goto(`/p/${token}`);
    await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
    const dialog = page.getByRole("dialog");
    // Desktop context and mobile header placements are CSS-exclusive, but both
    // must select artwork from the portal appearance rather than the app theme.
    const artwork = dialog.locator('[data-brand-variant="stacked"] img');
    await expect(artwork).toHaveCount(2);
    for (const placement of await artwork.all()) {
      await expect(placement).toHaveAttribute("src", new RegExp(`stacked-${appearance === "dark" ? "reverse" : "primary"}\\.svg`));
    }
    const image = dialog.locator('[data-brand-variant="stacked"] img:visible');
    await expect(image).toHaveCount(1);
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", new RegExp(`stacked-${appearance === "dark" ? "reverse" : "primary"}\\.svg`));
    await expect(dialog).toHaveCSS("color-scheme", appearance);
    await expect(dialog).toHaveCSS("background-color", appearance === "dark" ? "rgb(27, 41, 50)" : "rgb(255, 253, 248)");
    await dialog.getByRole("button", { name: "Continue as a new visitor" }).click();
    const searchCountry = dialog.getByRole("group", { name: "Your location", exact: true }).getByRole("combobox", { name: "Country", exact: true });
    await expect(searchCountry.locator("..")).toHaveCSS("color", appearance === "dark" ? "rgb(237, 242, 239)" : "rgb(36, 52, 67)");
  }
});
