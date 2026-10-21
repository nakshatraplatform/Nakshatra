import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

test("server-rendered auth fields wait for hydration before accepting answers", async ({ page }) => {
  let release!: () => void;
  const scripts = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/_next/**/*.js*", async route => { await scripts; await route.continue(); });
  try {
    await page.goto("/signup", { waitUntil: "commit" });
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeDisabled();
    release();
    await expect(page.getByLabel("Email address")).toBeEnabled();
    await page.getByLabel("Email address").fill("early@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Wedding2026");
    await expect(page.getByLabel("Email address")).toHaveValue("early@example.test");
  } finally { release(); }
});

for (const theme of ["light", "dark"]) {
  test(`auth text enlargement preserves actual content bounds (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), theme);
    for (const path of ["/login", "/signup", "/reset-password"]) {
      await page.goto(path);
      await expect(page.locator(".account-panel")).toBeVisible();
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      const clipped = await page.locator(".account-shell").evaluate(shell => {
        const candidates = [...shell.querySelectorAll<HTMLElement>("input, button, a, h1, .account-copy, .account-field-help")];
        return candidates.filter(el => el.getClientRects().length && !el.closest("[hidden]")).flatMap(el => {
          const box = el.getBoundingClientRect();
          return box.left < -1 || box.right > innerWidth + 1 || el.scrollHeight > el.clientHeight + 2 && el.tagName === "BUTTON"
            ? [{ tag: el.tagName, text: el.textContent?.slice(0, 45), left: box.left, right: box.right }] : [];
        });
      });
      expect(clipped, path).toEqual([]);
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
  });
}

test("mobile account inputs and standalone alternate actions have usable sizing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toHaveCSS("font-size", "16px");
  const alternate = page.getByRole("link", { name: "Create an account", exact: true });
  expect((await alternate.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

for (const theme of ["light", "dark"]) {
  test(`enlarged verification code shows all six digits (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), theme);
    await page.route("**/api/auth/start", route => route.fulfill({ json: { verificationRequired: true, email: "example@example.test" } }));
    await page.goto("/signup");
    await page.getByLabel("Email address").fill("example@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Wedding2026");
    await page.getByRole("button", { name: "Create account" }).click();
    const code = page.getByLabel("Verification code");
    await code.fill("123456");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const size = await code.evaluate((el: HTMLInputElement) => ({
      clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
      height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight),
    }));
    expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth + 1);
    expect(size.height).toBeGreaterThanOrEqual(size.lineHeight);
    await expect(code).toHaveValue("123456");
  });
}

