import { expect, test } from "@playwright/test";
import { publishedOwnerCookie, draftOwnerCookie, legacyOwnerCookie } from "./support/theme-session.mjs";

for (const appearance of ["light", "dark"]) {
  test(`PDF action preserves dashboard layout, loading and recovery: ${appearance}`, async ({ page, context }, testInfo) => {
    await context.addCookies([publishedOwnerCookie]);
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), appearance);
    let finish!: () => Promise<void>;
    await page.route("**/api/portfolio/pdf", async route => {
      await new Promise<void>(resolve => { finish = async () => { await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "PDF_CHANGED", error: "Your introduction changed. Please download it again." }) }); resolve(); }; });
    });
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", appearance);
    const manage = page.getByRole("region", { name: "Manage link", exact: true });
    const action = manage.getByRole("button", { name: "Download PDF", exact: true });
    await expect(action).toBeVisible();
    await expect(action).toHaveCSS("min-height", "44px");
    await action.click();
    await expect(manage.getByRole("button", { name: "Preparing PDF…" })).toBeDisabled();
    await finish();
    await expect(manage.getByRole("status")).toContainText("Please download it again.");
    await expect(action).toBeEnabled();
    await action.focus(); await expect(action).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await manage.screenshot({ path: testInfo.outputPath(`download-pdf-${appearance}.png`) });
  });
}

test("unpublished and incomplete profiles do not offer a public PDF", async ({ page, context }) => {
  for (const cookie of [draftOwnerCookie, legacyOwnerCookie]) {
    await context.addCookies([cookie]); await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toHaveCount(0);
  }
});

test("owner downloads a real generated PDF and QR opens the existing introduction without redirect", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/dashboard");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^vivintro-.+\.pdf$/);
  expect(await file.failure()).toBeNull();
  await page.goto(`/i/${"q".repeat(32)}`);
  await expect(page.locator(".portfolio-hero h1")).toHaveText("Aditi Rao");
  await expect(page).toHaveURL(new RegExp(`/i/${"q".repeat(32)}$`));
  await page.goto(`/i/${"r".repeat(32)}`);
  await expect(page.getByRole("heading", { name: /unavailable/i })).toBeVisible();
});
