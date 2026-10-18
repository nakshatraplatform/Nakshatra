import { expect, test } from "@playwright/test";
import { loadingTestCookie } from "./support/theme-session.mjs";

for (const [path, title] of [["/dashboard", "Getting your portfolio and requests ready"], ["/account", "Loading your account controls"], ["/brokers", "Loading your broker relationships"]]) {
  test(`ready navigation remains usable while ${path} data loads`, async ({ page, context }, testInfo) => {
    await context.addCookies([loadingTestCookie]);
    await page.goto(path, { waitUntil: "commit" });
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: title })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/\blenis\b/);
    await expect(page.getByRole("status").filter({ hasText: title })).toBeVisible();
    await header.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
    if (path === "/dashboard" && testInfo.project.name !== "tablet-chromium") {
      await page.screenshot({ path: testInfo.outputPath("pending-data-dark.png"), animations: "disabled" });
    }
    const marker = await page.evaluate(() => {
      const value = crypto.randomUUID();
      Object.assign(window, { componentLoadingMarker: value });
      return value;
    });
    const documents: string[] = [];
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
    // On mobile use the same menu a person uses, not a hidden desktop link.
    if (!(await header.getByRole("link", { name: "Dashboard", exact: true }).first().isVisible())) await header.getByText("Menu", { exact: true }).click();
    const destination = path === "/dashboard" ? "Account" : "Dashboard";
    await header.getByRole("link", { name: destination, exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(destination === "Account" ? /\/account$/ : /\/dashboard$/);
    expect(await page.evaluate(() => (window as Window & { componentLoadingMarker?: string }).componentLoadingMarker)).toBe(marker);
    expect(documents).toEqual([]);
  });
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`full-document Back preserves position with ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Your introduction should never reveal more than you intend." })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(400);
    await page.goto("/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Your introduction should never reveal more than you intend." })).toBeVisible();
    if (reducedMotion === "no-preference") await expect(page.locator("html")).toHaveClass(/\blenis\b/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(200);
  });
}

for (const [path, title] of [["/preview", "Preparing your Introduction preview"], ["/approved-preview", "Preparing your Complete Portfolio preview"]]) {
  test(`preview navigation remains available while ${path} is authorized and loaded`, async ({ page, context }) => {
    await context.addCookies([loadingTestCookie]);
    await page.goto(path, { waitUntil: "commit" });
    const navigation = page.getByRole("navigation", { name: "Preview navigation" });
    await expect(navigation).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: title })).toBeVisible();
    await navigation.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test("anonymous customer routes still require sign-in before rendering account data", async ({ page }) => {
  for (const path of ["/dashboard", "/account", "/brokers"]) {
    await page.goto(path);
    await expect(page).toHaveURL(url => url.pathname === "/login"
      && url.searchParams.get("redirect") === (path === "/brokers" ? null : path));
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete account", exact: true })).toHaveCount(0);
  }
});

test("completed account data replaces its orb without replacing the header", async ({ page, context }) => {
  await context.addCookies([loadingTestCookie]);
  await page.goto("/account", { waitUntil: "commit" });
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading your account controls" })).toBeVisible();
  await header.evaluate(element => element.setAttribute("data-test-frame-identity", "retained"));
  await expect(page.getByRole("heading", { name: "Account settings", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(header).toHaveAttribute("data-test-frame-identity", "retained");
  await expect(page.getByRole("status").filter({ hasText: "Loading your account controls" })).toHaveCount(0);
});
