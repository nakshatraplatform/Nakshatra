import { expect, test, type Locator } from "@playwright/test";
import { legacyOwnerCookie, publishedOwnerCookie } from "./support/theme-session.mjs";

async function textContrast(locator: Locator) {
  return locator.evaluate(element => {
    const context = document.createElement("canvas").getContext("2d")!;
    const chain: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);
    for (const node of chain) { context.fillStyle = getComputedStyle(node).backgroundColor; context.fillRect(0, 0, 1, 1); }
    const background = [...context.getImageData(0, 0, 1, 1).data];
    context.fillStyle = getComputedStyle(element).color; context.fillRect(0, 0, 1, 1);
    const foreground = [...context.getImageData(0, 0, 1, 1).data];
    const luminance = (rgba: number[]) => rgba.slice(0, 3).map(v => v / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const a = luminance(background), b = luminance(foreground);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}

for (const [token, appearance] of [["e2e-portfolio-token", "light"], ["e2e-dark-portfolio-token", "dark"]]) {
test(`gold metadata and split interest panes remain legible through OTP and success: ${appearance}`, async ({ page }, testInfo) => {
  await page.route("**/api/auth/start", route => route.fulfill({ json: { sent: true } }));
  await page.route("**/api/auth/verify", route => route.fulfill({ json: { verified: true, authenticated: true } }));
  await page.route("**/api/interest", route => route.fulfill({ status: 201, json: { ok: true } }));
    await page.goto("/");
    await page.evaluate(theme => localStorage.setItem("nakshatra-app-theme", theme), appearance === "light" ? "dark" : "light");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/p/${token}`);
    const name = page.getByRole("heading", { level: 1 });
    const eyebrow = page.locator(".portfolio-hero .portfolio-eyebrow");
    const metadata = page.locator(".portfolio-hero-line");
    await expect(eyebrow).toHaveCSS("font-size", "12px");
    await expect(metadata).toHaveCSS("font-weight", "500");
    expect(await eyebrow.evaluate(el => getComputedStyle(el).color)).not.toBe(await name.evaluate(el => getComputedStyle(el).color));
    const chapter = page.locator('#astrology [data-portfolio-heading] > p');
    await expect(chapter).toHaveCount(1);
    for (const label of [eyebrow, metadata, chapter]) {
      expect(await textContrast(label)).toBeGreaterThanOrEqual(4.5);
    }
    await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const sidebar = dialog.getByRole("complementary", { name: "About this introduction" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("heading", { name: "Next steps" })).toBeVisible();
    await dialog.getByRole("button", { name: "Continue as a new visitor" }).click();
    await dialog.getByLabel("Full name", { exact: true }).fill("Maya Shah");
    await dialog.getByLabel("Who are you contacting for?").selectOption("self");
    await dialog.getByRole("textbox", { name: "Phone number", exact: true }).fill("6175550123");
    await dialog.getByLabel("Email address", { exact: true }).fill("maya@example.test");
    await dialog.getByRole("button", { name: "Enter location manually", exact: true }).click();
    await dialog.getByLabel("Country", { exact: true }).selectOption("US");
    await dialog.getByLabel("State", { exact: true }).selectOption("US-MA");
    await dialog.getByLabel("City", { exact: true }).fill("Boston");
    await dialog.getByLabel("ZIP or PIN code", { exact: true }).fill("02108");
    await dialog.getByLabel("Family context", { exact: true }).fill("Our family values honesty, kindness and mutual respect.");
    await dialog.getByRole("button", { name: "Verify email and continue" }).click();
    await expect(dialog.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 720 });
      const box = (await dialog.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(width);
      expect(box.height + box.y).toBeLessThanOrEqual(721);
      if (width >= 768) {
        await expect(sidebar).toBeVisible();
        const left = (await sidebar.boundingBox())!, right = (await dialog.locator(".interest-main-pane").boundingBox())!;
        expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1);
        expect(right.width / left.width).toBeCloseTo(1.5, 1);
      } else await expect(sidebar).toBeHidden();
      await expect(dialog.getByLabel("Six-digit code")).toBeInViewport();
      await dialog.getByRole("button", { name: "Verify email", exact: true }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("button", { name: "Verify email", exact: true })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`otp-${appearance}-${width}.png`) });
    }
    await dialog.getByLabel("Six-digit code").fill("123456");
    await dialog.getByRole("button", { name: "Verify email", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Interest sent", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Return to introduction" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
});
}

for (const theme of ["light", "dark"]) {
test(`mobile publishing review preserves checklist space and pinned actions: ${theme}`, async ({ page, context }, testInfo) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/dashboard", route => route.fulfill({ json: { portfolioId: "e2e-portfolio" } }));
  await page.route("**/api/portfolio/onboarding", route => route.fulfill({ json: { readiness: {
    portfolioExists: true, lastEditorSection: "privacy", previewedAt: "2026-10-07T12:00:00Z",
    reviewFingerprint: "a".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false,
    verificationStatus: "verified", paymentStatus: "paid", paymentActive: true,
    paymentExpiresAt: null, disclosureConfirmed: false, published: true, missingRequired: [], selectedPlanCode: "launch_30",
  } } }));
    await page.goto("/dashboard");
    await page.evaluate(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.reload();
    await page.getByRole("button", { name: "Edit details", exact: true }).click();
    await page.getByRole("button", { name: "Review saved changes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Review and publish", exact: true });
    await expect(dialog).toBeVisible();
    for (const width of [320, 375, 402, 768, 1440]) {
      await page.setViewportSize({ width, height: 740 });
      const content = dialog.locator(".dashboard-review-content"), footer = dialog.locator("footer");
      const box = (await dialog.boundingBox())!, scroll = (await content.boundingBox())!, actions = (await footer.boundingBox())!;
      if (width < 768) {
        expect(box.x).toBe(0); expect(box.y).toBe(0); expect(box.width).toBe(width); expect(box.height).toBe(740);
      }
      expect(scroll.height).toBeGreaterThan(240);
      expect(scroll.y + scroll.height).toBeLessThanOrEqual(actions.y + 1);
      const requirement = dialog.getByText("Give consent when all other steps are complete", { exact: true });
      await requirement.scrollIntoViewIfNeeded();
      await expect(requirement).toBeInViewport();
      const publish = dialog.getByRole("button", { name: "Save and publish", exact: true });
      await expect(publish).toBeInViewport();
      await expect(publish).toBeDisabled();
      await content.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect(publish).toBeInViewport();
      for (const row of await dialog.locator('.dashboard-review-requirement[data-complete="true"]').all()) {
        expect(await textContrast(row)).toBeGreaterThanOrEqual(4.5);
      }
      await page.screenshot({ path: testInfo.outputPath(`review-${theme}-${width}.png`) });
    }
    await dialog.getByRole("button", { name: "Back to dashboard" }).click();
    await expect(dialog).toHaveCount(0);
});
}

test("legacy sharing stays locked until a complete published snapshot is returned", async ({ page, context }) => {
  await context.addCookies([legacyOwnerCookie]);
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Update Profile to Resume Sharing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share on WhatsApp" })).toHaveCount(0);
  await context.addCookies([publishedOwnerCookie]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share on WhatsApp" })).toBeVisible();
});
