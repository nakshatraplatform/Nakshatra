import { expect, test } from "@playwright/test";

test("scroll opens all four books, reverses, and lets the visitor leave", async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const tour = page.locator("#how");
  await expect(tour).toHaveAttribute("data-bookshelf", "true");
  const positions: number[] = [];
  for (const step of ["01", "02", "03", "04"]) {
    await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: new RegExp(`^${step}`) }).click();
    await expect(page.locator(`[data-tour-step="${step}"]`)).toHaveAttribute("data-active", "true");
    positions.push(await page.evaluate(() => window.scrollY));
  }
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  // Chromium's mobile emulation scales injected wheel deltas by device scale.
  // Convert CSS scroll distances to input pixels; desktop uses CSS pixels.
  const wheelScale = isMobile ? await page.evaluate(() => devicePixelRatio) : 1;
  await page.mouse.wheel(0, (positions[0] - positions[3]) * wheelScale);
  await expect(page.locator('[data-tour-step="01"]')).toHaveAttribute("data-active", "true");
  for (let index = 1; index < 4; index++) {
    await page.mouse.wheel(0, (positions[index] - positions[index - 1]) * wheelScale);
    await expect(page.locator(`[data-tour-step="0${index + 1}"]`)).toHaveAttribute("data-active", "true");
  }
  await page.getByRole("link", { name: "Continue past the tour" }).click();
  await expect(page.locator("#viewer h2")).toBeInViewport();
  await expect.poll(() => page.locator("[data-shelf-scene]").evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(100);
});

test("direct step links survive reload and motion preference changes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#tour-step-03");
  const book = page.locator('[data-tour-step="03"]');
  await expect(book).toHaveAttribute("data-active", "true");
  await expect(book.locator("h3")).toBeInViewport();
  await page.reload();
  await expect(book).toHaveAttribute("data-active", "true");
  await page.getByRole("switch", { name: "Dark mode", checked: false }).click();
  await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: /^03/ }).click();
  await expect(book).toHaveAttribute("data-active", "true");
  // Capture the resting pose after the 450ms scrub, not a page-turn intermediate.
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath("bookshelf-dark.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
  for (const step of ["01", "02", "03", "04"]) {
    await expect(page.locator(`[data-tour-step="${step}"] [data-shelf-paper]`)).not.toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(`[data-tour-step="${step}"]`)).toHaveCSS("transform", "none");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
  await expect(page.locator("#tour-step-03")).toHaveCount(1);
  await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: /^03/ }).click();
  await expect(book.locator("h3")).toBeInViewport();
  await page.setViewportSize({ width: 932, height: 430 });
  await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
  await expect(book).toHaveCSS("transform", "none");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
  await expect(book).toHaveAttribute("data-active", "true");
});

test("signup shows the compact outlined Google control in both themes", async ({ page }, testInfo) => {
  await page.goto("/signup");
  const button = page.getByRole("button", { name: "Sign up with Google" });
  await expect(button).toBeVisible();
  await expect(button).toHaveCSS("border-top-style", "solid");
  expect(await button.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(240);
  await button.focus();
  await expect(button).toHaveCSS("outline-style", "solid");
  await button.screenshot({ path: testInfo.outputPath("signup-google-light.png") });
  await page.getByRole("switch", { name: "Dark mode", checked: false }).click();
  await button.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("signup-dark.png") });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("all chapters remain readable and reachable by their original links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
    for (const step of ["01", "02", "03", "04"]) {
      await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: new RegExp(`^${step}`) }).click();
      await expect(page.locator(`#tour-step-${step} h3`)).toBeInViewport();
    }
  });
});


test("phone layouts show sequential cards in either orientation", async ({ page }, testInfo) => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [932, 430]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/#tour-step-02");
    await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
    await expect(page.locator("#tour-step-02 h3")).toBeInViewport();
    const boxes = [];
    for (const step of ["01", "02", "03", "04"]) {
      const card = page.locator(`[data-tour-step="${step}"]`);
      await expect(card).toHaveCSS("position", "relative");
      await expect(card).toHaveCSS("transform", "none");
      await expect(card.locator("[data-shelf-paper]")).not.toHaveAttribute("aria-hidden", "true");
      await expect(card.locator("[data-shelf-cover]")).toBeHidden();
      await expect(card.locator('[class*="staticVisual"]')).toBeVisible();
      await expect(page.locator(`#tour-step-${step}`)).toHaveCount(1);
      boxes.push(await card.boundingBox());
    }
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index]!.y).toBeGreaterThanOrEqual(boxes[index - 1]!.y + boxes[index - 1]!.height);
    }
    await expect(page.locator("[data-shelf-scene]")).toHaveCSS("position", "static");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390) {
      await page.locator('[data-tour-step="02"]').screenshot({ path: testInfo.outputPath("tour-mobile-card.png") });
    }
  }
});

test("touch scrolling proceeds through the mobile cards", async ({ page, context, isMobile }) => {
  test.skip(!isMobile, "Touch gesture coverage runs on touch projects.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#tour-step-01");
  const second = page.locator('[data-tour-step="02"]');
  await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
  await page.evaluate(() => document.fonts.ready);
  const input = await context.newCDPSession(page);
  async function swipeToChapter(index: number) {
    // Keep each real touch drag inside the viewport and outside the paper's
    // independent reading scroll. Re-measure to account for native touch slop.
    for (let swipe = 0; swipe < 8; swipe++) {
      const remaining = await page.locator("[data-tour-step]").nth(index)
        .evaluate(anchor => anchor.getBoundingClientRect().top - 112);
      if (Math.abs(remaining) < 32) return;
      const before = await page.evaluate(() => scrollY);
      const travel = Math.max(-320, Math.min(320, remaining));
      const startY = travel > 0 ? 600 : 200;
      await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 8, y: startY, id: 1 }] });
      try {
        for (let frame = 1; frame <= 12; frame++) {
          await input.send("Input.dispatchTouchEvent", {
            type: "touchMove", touchPoints: [{ x: 8, y: startY - travel * frame / 12, id: 1 }],
          });
          // Pace physical drag samples; this is input timing, not readiness.
          await page.waitForTimeout(24);
        }
        // Hold before release to avoid a fling overshooting the reading pose.
        await page.waitForTimeout(150);
      } finally {
        await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      }
      if (travel > 0) await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 1);
      else await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before - 1);
    }
    throw new Error(`Touch swipes did not reach card ${index + 1}`);
  }
  await swipeToChapter(1);
  await expect(second.locator("h3")).toBeInViewport();
  await expect(second).toHaveCSS("transform", "none");
  await swipeToChapter(0);
  await expect(page.locator('[data-tour-step="01"] h3')).toBeInViewport();
  await page.getByRole("link", { name: "Continue past the tour" }).click();
  await expect(page.locator("#viewer h2")).toBeInViewport();
});

test("resizing from desktop to phone removes the shelf and preserves real chapter links", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
  await page.evaluate(() => window.scrollTo(0, document.querySelector("#how")!.getBoundingClientRect().top + scrollY));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
  await expect.poll(() => page.locator("[data-shelf-book]").evaluateAll(books => books.every(book => {
    const rect = book.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth;
  }))).toBe(true);
  await page.getByRole("navigation", { name: "Guided tour steps" }).getByRole("link", { name: /^01/ }).click();
  await expect(page.locator('#tour-step-01 h3')).toBeInViewport();
  await expect(page.locator("[data-shelf-scene]")).toHaveCSS("position", "static");
});
