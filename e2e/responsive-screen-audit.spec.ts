import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { publishedOwnerCookie, themeTestCookie } from "./support/theme-session.mjs";

// Layout widths are CSS pixels, not a claim of physical-device testing.
const viewports = [
  { width: 320, height: 700 }, { width: 390, height: 844 },
  { width: 932, height: 430 }, { width: 768, height: 1024 },
  { width: 1024, height: 768 }, { width: 1440, height: 900 },
  { width: 1920, height: 1080 }, { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];
const workspace = `/brokerdesk/w/wrk_${"e".repeat(32)}`;
const screens: { path: string; authenticated?: boolean; state?: string }[] = [
  ...["/", "/landing/story", "/landing/control", "/landing/family", "/login", "/signup",
    "/reset-password", "/waitlist", "/privacy", "/terms", "/trust", "/about", "/received-a-link",
    "/demo", "/p/e2e-portfolio-token", "/p/e2e-dark-portfolio-token", "/p/e2e-private-token",
    "/p/e2e-expired-token", "/verification/result", "/verify/unavailable", "/join/customer", "/join/team",
    "/access/11111111-1111-4111-8111-111111111111", "/invite/unavailable"]
    .map(path => ({ path })),
  ...["/dashboard", "/edit", "/account", "/brokers", "/preview", "/approved-preview",
    "/brokerdesk", "/brokerdesk/onboarding", "/brokerdesk/security/mfa",
    `${workspace}/dashboard`, `${workspace}/customers`, `${workspace}/settings/team`]
    .map(path => ({ path, authenticated: true })),
  { path: `${workspace}/customers/rel_${"f".repeat(32)}`, authenticated: true, state: "unavailable relationship only" },
  { path: `/introductions/int_${"a".repeat(32)}`, authenticated: true, state: "unavailable introduction only" },
];
const loadedHeadings: Record<string, string> = {
  "/account": "Account settings",
  "/brokerdesk/onboarding": "Tell us about your business",
  [`${workspace}/dashboard`]: "Fixture agency",
  [`${workspace}/customers`]: "People you represent",
  [`${workspace}/settings/team`]: "People who work with you",
};

async function layout(page: Page, scope: Locator = page.locator("body")) {
  return scope.evaluate(root => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none"
        && !element.closest("[inert], [aria-hidden=true]");
    };
    const fields = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type=hidden]), select, textarea")].filter(visible);
    const label = (field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) =>
      field.getAttribute("aria-label") || field.getAttribute("aria-labelledby") || [...(field.labels ?? [])].map(item => item.textContent?.trim()).join(" ");
    return {
      pathname: location.pathname,
      deviceScaleFactor: devicePixelRatio,
      overflow: document.documentElement.scrollWidth - innerWidth,
      fields: fields.length,
      unnamed: fields.filter(field => !label(field)).map(field => field.outerHTML.slice(0, 240)),
      outside: fields.filter(field => {
        const box = field.getBoundingClientRect();
        return box.left < -1 || box.right > innerWidth + 1;
      }).map(field => label(field)),
      smallInputText: fields.filter(field => innerWidth < 640 && !["checkbox", "radio", "file"].includes(field.type)
        && parseFloat(getComputedStyle(field).fontSize) < 16).map(field => ({ name: label(field), size: getComputedStyle(field).fontSize })),
    };
  });
}

async function inspectSizes(page: Page, info: TestInfo, name: string, scope?: Locator) {
  const reports = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    // Resize can trigger the existing progressive-enhancement cleanup.
    await expect.poll(async () => (await layout(page, scope)).overflow).toBeLessThanOrEqual(1);
    const report = { viewport, ...await layout(page, scope) };
    reports.push(report);
    expect(report.deviceScaleFactor).toBe(info.project.use.deviceScaleFactor ?? 1);
    expect.soft(report.unnamed, `${name} ${viewport.width}px unlabelled fields`).toEqual([]);
    expect.soft(report.outside, `${name} ${viewport.width}px fields outside viewport`).toEqual([]);
    if ([390, 1440, 3840].includes(viewport.width)) {
      // Keep the emulated DPR; only export diagnostic PNGs at CSS resolution.
      await page.screenshot({ path: info.outputPath(`${name}-${viewport.width}.png`), animations: "disabled", caret: "initial", scale: "css" });
    }
  }
  await info.attach(name, { body: JSON.stringify(reports, null, 2), contentType: "application/json" });
}

