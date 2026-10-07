import { expect, test } from "@playwright/test";

test("landing explains the family problem, disclosure boundary, and next step", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.locator("#why")).toContainText("old files and personal details sit in different chats");
  await expect(page.locator("#privacy")).toContainText("Shared introduction");
  await expect(page.locator("#privacy")).toContainText("A shared link can be forwarded");
  await expect(page.locator("#how").getByRole("heading", { name: "How VivIntro works" })).toBeVisible();
  await expect(page.locator("#viewer").getByRole("link", { name: "Read the viewer guide" })).toHaveAttribute("href", "/received-a-link");
  await expect(page.locator("#samples").getByRole("link", { name: "View a sample introduction" })).toHaveAttribute("href", "/demo");
  expect(await page.locator("#samples").evaluate((element) => {
    const tour = document.querySelector("#how");
    return tour !== null && Boolean(element.compareDocumentPosition(tour) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(page.locator("#viewer article")).toHaveCount(3);
  if (testInfo.project.name === "chromium") {
    await page.locator("#samples").screenshot({ path: testInfo.outputPath("sample-section-desktop-light.png"), animations: "disabled" });
  }

  await page.locator("#questions").getByText("Who can open a shared link?").click();
  await expect(page.locator("#questions")).toContainText("A viewer can still forward or capture what they see");
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
  await expect(trust.getByText(/public Introduction can be forwarded/i)).toBeVisible();

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
    await page.locator('a[href="#tour-step-04"]').click();

    const positions = await page.evaluate(() => ({
      headerBottom: document.querySelector("body > div header")!.getBoundingClientRect().bottom,
      headingTop: document.querySelector("#tour-step-04 h3")!.getBoundingClientRect().top,
    }));
    expect(positions.headingTop).toBeGreaterThan(positions.headerBottom + 8);
  }
});

test("short desktop viewports can reach every part of the guided tour", async ({ page }) => {
  for (const width of [861, 1440]) {
    for (const height of [600, 800, 850, 860]) {
      await page.setViewportSize({ width, height });
      await page.goto("/");

      for (const [step, detail] of [["01", "Changes saved"], ["04", "Access can end early"]] as const) {
        const card = page.locator(`#tour-step-${step}`);
        await expect(card).toHaveCSS("position", height < 700 ? "relative" : "sticky");
        await card.getByText(detail).scrollIntoViewIfNeeded();
        await expect(card.getByText(detail)).toBeInViewport();
      }
    }
  }
});

test("tall desktop viewports keep fully visible sticky tour cards", async ({ page }) => {
  for (const width of [861, 1440]) {
    for (const height of [861, 900]) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.locator('a[href="#tour-step-01"]').click();

      const card = page.locator("#tour-step-01");
      await expect(card).toHaveCSS("position", "sticky");
      const cardBottom = await card.evaluate((element) => element.getBoundingClientRect().bottom);
      expect(cardBottom).toBeLessThan(height);
    }
  }
});

test("laptop tour cards remain readable and scroll-pinned", async ({ page }, testInfo) => {
  for (const [width, height] of [[861, 700], [1024, 720], [1280, 720], [1366, 768]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.locator('a[href="#tour-step-01"]').click();

    const card = page.locator("#tour-step-01");
    if (width === 1366) await page.screenshot({ path: testInfo.outputPath("tour-laptop-1366.png"), animations: "disabled" });
    await expect(card).toHaveCSS("position", "sticky");
    const bounds = await card.evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(bounds.bottom).toBeLessThanOrEqual(height - 8);
    await expect(card.getByText("Changes saved")).toBeInViewport();
  }
});

test("sample portfolio footer links stay clear of the back-to-top control", async ({ page }, testInfo) => {
  for (const width of [375, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo");
    if (width === 1440) await page.locator(".portfolio-hero").screenshot({ path: testInfo.outputPath("sample-portfolio-hero-1440.png"), animations: "disabled" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const topButton = page.getByRole("button", { name: "Back to top of introduction" });
    await expect(topButton).toBeVisible();
    const overlap = await page.evaluate(() => {
      const button = document.querySelector(".portfolio-back-to-top")!.getBoundingClientRect();
      return Array.from(document.querySelectorAll(".portfolio-footer-links a")).some((link) => {
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
  const step = page.locator('a[href="#tour-step-02"]');
  expect(await step.evaluate((element) => getComputedStyle(element, "::after").transitionDuration)).toBe("0s");
  await step.focus();
  await expect(step).toHaveCSS("outline-style", "solid");

  const sample = page.locator("#top").getByRole("link", { name: "View a sample introduction" });
  await expect(sample).toHaveAttribute("href", "/demo");
  await sample.click();
  await expect(page.getByText("Fictional sample introduction", { exact: true })).toBeVisible();
});

test("reduced motion keeps tour cards readable without sticky stacking", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#tour-step-04")).toHaveCSS("position", "relative");
  const step = page.locator('a[href="#tour-step-02"]');
  expect(await step.evaluate((element) => getComputedStyle(element, "::after").transitionDuration)).toBe("0s");
});
