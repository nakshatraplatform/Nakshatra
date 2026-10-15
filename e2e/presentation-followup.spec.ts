import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

const publicRoutes = ["/", "/landing/story", "/landing/family", "/landing/control", "/login", "/signup", "/reset-password", "/privacy", "/terms", "/trust", "/about", "/received-a-link", "/demo", "/verification/result", "/verify/unavailable", "/p/e2e-expired-token", "/invite/unavailable", "/join/team", "/join/customer"];
const workspace = `/brokerdesk/w/wrk_${"e".repeat(32)}`;
const authenticatedRoutes = ["/dashboard", "/account", "/brokers", "/brokerdesk/onboarding", `${workspace}/dashboard`, `${workspace}/customers`, `${workspace}/settings/team`];

for (const route of [...publicRoutes, ...authenticatedRoutes]) {
  test(`presentation fonts and flat-surface text contrast: ${route}`, async ({ page, context }, testInfo) => {
    if (authenticatedRoutes.includes(route)) await context.addCookies([themeTestCookie]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => localStorage.setItem("nakshatra-app-theme", value), theme);
      await page.goto(route);
      if (route === "/invite/unavailable") await expect(page).toHaveURL(/\/signup$/);
      await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
      await expect(page.locator("main").first()).toBeVisible();
      if (route === `${workspace}/dashboard`) await expect(page.getByRole("heading", { name: "Fixture agency", exact: true })).toBeVisible();
      if (route === `${workspace}/customers`) await expect(page.getByRole("heading", { name: "People you represent", exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const audit = await page.evaluate(() => {
        const fontFailures: string[] = [], contrastFailures: string[] = [];
        let checked = 0, nonFlat = 0;
        const context = document.createElement("canvas").getContext("2d")!;
        const luminance = (rgba: Uint8ClampedArray) => [...rgba].slice(0, 3).map(value => {
          const c = value / 255;
          return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        for (const element of document.querySelectorAll<HTMLElement>("body *")) {
          if (element.closest("svg, script, style, nextjs-portal, [aria-hidden=true]") || !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || !element.getClientRects().length) continue;
          const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim();
          if (!text) continue;
          const style = getComputedStyle(element);
          const expected = element.closest("h1,h2,h3,h4,h5,h6") ? "Plus Jakarta Sans" : "Inter";
          if (!style.fontFamily.includes(expected)) fontFailures.push(`${element.tagName} ${text.slice(0, 65)}: ${style.fontFamily}; expected ${expected}`);
          const ancestors: Element[] = [];
          for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
          // Gradients/photos and disabled/translucent content need visual inspection,
          // not a false flat-background contrast calculation.
          if (element.closest(":disabled, [aria-disabled=true]") || ancestors.some(node => getComputedStyle(node).backgroundImage !== "none" || Number(getComputedStyle(node).opacity) < 1)) { nonFlat++; continue; }
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = "white";
          context.fillRect(0, 0, 1, 1);
          for (const node of ancestors) {
            context.fillStyle = getComputedStyle(node).backgroundColor;
            context.fillRect(0, 0, 1, 1);
          }
          const background = luminance(context.getImageData(0, 0, 1, 1).data);
          context.fillStyle = style.color;
          context.fillRect(0, 0, 1, 1);
          const foreground = luminance(context.getImageData(0, 0, 1, 1).data);
          const ratio = (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
          if (ratio < (large ? 3 : 4.5)) contrastFailures.push(`${element.tagName} ${text.slice(0, 65)}: ${ratio.toFixed(2)} (${style.color})`);
          checked++;
        }
        return { fontFailures, contrastFailures, checked, nonFlat, url: location.pathname, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      await testInfo.attach(`${theme}-audit`, { body: JSON.stringify(audit, null, 2), contentType: "application/json" });
      expect(audit.fontFailures, `${route} ${theme}`).toEqual([]);
      expect(audit.contrastFailures, `${route} ${theme}`).toEqual([]);
      expect(audit.checked).toBeGreaterThan(0);
      expect(audit.overflow, `${route} ${theme}`).toBeLessThanOrEqual(1);
      if (["/", "/privacy", "/account", "/brokerdesk/onboarding"].includes(route)) await page.screenshot({ path: testInfo.outputPath(`${theme}.png`), fullPage: true, animations: "disabled" });
    }
  });
}
