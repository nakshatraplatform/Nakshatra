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
  await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
  await expect(book).toHaveAttribute("data-active", "true");
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


test("touch scrolling opens and reverses the mobile bookshelf", async ({ page, context, isMobile }) => {
  test.skip(!isMobile, "Touch gesture coverage runs on touch projects.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#tour-step-01");
  const first = page.locator('[data-tour-step="01"]');
  const second = page.locator('[data-tour-step="02"]');
  await expect(first).toHaveAttribute("data-active", "true");
  const distance = await page.evaluate(() => {
    const anchors = document.querySelectorAll("[data-shelf-anchor]");
    return anchors[1].getBoundingClientRect().top - anchors[0].getBoundingClientRect().top;
  });
  const input = await context.newCDPSession(page);
  // Touch outside the paper scrolls the document; overflowing paper has its own
  // native reading scroll, then chains back to the tour at the page boundary.
  await input.send("Input.synthesizeScrollGesture", { x: 8, y: 600, yDistance: -distance, speed: 1200, gestureSourceType: "touch" });
  await expect(second).toHaveAttribute("data-active", "true");
  await expect(second.locator("h3")).toBeInViewport();
  await expect(second.locator("[data-shelf-cover]")).not.toHaveCSS("transform", "none");
  await input.send("Input.synthesizeScrollGesture", { x: 8, y: 200, yDistance: distance, speed: 1200, gestureSourceType: "touch" });
  await expect(first).toHaveAttribute("data-active", "true");
  await page.getByRole("link", { name: "Continue past the tour" }).click();
  await expect(page.locator("#viewer h2")).toBeInViewport();
});

test("the closed shelf fits after resizing from desktop to phone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#how")).toHaveAttribute("data-bookshelf", "true");
  await page.evaluate(() => window.scrollTo(0, document.querySelector("#how")!.getBoundingClientRect().top + scrollY));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator("[data-shelf-book]").evaluateAll(books => books.every(book => {
    const rect = book.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth;
  }))).toBe(true);
  await page.locator('[data-shelf-cover] a').first().click();
  await expect(page.locator('[data-tour-step="01"]')).toHaveAttribute("data-active", "true");
});
