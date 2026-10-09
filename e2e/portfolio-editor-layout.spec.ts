import { expect, test } from "@playwright/test";
import { draftOwnerCookie } from "./support/theme-session.mjs";

test("section navigation never scrolls the editor shell or grows footer whitespace", async ({ page, context }) => {
  await context.addCookies([draftOwnerCookie]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Portfolio details", exact: true });
  for (const section of ["Education & work", "Family", "Appearance & contact", "Basics", "Education & work", "Basics"]) {
    await editor.locator("aside").getByRole("button", { name: new RegExp(section) }).click();
    await expect.poll(() => editor.evaluate(el => el.scrollTop)).toBe(0);
    await expect.poll(() => editor.locator(".dashboard-editor-footer").evaluate(el => Math.abs(el.getBoundingClientRect().bottom - innerHeight))).toBeLessThan(2);
    expect((await editor.getByRole("heading", { name: "Portfolio details", exact: true }).boundingBox())!.y).toBeGreaterThanOrEqual(0);
  }
});

test("mobile chrome leaves room for answers and contact controls align", async ({ page, context }, testInfo) => {
  await context.addCookies([draftOwnerCookie]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 640 ? 667 : 900 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Edit details", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Portfolio details", exact: true });
    await page.screenshot({ path: testInfo.outputPath(`basics-${width}.png`), animations: "disabled" });
    if (width < 640) {
      const title = await editor.getByRole("heading", { name: "Portfolio details", exact: true }).boundingBox();
      const back = await editor.getByRole("button", { name: /^(Dashboard|Back to dashboard)$/ }).boundingBox();
      expect(Math.abs(title!.y + title!.height / 2 - back!.y - back!.height / 2)).toBeLessThan(4);
      expect(await editor.locator(".dashboard-editor-scroll").evaluate(el => el.clientHeight)).toBeGreaterThan(400);
      await editor.getByLabel("Go to portfolio section").selectOption("privacy");
    } else if (width < 1024) {
      await editor.getByLabel("Go to portfolio section").selectOption("privacy");
    } else {
      await editor.locator("aside").getByRole("button", { name: /Appearance & contact/ }).click();
    }
    if (!await editor.getByLabel("Email", { exact: true }).count()) await editor.getByRole("button", { name: "Add a protected contact", exact: true }).click();
    await editor.getByLabel("Email", { exact: true }).first().scrollIntoViewIfNeeded();
    if (width >= 640) {
      const phone = await editor.getByLabel("Phone number", { exact: true }).first().boundingBox();
      const email = await editor.getByLabel("Email", { exact: true }).first().boundingBox();
      expect(Math.abs(phone!.y - email!.y)).toBeLessThan(2);
    }
    expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(editor.getByRole("heading", { name: "Portfolio details", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`contacts-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
  }
});
