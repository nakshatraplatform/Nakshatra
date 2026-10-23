import { expect, test } from "@playwright/test";

test("the landing invites real feedback without presenting invented testimonials", async ({ page }, testInfo) => {
  await page.goto("/#testimonials");
  await expect(page.locator("#testimonials h2")).toHaveText("What early users think");
  await expect(page.locator("#testimonials")).toContainText("only after they review and approve a quote");
  await page.getByRole("link", { name: /Share your experience/ }).click();
  await expect(page).toHaveURL(/\/share-feedback$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Help make introductions clearer." })).toBeVisible();
  expect((await page.getByRole("link", { name: "Skip to main content" }).boundingBox())?.y).toBeLessThan(0);
  await expect(page.getByLabel("Your email")).toHaveCount(0);
  await page.getByRole("checkbox", { name: /may contact me/ }).check();
  await expect(page.getByLabel("Your email")).toBeVisible();
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: testInfo.outputPath("feedback-form-light.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await page.screenshot({ path: testInfo.outputPath("feedback-form-dark.png"), fullPage: true, animations: "disabled" });
});

test("smaller screens show the three distinct sample stages once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#top figure")).toBeVisible();
  await expect(page.locator("#product-story article figure").first()).toBeHidden();
  await expect(page.locator("#product-story article figure").nth(1)).toBeVisible();
  await expect(page.locator("#product-story article figure").nth(2)).toBeVisible();
  await expect(page.locator("#how [data-shelf-book]")).toHaveCount(4);
});
