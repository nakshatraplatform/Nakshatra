import { expect, test } from "@playwright/test";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Explicit asset-authoring mode records only synthetic local public content.
// Normal CI checks the same flow without rewriting shipping assets.
test.use({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625,
  video: { mode: "on", size: { width: 390, height: 780 } } });

test("Ananya's public sample has a fictional portrait and readable product chapters", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ananya Mehta");
  await expect(page.getByText("AI-generated portrait. No personal data or interest is collected here.")).toBeVisible();
  const portrait = page.getByRole("img", { name: "AI-generated fictional Ananya wearing a teal saree" }).first();
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const authoring = process.env.UPDATE_DEMO_ASSETS === "1";
  const destination = path.resolve("public/demo");
  if (authoring) await mkdir(destination, { recursive: true });
  for (const [name, target] of [["overview", "#portfolio-top"], ["story", "#personal-story"], ["privacy", "#portfolio-interest"]] as const) {
    if (name !== "overview") await page.locator(target).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    await expect(page.locator(target)).toBeInViewport();
    if (name === "privacy") await expect(page.getByRole("heading", { name: "More can be shared privately." })).toBeVisible();
    const heading = name === "overview" ? page.getByRole("heading", { level: 1 }) : page.locator(`${target} h2`).first();
    // A visible element can still be above the viewport or behind sticky chrome.
    await expect.poll(async () => {
      const bounds = await heading.boundingBox();
      const navigation = await page.getByRole("banner").boundingBox();
      return Boolean(bounds && navigation && bounds.y >= navigation.y + navigation.height + 8
        && bounds.y + bounds.height <= page.viewportSize()!.height);
    }, { message: `${name} heading must be wholly visible below navigation before capture` }).toBe(true);
    const capture = testInfo.outputPath(`ananya-${name}.png`);
    await page.screenshot({ path: capture, animations: "disabled" });
    if (authoring) {
      await copyFile(capture, path.join(destination, `ananya-${name}.png`));
      // Deliberate reading hold is recording pacing, not a readiness wait.
      await page.waitForTimeout(3500);
    }
  }
  await expect(page.getByText("This fictional sample does not collect or submit anything.", { exact: false })).toBeVisible();
  if (authoring) {
    const video = page.video();
    await page.close();
    if (!video) throw new Error("Expected the explicit demo recording");
    await copyFile(await video.path(), path.join(destination, "ananya-walkthrough.webm"));
  }
});
