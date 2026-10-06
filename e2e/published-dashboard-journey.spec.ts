import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test("published creator can understand sharing, requests, and Complete access", async ({ page, context }, testInfo) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.addInitScript(() => localStorage.setItem("nakshatra-app-theme", "light"));
  for (const [width, height] of [[320, 800], [375, 812], [414, 896], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your Introduction is ready to share." })).toBeVisible();
    await expect(page.getByText("This is not Didit identity verification.", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Introduction link", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Introductions and access" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (width === 375 || width === 1024 || width === 1440) {
      await page.screenshot({ path: testInfo.outputPath(`published-${width}-light.png`), fullPage: true, animations: "disabled" });
    }
    await page.getByRole("button", { name: "Switch to Dark theme" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (width === 375 || width === 1440) {
      await page.screenshot({ path: testInfo.outputPath(`published-${width}-dark.png`), fullPage: true, animations: "disabled" });
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your publishing journey" })).toHaveCount(0);
  await page.getByRole("link", { name: "Review requests" }).click();
  const awaiting = page.locator('[data-stage="awaiting"]');
  await expect(awaiting.getByRole("button", { name: /Awaiting review/ })).toHaveAttribute("aria-expanded", "true");
  await expect(awaiting.getByText("Verification pending")).toBeVisible();
  await awaiting.getByRole("button", { name: "Review", exact: true }).last().click();
  const details = page.getByRole("dialog", { name: /A long family name/ });
  await expect(details.getByText("A verified VivIntro account is required before Complete access can be granted.")).toBeVisible();
  await expect(details.getByRole("button", { name: "Grant Complete Portfolio access" })).toHaveCount(0);
  await details.getByRole("button", { name: "Close details" }).click();
  await awaiting.getByRole("button", { name: "Review", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Maya Shah" }).getByRole("button", { name: "Grant Complete Portfolio access" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("published-request-detail-mobile.png"), animations: "disabled" });
  await page.getByRole("dialog", { name: "Maya Shah" }).getByRole("button", { name: "Grant Complete Portfolio access" }).click();
  await expect(page.getByRole("dialog", { name: /Grant Complete Portfolio access to Maya Shah/ })).toContainText("Access expires 15 days after approval.");
  await expect(page.locator(".dashboard-modal-backdrop")).toHaveAttribute("inert", "");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  for (const name of ["Cancel", "Confirm Complete Portfolio for 15 days"]) {
    const box = await page.getByRole("dialog").getByRole("button", { name }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath("published-approval-mobile.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Grant Complete Portfolio access to Maya Shah/ })).toHaveCount(0);
  await page.getByRole("dialog", { name: "Maya Shah" }).getByRole("button", { name: "Close details" }).click();
  await page.getByRole("link", { name: "Manage access" }).click();
  const access = page.locator('[data-stage="access"]');
  await expect(access.getByRole("button", { name: /Complete Portfolio access/ })).toHaveAttribute("aria-expanded", "true");
  await access.getByRole("button", { name: "Manage" }).click();
  await expect(page.getByRole("dialog", { name: "Rohan" }).getByRole("button", { name: "End access" })).toBeVisible();
  await page.getByRole("dialog", { name: "Rohan" }).getByRole("button", { name: "Close details" }).click();
});
