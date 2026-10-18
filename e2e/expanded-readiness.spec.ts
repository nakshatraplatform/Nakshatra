import { expect, test } from "@playwright/test";
import { publishedOwnerCookie, themeTestCookie } from "./support/theme-session.mjs";

test("account deletion protects keyboard focus and returns it on cancellation", async ({ page, context }, info) => {
  await context.addCookies([themeTestCookie]);
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Delete account", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Schedule account deletion?" });
  await expect(dialog.getByRole("heading")).toBeFocused();
  await expect(page.locator(".account-privacy-main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close deletion confirmation" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByLabel(/Type DELETE/)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close deletion confirmation" })).toBeFocused();
  await page.screenshot({ path: info.outputPath("account-confirmation.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator(".account-privacy-main")).not.toHaveAttribute("inert", "");

  await page.goto("/account?reauth=complete");
  await expect(dialog.getByRole("heading")).toBeFocused();
  await expect(dialog).toContainText("When you confirm deletion");
  await expect(dialog).toContainText("may take longer");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("deletion controls stay reachable on short screens and during error recovery", async ({ page, context }) => {
  await context.addCookies([themeTestCookie]);
  await page.route("**/api/account/deletion", route => route.fulfill({ status: 503, json: { error: "Please try scheduling again." } }));
  for (const viewport of [{ width: 375, height: 667 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/account?reauth=complete");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toBeFocused();
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await dialog.getByLabel(/Type DELETE/).fill("DELETE");
    const schedule = dialog.getByRole("button", { name: "Schedule deletion" });
    await schedule.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(schedule).toBeFocused();
    await expect(schedule).toBeInViewport();
    await expect(schedule).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Delete account", exact: true })).toBeFocused();
  }
});

test("personal skip links focus their main landmark and protected URLs reject indexing", async ({ page, context, request }) => {
  await context.addCookies([themeTestCookie]);
  for (const url of ["/login", "/signup", "/account", "/verify/not-a-real-token", "/verification/result"]) {
    await page.goto(url);
    const target = page.locator("main#main-content");
    await expect(target).toHaveCount(1);
    // Wait for hydration to finish before moving focus on pages with client state.
    await expect(page.getByRole("heading").first()).toBeVisible();
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await skip.focus(); await page.keyboard.press("Enter");
    await expect(target).toBeFocused();
    const response = await request.get(url);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
  }
  const access = await request.get("/access/invalid");
  expect(access.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
  expect(await access.text()).toContain('content="noindex, nofollow');
  expect((await request.get("/")).headers()["x-robots-tag"]).toBeUndefined();
});

test("photo deletion requires an explicit choice and cancellation sends nothing", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  let deletions = 0;
  await page.route("**/api/portfolio-media?*", async route => {
    if (route.request().method() === "DELETE") deletions++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Edit details", exact: true }).first().click();
  const remove = page.getByRole("button", { name: "Delete photo", exact: true }).first();
  await expect(remove).toBeVisible();
  page.once("dialog", dialog => dialog.dismiss());
  await remove.focus(); await page.keyboard.press("Enter");
  await expect(remove).toBeVisible();
  expect(deletions).toBe(0);
  page.once("dialog", dialog => dialog.accept());
  await remove.click();
  await expect.poll(() => deletions).toBe(1);
  await expect(remove).toHaveCount(0);
});