test.describe("responsive screen inventory", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Full inventory uses Chromium; focused loading checks run separately across engines.");
  for (const screen of screens) test(`${screen.path} ${screen.state ?? "available fixture"}`, async ({ page, context }, info) => {
    test.setTimeout(120_000);
    if (screen.authenticated) await context.addCookies([
      ["/dashboard", "/edit", "/preview", "/approved-preview"].includes(screen.path) ? publishedOwnerCookie : themeTestCookie,
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript(value => localStorage.setItem("nakshatra-app-theme", value), theme);
      await page.goto(screen.path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1:visible").first()).toBeVisible();
      if (loadedHeadings[screen.path]) await expect(page.getByRole("heading", { name: loadedHeadings[screen.path], exact: true })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
      await inspectSizes(page, info, theme);
    }
  });
});

test("editor sections keep named fields in the viewport across sizes and themes", async ({ page, context }, info) => {
  test.setTimeout(180_000);
  await context.addCookies([publishedOwnerCookie]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.goto("/dashboard?edit=1");
    const dialog = page.getByRole("dialog", { name: "Introduction details", exact: true });
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const select = dialog.getByRole("combobox", { name: "Go to introduction section" });
    const sections = await select.locator("option").evaluateAll(options => options.map(option => ({ value: (option as HTMLOptionElement).value, label: option.textContent ?? "" })));
    for (const section of sections) {
      await page.setViewportSize({ width: 390, height: 844 });
      await select.selectOption(section.value);
      await inspectSizes(page, info, `${theme}-${section.value}`, dialog);
    }
    await page.keyboard.press("Escape");
  }
});

test("account confirmation and public interest form keep their fields reachable", async ({ page, context }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.addCookies([themeTestCookie]);
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.goto("/account?reauth=complete");
    await expect(page.getByRole("dialog")).toBeVisible();
    await inspectSizes(page, info, `${theme}-confirmation`, page.getByRole("dialog"));
    await page.keyboard.press("Escape");
  }
  await context.clearCookies();
  for (const token of ["e2e-portfolio-token", "e2e-dark-portfolio-token"]) {
    await page.goto(`/p/${token}`);
    await page.getByRole("button", { name: "Show interest", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Continue as a new visitor" }).click();
    await expect(page.getByRole("dialog").getByLabel("Full name", { exact: true })).toBeVisible();
    await inspectSizes(page, info, token, page.getByRole("dialog"));
    await page.keyboard.press("Escape");
  }
});

test("email-code and password-recovery forms retain labels and error focus across sizes", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/auth/start", route => route.fulfill({ json: { verificationRequired: true, email: "owner@example.test" } }));
  await page.route("**/api/auth/verify", route => route.fulfill({ status: 400, json: { code: "OTP_REJECTED", error: "That code is incorrect or has expired." } }));
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.goto("/signup");
    await page.getByLabel("Email address").fill("owner@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Wedding2026");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    const code = page.getByLabel("Verification code");
    await expect(code).toBeFocused();
    await code.fill("123456");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toBeFocused();
    await inspectSizes(page, info, `${theme}-email-code`);
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeFocused();
    await inspectSizes(page, info, `${theme}-recovery`);
  }
});

test("broker customer invitation and team security forms fit without bypassing security", async ({ page, context }, info) => {
  test.setTimeout(120_000);
  await context.addCookies([themeTestCookie]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.goto(`${workspace}/customers`);
    await page.getByRole("button", { name: "Invite customer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Invite one customer", exact: true })).toBeVisible();
    await inspectSizes(page, info, `${theme}-customer-invitation`);
    await page.goto(`${workspace}/settings/team`);
    await page.getByRole("button", { name: "Invite employee", exact: true }).click();
    await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
    await inspectSizes(page, info, `${theme}-team-security`);
  }
});
