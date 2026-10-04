import { expect, test } from "@playwright/test";

test("a checked-photo badge explains itself at compact and wide sizes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The width matrix runs once in Chromium.");
  test.setTimeout(120_000);

  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [token, appearance] of [
      ["e2e-portfolio-token", "light"],
      ["e2e-dark-portfolio-token", "dark"],
    ] as const) {
      await page.goto(`/p/${token}`);
      const portfolio = page.locator('[data-template="celestial-union"]:visible');
      await expect(portfolio).toHaveAttribute("data-appearance", appearance);
      const badge = portfolio.locator(".portfolio-verified-badge");
      await expect(badge).toBeVisible();
      await expect(badge.getByText("Live photo checked")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (width === 375 || width === 1440) {
        await page.screenshot({
          path: testInfo.outputPath(`checked-photo-${width}-${appearance}.png`),
          animations: "disabled",
        });
      }
    }
  }
});

test("the fictional introduction does not claim a real photo check", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("Fictional sample introduction")).toBeVisible();
  await expect(page.locator(".portfolio-verified-badge")).toHaveCount(0);
});

test("public trust explanation matches the publication exception and link controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/trust");
  await expect(page.getByText(/limited pilot test exemption can allow publication without that check/i)).toBeVisible();
  await expect(page.getByText(/exempt introductions do not receive the Live photo checked badge/i)).toBeVisible();
  await expect(page.getByText(/Owners can unpublish or rotate a public link at any time/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("trust-375-final.png"), fullPage: true, animations: "disabled" });
});
