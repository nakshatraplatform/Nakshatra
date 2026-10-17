import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("portfolio home links and aligned interest fields preserve both themes", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  for (const appearance of ["light", "dark"]) {
    await page.goto(`/p/${appearance === "dark" ? "e2e-dark-portfolio-token" : "e2e-portfolio-token"}`);
    // The owner appearance is supplied by the public resolver, not an app-theme override.
    const header = page.getByRole("banner");
    const logo = header.getByRole("link", { name: "VivIntro home" });
    await expect(logo).toHaveAttribute("href", "/");
    await expect(logo).toHaveAttribute("target", "_blank");
    await expect(logo).toHaveAttribute("rel", "noopener noreferrer");
    await logo.focus();
    await expect(logo).toHaveCSS("outline-style", "solid");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "VivIntro home" })).toHaveAttribute("href", "/");
    await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const portalLogo = dialog.getByRole("link", { name: "VivIntro home" });
    await expect(portalLogo).toBeVisible();
    await expect(portalLogo).toHaveAttribute("href", "/");
    await expect.poll(() => portalLogo.locator("img").evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(dialog).toHaveCSS("color-scheme", appearance);
    await dialog.getByRole("button", { name: "Continue as a new visitor" }).click();
    await expect(dialog.getByLabel("Full name", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Your location search country", { exact: true })).toHaveCount(0);
    const location = dialog.getByRole("group", { name: "Your location", exact: true });
    const country = location.getByRole("combobox", { name: "Country", exact: true });
    const postal = location.getByRole("combobox", { name: "ZIP or PIN code", exact: true });
    await postal.scrollIntoViewIfNeeded();
    const countryBox = (await country.boundingBox())!;
    const postalBox = (await postal.boundingBox())!;
    const width = page.viewportSize()!.width;
    if (width >= 640) {
      expect(Math.abs(countryBox.y - postalBox.y)).toBeLessThanOrEqual(1);
      const phone = (await dialog.getByRole("textbox", { name: "Phone number", exact: true }).boundingBox())!;
      const email = (await dialog.getByRole("textbox", { name: "Email address", exact: true }).boundingBox())!;
      // Tablet split panes intentionally stack viewer fields to retain input width.
      if (width >= 1024 || width < 768) expect(Math.abs(phone.y - email.y)).toBeLessThanOrEqual(1);
      else {
        const phoneGroup = (await dialog.getByRole("group", { name: "Phone number *", exact: true }).boundingBox())!;
        expect(Math.abs(phoneGroup.x - email.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(phoneGroup.width - email.width)).toBeLessThanOrEqual(1);
        expect(email.y).toBeGreaterThanOrEqual(phone.y + phone.height + 16);
      }
      expect(Math.abs(phone.height - email.height)).toBeLessThanOrEqual(1);
    }
    expect(countryBox.height).toBeGreaterThanOrEqual(48);
    expect(postalBox.height).toBeGreaterThanOrEqual(48);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`interest-alignment-${appearance}.png`), animations: "disabled" });
    await dialog.getByRole("button", { name: "Close interest form" }).click();
  }
});

test("publishing needs fresh consent, not preview visits, and preserves a server refusal", async ({ page, context }, testInfo) => {
  await context.addCookies([publishedOwnerCookie]);
  const actions: string[] = [];
  await page.route("**/api/portfolio/onboarding", async route => {
    const { action } = route.request().postDataJSON();
    actions.push(action);
    await route.fulfill({ json: { readiness: {
      portfolioExists: true, lastEditorSection: "privacy", previewedAt: null,
      selectedPlanCode: null, verificationStatus: "verified", paymentStatus: "paid",
      paymentExpiresAt: null, paymentActive: true, disclosureConfirmed: action === "confirm_disclosure",
      published: true, missingRequired: [], reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false,
    } } });
  });
  let submissions = 0;
  await page.route("**/api/portfolio/publish", async route => {
    submissions++;
    await route.fulfill({ status: 409, json: { code: "DISCLOSURE_REQUIRED", error: "Please confirm your latest saved details." } });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByRole("button", { name: "Review saved changes", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review and publish", exact: true });
  // Fresh consent, not a preview visit, unlocks the primary action. Focus must
  // still enter the dialog, including reverse-Tab from its noninteractive title.
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const consent = dialog.getByRole("checkbox", { name: /I consent to publish/i });
  const publish = dialog.getByRole("button", { name: "Save and publish", exact: true });
  await expect(consent).not.toBeChecked();
  await expect(publish).toBeDisabled();
  await consent.check();
  await expect(publish).toBeEnabled();
  await dialog.getByRole("button", { name: "Back to dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByRole("button", { name: "Review saved changes", exact: true }).click();
  await expect(consent).not.toBeChecked();
  await expect(publish).toBeDisabled();
  await consent.check();
  await page.screenshot({ path: testInfo.outputPath("consent-ready.png"), animations: "disabled" });
  await publish.click();
  await expect(dialog.getByRole("alert")).toHaveText("Please confirm your latest saved details.");
  expect(submissions).toBe(1);
  expect(actions).toContain("confirm_disclosure");
  expect(actions).not.toContain("public_preview");
  expect(actions).not.toContain("complete_preview");
});
