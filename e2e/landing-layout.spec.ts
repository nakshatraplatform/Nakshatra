import { expect, test } from "@playwright/test";

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
        await expect(card).toHaveCSS("position", "relative");
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

test("frequent tour feedback is immediate and sample CTA opens the real demo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const step = page.locator('a[href="#tour-step-02"]');
  expect(await step.evaluate((element) => getComputedStyle(element, "::after").transitionDuration)).toBe("0s");
  await step.focus();
  await expect(step).toHaveCSS("outline-style", "solid");

  const sample = page.getByRole("main").getByRole("link", { name: "View a sample introduction" });
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
