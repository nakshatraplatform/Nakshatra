import { expect, test } from "@playwright/test";
import { approvedViewerCookie } from "./support/theme-session.mjs";

const activeGrant = "11111111-1111-4111-8111-111111111111";
const expiredGrant = "22222222-2222-4222-8222-222222222222";
const revokedGrant = "33333333-3333-4333-8333-333333333333";

test("approved access reveals protected contact only to the confirmed recipient", async ({ page, context }, testInfo) => {
  await context.addCookies([approvedViewerCookie]);
  await page.goto(`/access/${activeGrant}`);
  await expect(page).toHaveURL(/\/p\/e2e-portfolio-token$/);
  await expect(page.getByLabel("Protected access details")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contact shared by the introduction owner" })).toBeVisible();
  await expect(page.getByText("Family shared after approval")).toHaveCount(0);
  await expect(page.getByText("aditi@example.test")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show interest" })).toHaveCount(0);
  await expect.poll(() => page.getByAltText("Public portrait").first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const gallery = page.locator(".portfolio-gallery");
  await expect(gallery.getByRole("button", { name: "Show photo 8" })).toBeVisible();
  await gallery.getByRole("button", { name: "Show photo 3" }).click();
  await expect(gallery.getByAltText("Protected portrait")).toBeVisible();
  await expect.poll(() => gallery.getByAltText("Protected portrait").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  if (testInfo.project.name === "mobile-chromium") {
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: testInfo.outputPath("approved-complete-mobile.png"), fullPage: true, animations: "disabled" });
  }

  await context.clearCookies();
  await page.reload();
  await expect(page.getByLabel("Protected access details")).toHaveCount(0);
  await expect(page.getByText("aditi@example.test")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show interest" })).toBeVisible();
});

test("expired and revoked access provide a safe way forward", async ({ page, context }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("nakshatra-app-theme", "dark"));
  await context.addCookies([approvedViewerCookie]);
  await page.goto(`/access/${expiredGrant}`);
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await expect(page.getByRole("heading", { name: "This access has expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the viewer guide" })).toHaveAttribute("href", "/received-a-link");
  if (testInfo.project.name === "mobile-chromium") {
    await page.screenshot({ path: testInfo.outputPath("expired-complete-mobile.png"), animations: "disabled" });
  }

  await page.goto(`/access/${revokedGrant}`);
  await expect(page.getByRole("heading", { name: "This access link is unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the viewer guide" })).toBeVisible();
  await expect(page.getByText("aditi@example.test")).toHaveCount(0);

  await page.goto("/p/e2e-expired-token");
  await expect(page.getByRole("heading", { name: "This Introduction link has expired" })).toBeVisible();
  await expect(page.getByText("VivIntro private beta")).toHaveCount(0);
  await page.getByRole("link", { name: "Read the viewer guide" }).click();
  await expect(page).toHaveURL(/\/received-a-link$/);
});
