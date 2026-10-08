import { expect, test } from "@playwright/test";
import { draftOwnerCookie, publishedOwnerCookie } from "./support/theme-session.mjs";

test("an unpublished complete owner can edit or go directly to liveness", async ({ page, context }, testInfo) => {
  await context.addCookies([draftOwnerCookie]);
  await page.route("**/api/identity-verification/current**", route => route.fulfill({ json: {
    state: "not_started", attemptId: null, deadline: null, cleanupPending: false, canResume: false, canCancel: false, canStart: true,
  } }));
  for (const [width, height] of [[375, 812], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Edit details", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "100% of required answers complete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share on WhatsApp", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Go to liveness check", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Liveness check", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`draft-journey-${width}.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Edit details", exact: true }).click();
    const editor = page.getByRole("dialog");
    await expect(editor.getByRole("heading", { name: "Portfolio details", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await editor.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
    await expect(editor.getByLabel("Marital Status", { exact: true })).toBeVisible();
    await expect(editor.getByLabel("Current country", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`basics-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit details", exact: true })).toBeFocused();
  }
});

test("published link actions are explicit and reachable", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Edit details", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share on WhatsApp", exact: true })).toBeVisible();
});

test("editor hints and footer notes meet normal-text contrast in both themes", async ({ page, context }) => {
  await context.addCookies([draftOwnerCookie]);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Portfolio details", exact: true });
  const birthHintId = (await editor.getByLabel("Date of birth", { exact: true }).getAttribute("aria-describedby"))!.split(" ")[0];
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await editor.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
    const ratios = await editor.evaluate((dialog, hintId) => {
      const targets = [dialog.querySelector(`[id="${hintId}"]`),
        dialog.querySelector(".dashboard-editor-header-layout > div:first-child > p"),
        ...dialog.querySelectorAll(".dashboard-editor-footer-notes > p")].filter(Boolean) as Element[];
      const rgb = (color: string) => color.match(/[\d.]+/g)!.map(Number);
      const luminance = (channels: number[]) => channels.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      return targets.map(element => {
        const ancestors: Element[] = [];
        for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
        let background = [255, 255, 255];
        for (const ancestor of ancestors) {
          const color = rgb(getComputedStyle(ancestor).backgroundColor);
          const alpha = color[3] ?? 1;
          background = background.map((channel, index) => color[index] * alpha + channel * (1 - alpha));
        }
        const foreground = luminance(rgb(getComputedStyle(element).color));
        const backdrop = luminance(background);
        return (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05);
      });
    }, birthHintId);
    expect(ratios).toHaveLength(4);
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

test("editor and review fit narrow, desktop and zoom-equivalent viewports", async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  await context.addCookies([draftOwnerCookie]);
  await page.route("**/api/identity-verification/current**", route => route.fulfill({ json: {
    state: "not_started", attemptId: null, deadline: null, cleanupPending: false, canResume: false, canCancel: false, canStart: true,
  } }));
  await page.route("**/api/portfolio/onboarding", route => route.fulfill({ json: { readiness: {
    portfolioExists: true, lastEditorSection: "foundation", previewedAt: "2026-10-08T12:00:00Z",
    selectedPlanCode: "launch_30", verificationStatus: "required", paymentStatus: "paid",
    paymentExpiresAt: null, paymentActive: true, disclosureConfirmed: false, published: false,
    missingRequired: [], reviewFingerprint: "a".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false,
  } } }));
  for (const [width, height] of [[320, 640], [375, 812], [768, 800], [1024, 768], [1280, 900], [1440, 900], [640, 450]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    const edit = page.getByRole("button", { name: "Edit details", exact: true });
    const publishReview = page.getByRole("button", { name: "Review and publish", exact: true });
    expect(await edit.evaluate((element) => Boolean(element.nextElementSibling?.textContent?.includes("Review and publish")))).toBe(true);
    await edit.click();
    const editor = page.getByRole("dialog", { name: "Portfolio details", exact: true });
    for (const action of ["Preview", "Review and publish", ...(width >= 640 ? ["Save draft"] : [])]) {
      const button = editor.getByRole("button", { name: action, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    }
    if (width >= 640) {
      const birth = await editor.getByLabel("Date of birth", { exact: true }).boundingBox();
      const gender = await editor.getByLabel("Gender", { exact: true }).boundingBox();
      expect(Math.abs(birth!.y - gender!.y)).toBeLessThan(2);
    }
    expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`editor-fit-${width}-${height}.png`), animations: "disabled" });
    await editor.getByRole("button", { name: /^(Back to dashboard|Dashboard)$/ }).click();
    await publishReview.click();
    const review = page.getByRole("dialog", { name: "Review both views before publishing", exact: true });
    await expect(review).toBeVisible();
    await expect(review.getByRole("button", { name: "Back to editing" })).toHaveCount(0);
    const next = review.getByRole("button", { name: "Review both views before publishing", exact: true });
    const box = await next.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    await next.click();
    await expect(review.getByRole("link", { name: "Review public Introduction", exact: true })).toBeFocused();
    expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`review-fit-${width}-${height}.png`), animations: "disabled" });
    await review.getByRole("button", { name: "Back to dashboard", exact: true }).click();
  }
});

test("dashboard previews count toward review without accepting publication consent", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  // This case tests dashboard evidence and consent, not protected-photo rendering.
  await context.route(/\/(preview|approved-preview)$/, route => route.fulfill({
    contentType: "text/html", body: "<main>Owner preview test surface</main>",
  }));
  await page.route("**/api/dashboard", route => route.fulfill({ json: { portfolioId: "e2e-portfolio" } }));
  let publicReviewed = false;
  let completeReviewed = false;
  await page.route("**/api/portfolio/onboarding", async route => {
    const { action } = route.request().postDataJSON();
    publicReviewed ||= action === "public_preview";
    completeReviewed ||= action === "complete_preview";
    await route.fulfill({ json: { readiness: {
      portfolioExists: true, lastEditorSection: "privacy", previewedAt: "2026-10-07T12:00:00.000Z",
      selectedPlanCode: "launch_30", verificationStatus: "verified", paymentStatus: "paid",
      paymentExpiresAt: null, paymentActive: true, disclosureConfirmed: false, published: true,
      missingRequired: [], reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: publicReviewed, completePreviewReviewed: completeReviewed,
    } } });
  });
  await page.goto("/dashboard");
  for (const name of [/preview public introduction/i, /preview complete portfolio/i]) {
    const popup = page.waitForEvent("popup");
    await page.getByRole("link", { name }).click();
    await (await popup).close();
  }
  await expect.poll(() => publicReviewed && completeReviewed).toBe(true);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByRole("button", { name: "Review saved changes", exact: true }).click();
  const review = page.getByRole("dialog", { name: /review both views/i });
  await expect(review.getByRole("checkbox", { name: /I reviewed the public/i })).not.toBeChecked();
  await expect(review.getByRole("button", { name: "Review both views before publishing", exact: true })).toHaveCount(0);
  await expect(review.getByRole("button", { name: "Confirm & publish changes", exact: true })).toBeDisabled();
});
