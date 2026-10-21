import { expect, test } from "@playwright/test";

for (const path of ["aditi-rao", "aditi-rao-2", "li-xu", "e2e-portfolio-token"]) {
  test(`public Introduction and interest dialog work at /p/${path}`, async ({ page }) => {
    const response = await page.goto(`/p/${path}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-template="celestial-union"]').first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue as a new visitor" })).toBeVisible();
  });
}