for (const theme of ["light", "dark"]) {
  for (const viewport of [{ width: 320, height: 850 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    test(`interest verification labels reflow without clipping (${theme}, ${viewport.width}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.route("**/api/auth/start", route => route.fulfill({ json: { sent: true } }));
      await page.route("**/api/auth/verify", route => route.fulfill({ status: 400, json: { error: "That code has expired. Send another code." } }));
      // Portfolio appearance owns the portaled dialog, independently of app theme.
      await page.goto(`/p/${theme === "dark" ? "e2e-dark-portfolio-token" : "e2e-portfolio-token"}`);
      await page.getByRole("button", { name: "Show interest", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Continue as a new visitor" }).click();
      await dialog.getByLabel("Full name", { exact: true }).fill("Mira Rao");
      await dialog.getByLabel("Who are you contacting for?").selectOption("daughter");
      await dialog.getByRole("textbox", { name: "Phone number", exact: true }).fill("6175550123");
      await dialog.getByLabel("Email address", { exact: true }).fill("mira@example.test");
      const location = dialog.getByRole("group", { name: "Your location", exact: true });
      await location.getByRole("button", { name: "Enter location manually" }).click();
      await location.getByLabel("Country", { exact: true }).selectOption("US");
      await location.getByLabel("State", { exact: true }).selectOption("US-MA");
      await location.getByLabel("City", { exact: true }).fill("Quincy");
      await location.getByLabel("ZIP or PIN code", { exact: true }).fill("02171");
      await dialog.getByLabel("Candidate’s full name").fill("Anika Rao");
      await dialog.getByLabel("Family context", { exact: true }).fill("Our family values kindness, honesty and mutual respect.");
      await dialog.getByRole("button", { name: "Verify email and continue" }).click();
      await dialog.getByLabel("Six-digit code").fill("123456");
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.evaluate(() => document.fonts.ready);

      for (const name of ["Verify email", "Change details", "Close interest form"]) {
        const action = dialog.getByRole("button", { name, exact: true });
        await action.scrollIntoViewIfNeeded();
        const fit = await action.evaluate(el => {
          const box = el.getBoundingClientRect();
          const modal = el.closest('[role="dialog"]')!.getBoundingClientRect();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const text = [];
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            for (const rect of range.getClientRects()) text.push({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
          }
          return { client: el.clientHeight, scroll: el.scrollHeight, text,
            box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
            modal: { top: Math.max(0, modal.top), bottom: Math.min(innerHeight, modal.bottom) } };
        });
        expect(fit.scroll, `${name}: content height`).toBeLessThanOrEqual(fit.client + 1);
        expect(fit.box.top).toBeGreaterThanOrEqual(fit.modal.top - 1);
        expect(fit.box.bottom).toBeLessThanOrEqual(fit.modal.bottom + 1);
        for (const rect of fit.text) {
          expect(rect.top, `${name}: label top`).toBeGreaterThanOrEqual(fit.box.top - 1);
          expect(rect.bottom, `${name}: label bottom`).toBeLessThanOrEqual(fit.box.bottom + 1);
          expect(rect.left, `${name}: label left`).toBeGreaterThanOrEqual(fit.box.left - 1);
          expect(rect.right, `${name}: label right`).toBeLessThanOrEqual(fit.box.right + 1);
        }
      }
      const verify = dialog.getByRole("button", { name: "Verify email", exact: true });
      await verify.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("interest-verification-200.png"), animations: "disabled" });
      await verify.click();
      await expect(dialog.getByRole("alert")).toContainText("That code has expired");
      await expect(dialog.getByLabel("Six-digit code")).toBeFocused();
      await dialog.getByRole("button", { name: "Change details" }).click();
      await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue("Mira Rao");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
}

test("pending interest is dismissible without allowing a duplicate or a surprise redirect", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  let release!: () => void;
  let requests = 0;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/start", async route => {
    requests++;
    await wait;
    await route.fulfill({ json: { url: "https://accounts.google.test/oauth" } });
  });
  await page.getByRole("button", { name: "Show interest" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("button", { name: "Connecting to Google" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  release();
  await page.getByRole("button", { name: "Show interest" }).click();
  await expect(page.getByRole("button", { name: "Continue to Google" })).toBeVisible();
  expect(requests).toBe(1);
  expect(new URL(page.url()).pathname).toBe("/p/e2e-portfolio-token");
});

test("a stalled handoff settles without retrying and remains locally recoverable", async ({ page }) => {
  await page.goto("/p/e2e-portfolio-token");
  await page.clock.install();
  let requests = 0;
  await page.route("**/api/auth/start", () => { requests++; });
  await page.getByRole("button", { name: "Show interest" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("button", { name: "Connecting to Google" })).toBeDisabled();
  await page.clock.fastForward(20_001);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("may have completed");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Close interest form" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("shared materials honor independent contrast and transparency preferences", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Transparency emulation uses Chromium CDP; cross-engine layout is tested separately.");
  const cdp = await context.newCDPSession(page);
  await context.addCookies([themeTestCookie]);
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), theme);
    for (const path of ["/login", "/account", "/p/e2e-portfolio-token"]) {
      await page.goto(path);
      const header = page.locator("header").first();
      for (const preference of [{ name: "prefers-reduced-transparency", value: "reduce" }, { name: "prefers-contrast", value: "more" }]) {
        await cdp.send("Emulation.setEmulatedMedia", { features: [preference] });
        expect(await page.evaluate(preference => matchMedia(`(${preference.name}: ${preference.value})`).matches, preference)).toBe(true);
        const surface = await header.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, blur: getComputedStyle(el).backdropFilter }));
        expect(surface.background).not.toMatch(/rgba|color\(.*\/\s*0\./);
        expect(surface.blur, JSON.stringify({ path, theme, preference, surface })).toBe("none");
        expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);
      }
      await cdp.send("Emulation.setEmulatedMedia", { features: [] });
    }
  }
  await cdp.detach();
});
