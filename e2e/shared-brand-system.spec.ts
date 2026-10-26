import { expect, test, type Locator } from "@playwright/test";
import { approvedViewerCookie, publishedOwnerCookie, themeTestCookie } from "./support/theme-session.mjs";

async function contrast(locator: Locator) {
  return locator.evaluate(element => {
    const context = document.createElement("canvas").getContext("2d")!;
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
    for (const node of ancestors) {
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
    }
    const background = [...context.getImageData(0, 0, 1, 1).data];
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    const foreground = [...context.getImageData(0, 0, 1, 1).data];
    const luminance = (rgba: number[]) => rgba.slice(0, 3).map(value => {
      const c = value / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const a = luminance(background), b = luminance(foreground);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}

test("standalone and unavailable actions retain contrast on focus and hover", async ({ page, context }, testInfo) => {
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    for (const [route, name] of [["/presentation-missing-page", "Go to dashboard"], ["/verification/result", "Sign in to view result"]]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
      const action = page.getByRole("link", { name, exact: true });
      await action.focus();
      expect(await contrast(action)).toBeGreaterThanOrEqual(4.5);
      if (!testInfo.project.use.hasTouch) {
        await action.hover();
        expect(await contrast(action)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
  await context.addCookies([themeTestCookie]);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.goto(`/brokerdesk/w/wrk_${"e".repeat(32)}/customers/bcr_${"a".repeat(32)}`);
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
    for (const action of [page.getByRole("button", { name: "Try again", exact: true }), page.getByRole("link", { name: "Go home", exact: true })]) {
      await action.focus();
      expect(await contrast(action)).toBeGreaterThanOrEqual(4.5);
      if (!testInfo.project.use.hasTouch) {
        await action.hover();
        expect(await contrast(action)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/preview");
  const banner = page.locator("[data-preview-bar]:visible");
  await expect(banner).toHaveCount(1);
  await expect(banner).toBeVisible();
  await expect(banner).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(await contrast(banner)).toBeGreaterThanOrEqual(4.5);
});

test("inverse demo and landing examples retain readable text in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.goto("/");
    if (theme === "dark") await page.getByRole("switch", { name: "Dark mode", checked: false }).click();
    const enhanced = await page.evaluate(() => matchMedia("(min-width: 860px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)").matches);
    if (enhanced) {
      await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
      await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: /^04/ }).click();
      await expect(page.locator('[data-tour-step="04"]')).toHaveAttribute("data-active", "true");
    }
    const approval = page.locator(enhanced ? '[data-shelf-cover] [data-visual="approve"]' : '[class*="staticVisual"] [data-visual="approve"]').getByText("Share details", { exact: true });
    // Check the visible book illustration or the normal-flow fallback, not its hidden duplicate.
    await expect(approval).toBeVisible();
    expect(await contrast(approval)).toBeGreaterThanOrEqual(4.5);
    await page.goto("/demo");
    expect(await contrast(page.getByText("Fictional sample introduction", { exact: true }))).toBeGreaterThanOrEqual(4.5);
    if (theme === "dark") await page.evaluate(() => localStorage.clear());
  }
});

test("approved horoscope navigation remains legible on focus and hover", async ({ page, context }, testInfo) => {
  await context.addCookies([approvedViewerCookie]);
  for (const theme of ["light", "dark"]) {
    await page.goto("/");
    if (theme === "dark") await page.getByRole("switch", { name: "Dark mode", checked: false }).click();
    await page.goto("/p/e2e-portfolio-token/horoscope");
    await expect(page.getByRole("heading", { name: /Original horoscope/ })).toBeVisible();
    const back = page.getByRole("link", { name: "Back to portfolio" });
    await back.focus();
    expect(await contrast(back)).toBeGreaterThanOrEqual(4.5);
    if (!testInfo.project.use.hasTouch) {
      await back.hover();
      expect(await contrast(back)).toBeGreaterThanOrEqual(4.5);
    }
    if (theme === "dark") await page.evaluate(() => localStorage.clear());
  }
});

test("theme switches preserve link contrast on the first changed frame", async ({ page }) => {
  await page.goto("/login");
  const link = page.getByRole("link", { name: "Create an account" });
  await expect(link).toBeVisible();
  expect(await link.evaluate(el => getComputedStyle(el).transitionProperty)).not.toMatch(/all|color|background/);
  for (const theme of ["dark", "light"]) {
    // Observe the real theme button, not settled CSS after an assertion timeout.
    const result = await page.evaluate(desired => new Promise<{ ink: string; background: string }>(resolve => {
      const link = document.querySelector<HTMLAnchorElement>('a[href="/signup"]')!;
      const observer = new MutationObserver(() => {
        if (document.documentElement.dataset.appTheme !== desired) return;
        observer.disconnect();
        resolve({ ink: getComputedStyle(link).color, background: getComputedStyle(document.body).backgroundColor });
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-app-theme"] });
      document.querySelector<HTMLButtonElement>('button[role="switch"][aria-label="Dark mode"]')!.click();
    }), theme);
    const luminance = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const c = value / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const a = luminance(result.ink), b = luminance(result.background);
    expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
  }
});
