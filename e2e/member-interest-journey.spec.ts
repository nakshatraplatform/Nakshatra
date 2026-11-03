import { expect, test } from "@playwright/test";
import { approvedViewerCookie, memberOwnerCookie } from "./support/theme-session.mjs";

test("member sends interest and shares published profile with one consent action", async ({ page, context }, testInfo) => {
  await context.addCookies([approvedViewerCookie]);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/p/aditi-rao");
    const loaded = page.waitForResponse(response => response.url().includes("/api/interest/member?"));
    await page.getByRole("button", { name: "Show interest", exact: true }).first().click();
    const contextResponse = await loaded;
    expect(await contextResponse.text()).toContain('"available":true');
    const dialog = page.getByRole("dialog");
    const send = dialog.getByRole("button", { name: /Send interest and share my full profile with/ });
    await expect(send).toBeEnabled();
    await expect(dialog.getByLabel(/Full name|Phone number|Email address/)).toHaveCount(0);
    await expect(dialog.getByText(/Drafts, owner notes and street addresses stay private/)).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (width === 375) await page.screenshot({ path: testInfo.outputPath("member-send-mobile.png"), animations: "disabled" });
    await dialog.getByRole("button", { name: /Close/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Show interest", exact: true }).first().click();
  const submission = page.waitForRequest(request => request.url().endsWith("/api/interest/member") && request.method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: /Send interest and share my full profile with/ }).click();
  expect((await submission).postDataJSON()).toMatchObject({ scope: "full_portfolio", revision: "a".repeat(32) });
  await expect(page.getByRole("dialog")).toContainText(/15 days/);
  expect((await context.cookies()).filter(cookie => cookie.name.startsWith("sb-")).map(cookie => cookie.name)).toEqual([approvedViewerCookie.name]);
});

test("recipient reviews shared member profile and accepts inline without another dialog", async ({ page, context }) => {
  await context.addCookies([memberOwnerCookie]);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Review interests" }).click();
  await expect(page.locator('[data-stage="awaiting"]').getByRole("button", { name: /Awaiting review/ })).toHaveAttribute("aria-expanded", "true");
  await page.locator('[data-stage="awaiting"]').getByRole("button", { name: "Review", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Maya Shah" });
  await expect(dialog.getByRole("link", { name: "View full profile" })).toHaveAttribute("href", "/p/aditi-rao");
  const accept = dialog.getByRole("button", { name: "Accept and share full profile", exact: true });
  await expect(accept).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Decline", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Set aside", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const decision = page.waitForRequest(request => /\/api\/interest\/[^/]+$/.test(new URL(request.url()).pathname) && request.method() === "PATCH");
  await accept.click();
  expect((await decision).postDataJSON()).toMatchObject({ decision: "approved", scope: "full_portfolio", workflow: "relationship_v2" });
  await expect(dialog).toHaveCount(0);
});
