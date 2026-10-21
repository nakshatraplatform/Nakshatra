import { expect, test } from "@playwright/test";

test("the Ananya story pairs real demo captures with concise sharing controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#top")).toContainText("Share one Vivara link. Update it without resending.");
  await expect(page.getByRole("heading", { name: "See what a family receives." })).toHaveCount(0);
  await expect(page.locator("#product-story article")).toHaveCount(3);
  for (const id of ["samples", "why", "privacy", "viewer", "trust", "vivara"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
  await expect(page.locator("#product-story")).toContainText("AI-generated portrait");
  await expect(page.locator("#viewer > div > article")).toHaveCount(2);
  await expect(page.locator("#privacy")).toContainText("Private notes");
  await expect(page.locator("#vivara [data-vivara-word]")).toHaveText("Vivara");
  await page.locator("#product-story").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#product-story img').evaluateAll(images => images.filter(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0).length)).toBeGreaterThan(0);
});

test("desktop story follows the chapter while phone and reduced motion remain in flow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#privacy");
  const story = page.locator("#product-story");
  await expect(story).toHaveAttribute("data-story-motion", "true");
  await expect(story).toHaveAttribute("data-story-step", "2");
  await expect(story.locator("[data-story-shot]").nth(2)).toHaveCSS("opacity", "1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(story).not.toHaveAttribute("data-story-motion", "true");
  for (const image of await story.locator("article figure").all()) await expect(image).toBeVisible();
  await expect(story.locator("aside")).toBeHidden();
  await expect(page.locator("#how")).not.toHaveAttribute("data-bookshelf", "true");
  await page.setViewportSize({ width: 932, height: 430 });
  await expect(story).not.toHaveAttribute("data-story-motion", "true");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(story).not.toHaveAttribute("data-story-motion", "true");
  await expect(page.locator("#vivara [data-vivara-word]")).toHaveCSS("transform", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

test("product-story and merged sharing cards are readable in the theme capture", async ({ page }, testInfo) => {
  await page.goto("/#privacy");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#privacy h2")).toBeInViewport();
  if (page.viewportSize()!.width >= 1000) await expect(page.locator("[data-story-shot]").nth(2)).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("product-story.png"), animations: "disabled" });
  await page.goto("/#viewer");
  await expect(page.locator("#viewer h2")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("sharing-cards.png"), animations: "disabled" });
  await page.getByRole("switch", { name: "Dark mode", checked: false }).click();
  await page.goto("/#privacy");
  await expect(page.locator("#privacy h2")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("product-story-dark.png"), animations: "disabled" });
});
