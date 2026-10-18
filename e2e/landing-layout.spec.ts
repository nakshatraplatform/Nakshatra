import { expect, test } from "@playwright/test";

test("landing explains the family problem, disclosure boundary, and next step", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.locator("#why")).toContainText("Old versions keep circulating");
  await expect(page.locator("#privacy")).toContainText("Your introduction");
  await expect(page.locator("#privacy")).toContainText("Anything someone can see, they can screenshot");
  await expect(page.locator("#privacy").getByRole("heading", { name: "Private details", exact: true })).toBeVisible();
  await expect(page.locator("#privacy")).toContainText("Your private notes and street address stay in your account");
  await page.locator("#privacy").screenshot({ path: testInfo.outputPath("disclosure-examples.png"), animations: "disabled" });
  await expect(page.locator("#how").getByRole("heading", { name: "How VivIntro works" })).toBeVisible();
  await page.locator('[data-tour-step="01"]').screenshot({ path: testInfo.outputPath("fictional-draft-example.png"), animations: "disabled" });
  await expect(page.locator("#viewer").getByRole("link", { name: "Read the viewer guide" })).toHaveAttribute("href", "/received-a-link");
  await expect(page.locator("#samples").getByRole("link", { name: "See an example" })).toHaveAttribute("href", "/demo");
  expect(await page.locator("#samples").evaluate((element) => {
    const tour = document.querySelector("#how");
    return tour !== null && Boolean(element.compareDocumentPosition(tour) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(page.locator("#viewer article")).toHaveCount(3);
  if (testInfo.project.name === "chromium") {
    await page.locator("#samples").screenshot({ path: testInfo.outputPath("sample-section-desktop-light.png"), animations: "disabled" });
  }

  await page.locator("#questions").getByText("Can my link be forwarded?").click();
  await expect(page.locator("#questions")).toContainText("The first view can be forwarded or screenshotted");
});

test("trust and FAQ disclosures work with keyboard in both themes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const trust = page.locator("#trust details").first();
  const trustSummary = trust.locator("summary");
  await trustSummary.focus();
  await expect(trustSummary).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(trust).toHaveAttribute("open", "");
  await expect(trust.getByText(/Anything someone can see can be saved or screenshotted/i)).toBeVisible();

  const faq = page.locator("#questions details").first();
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Switch to Dark theme" }).click();
  await expect(trustSummary).toHaveCSS("outline-color", /rgb\(/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
  await page.screenshot({ path: testInfo.outputPath("landing-disclosures-375-dark.png"), fullPage: true, animations: "disabled" });

  await page.goto("/trust");
  const livenessCheck = page.getByRole("heading", { name: "Liveness checks", exact: true }).locator("xpath=ancestor::details");
  await expect(livenessCheck).toHaveAttribute("open", "");
  await livenessCheck.locator("summary").click();
  await expect(livenessCheck).not.toHaveAttribute("open", "");
  await page.getByText("Sharing boundary").click();
  await expect(page.getByText(/personal link can open its public Introduction/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("trust-disclosures-375-dark.png"), fullPage: true, animations: "disabled" });
});

test("landing copy fits supported widths in both themes", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") await page.getByRole("button", { name: "Switch to Dark theme" }).click();
    for (const width of [320, 375, 414, 768, 1024, 1081, 1200, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${theme} at ${width}px`).toBeLessThanOrEqual(width + 1);
      if (width >= 1081) {
        const navLinkHeights = await page.locator("header nav a").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
        expect(Math.max(...navLinkHeights), `${theme} navigation at ${width}px`).toBeLessThanOrEqual(54);
      }
    }
  }
});

test("tour anchors clear the sticky header on desktop and mobile", async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator('nav[aria-label="Guided tour steps"] a[href="#tour-step-04"]').click();

    await expect(page.locator('[data-tour-step="04"] h3')).toBeInViewport();
    // Lenis can pass through partial visibility before settling at the anchor.
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('[data-tour-step="04"] h3')!.getBoundingClientRect().top
      - document.querySelector("body > div header")!.getBoundingClientRect().bottom
    )).toBeGreaterThan(8);
  }
});

test("bookshelf fills the viewport and opens every step by keyboard", async ({ page }, testInfo) => {
  for (const [width, height] of [[861, 700], [1280, 720], [1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
    for (const step of ["01", "02", "03", "04"]) {
      const link = page.locator(`nav[aria-label="Guided tour steps"] a[href="#tour-step-${step}"]`);
      await link.focus();
      await link.press("Enter");
      const book = page.locator(`[data-tour-step="${step}"]`);
      await expect(book).toHaveAttribute("data-active", "true");
      await expect(book.locator("h3")).toBeInViewport();
      await expect(book.locator("[data-shelf-paper] li").last()).toBeInViewport();
      const scene = page.locator("[data-shelf-scene]");
      await expect.poll(() => scene.evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(2);
      expect(await scene.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(height, 0);
    }
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath("bookshelf-open-desktop.png") });
  }
});

test("small and short screens retain the entire tour in normal flow", async ({ page }, testInfo) => {
  for (const [width, height] of [[320, 812], [390, 844], [1440, 600]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
    for (const step of ["01", "02", "03", "04"]) {
      await page.locator(`nav[aria-label="Guided tour steps"] a[href="#tour-step-${step}"]`).click();
      await expect(page.locator(`[data-tour-step="${step}"] h3`)).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("bookshelf-mobile-fallback.png") });
  }
});

test("sample portfolio footer uses an in-flow back-to-top link without a floating overlap", async ({ page }, testInfo) => {
  for (const width of [375, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo");
    if (width === 1440) await page.locator(".portfolio-hero").screenshot({ path: testInfo.outputPath("sample-portfolio-hero-1440.png"), animations: "disabled" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const topButton = page.getByRole("link", { name: "Back to top", exact: true });
    await expect(topButton).toBeVisible();
    const overlap = await page.evaluate(() => {
      const button = document.querySelector('footer a[href="#portfolio-top"]')!.getBoundingClientRect();
      return Array.from(document.querySelectorAll('nav[aria-label="Portfolio help and policies"] a')).some((link) => {
        const target = link.getBoundingClientRect();
        return button.left < target.right && button.right > target.left && button.top < target.bottom && button.bottom > target.top;
      });
    });
    expect(overlap, `${width}px sample portfolio footer`).toBe(false);
    if (width === 375) await page.screenshot({ path: testInfo.outputPath("sample-portfolio-footer-375.png"), animations: "disabled" });
  }
});

test("hero callout does not cover the preview label", async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overlap = await page.evaluate(() => {
      const callout = document.querySelector('[class*="floatingMessage"]')!.getBoundingClientRect();
      const label = document.querySelector('[class*="portfolioCard"] > header > span:last-child')!.getBoundingClientRect();
      return callout.left < label.right && callout.right > label.left && callout.top < label.bottom && callout.bottom > label.top;
    });
    expect(overlap).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
});

test("mobile sample explanation and sharing cards have breathing room", async ({ page }) => {
  for (const width of [320, 375, 414]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    const caption = page.getByText("A fictional example of the shared Introduction");
    await expect(caption).toBeVisible();
    const positions = await page.evaluate(() => {
      const caption = document.querySelector('[class*="mobilePreviewLabel"]')!.getBoundingClientRect();
      const callout = document.querySelector('[class*="floatingMessage"]')!.getBoundingClientRect();
      const control = document.querySelector("#privacy")!.getBoundingClientRect();
      return { captionBottom: caption.bottom, calloutTop: callout.top, controlLeft: control.left, controlRight: control.right };
    });
    expect(positions.captionBottom).toBeLessThan(positions.calloutTop);
    expect(positions.controlLeft).toBeGreaterThanOrEqual(19);
    expect(positions.controlRight).toBeLessThanOrEqual(width - 19);
  }
});

test("frequent tour feedback is immediate and sample CTA opens the real demo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const step = page.locator('nav[aria-label="Guided tour steps"] a[href="#tour-step-02"]');
  expect(await step.evaluate((element) => getComputedStyle(element, "::after").transitionDuration)).toBe("0s");
  await step.focus();
  await expect(step).toHaveCSS("outline-style", "solid");

  const sample = page.locator("#top").getByRole("link", { name: "See an example" });
  await expect(sample).toHaveAttribute("href", "/demo");
  await sample.click();
  await expect(page.getByText("Fictional sample introduction", { exact: true })).toBeVisible();
});

test("reduced motion keeps tour cards readable without sticky stacking", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator('[data-tour-step="04"]')).toHaveCSS("position", "relative");
  const step = page.locator('nav[aria-label="Guided tour steps"] a[href="#tour-step-02"]');
  expect(await step.evaluate((element) => getComputedStyle(element, "::after").transitionDuration)).toBe("0s");
});
