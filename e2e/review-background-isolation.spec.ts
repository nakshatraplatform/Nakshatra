import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("final review isolates the moved header through editor transitions and dismissal", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/portfolio/onboarding", route => route.fulfill({ json: { readiness: {
    portfolioExists: true, lastEditorSection: "privacy", previewedAt: "2026-10-07T12:00:00Z",
    reviewFingerprint: "a".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false,
    verificationStatus: "verified", paymentStatus: "paid", paymentActive: true,
    paymentExpiresAt: null, disclosureConfirmed: false, published: true, missingRequired: [], selectedPlanCode: "launch_30",
  } } }));
  await page.goto("/dashboard");
  const header = page.locator(".dashboard-header");
  const account = header.locator('a[href="/account"]').first();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(header).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Review saved changes", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review and publish", exact: true });
  await expect(review).toBeVisible();
  await expect(header).toHaveAttribute("inert", "");
  await account.evaluate(element => (element as HTMLElement).focus());
  expect(await review.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await review.getByRole("button", { name: "Back to editing", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Introduction details", exact: true })).toBeVisible();
  await expect(header).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Review saved changes", exact: true }).click();
  await expect(review).toBeVisible();
  await expect(header).toHaveAttribute("inert", "");
  await review.getByRole("button", { name: "Back to dashboard", exact: true }).click();
  await expect(review).not.toBeVisible();
  await expect(header).not.toHaveAttribute("inert", "");
  if (!(await account.isVisible())) await header.getByLabel("Account menu").click();
  await header.getByRole("link", { name: "Account settings", exact: true }).filter({ visible: true }).focus();
  expect(await header.evaluate(element => element.contains(document.activeElement))).toBe(true);
});
