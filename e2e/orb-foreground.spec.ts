import { expect, test, type Locator } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

async function orbInk(canvas: Locator) {
  return canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const cssColor = getComputedStyle(canvas).color;
    const ink = cssColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const bright = ink.reduce((sum, value, index) => sum + value * [0.2126, .7152, .0722][index], 0) > 127;
    // Sample the real painter. Depth may fade toward the substrate, but must
    // stay on the enclosing text's color ray, not a separate hard-coded tint.
    const shade = bright ? [0, 0, 0] : [255, 255, 255];
    const direction = shade.map((value, index) => value - ink[index]);
    const length = direction.reduce((sum, value) => sum + value * value, 0);
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let samples = 0, worstDistance = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 200) continue;
      const pixel = [...pixels.slice(index, index + 3)];
      const projection = pixel.reduce((sum, value, channel) => sum + (value - ink[channel]) * direction[channel], 0) / length;
      if (projection > .8) continue;
      const distance = Math.hypot(...pixel.map((value, channel) => value - ink[channel] - projection * direction[channel]));
      worstDistance = Math.max(worstDistance, distance);
      samples++;
    }
    return { samples, worstDistance, cssColor, background: getComputedStyle(canvas.parentElement!).backgroundColor, frame: canvas.toDataURL() };
  });
}

async function expectInk(canvas: Locator) {
  // A 32px static connecting frame has only nine fully opaque foreground
  // pixels at DPR 1; do not mistake its deliberately sparse geometry for blank.
  await expect.poll(async () => (await orbInk(canvas)).samples).toBeGreaterThan(0);
  const result = await orbInk(canvas);
  expect(result.worstDistance).toBeLessThan(3);
  expect(result.background).toBe("rgba(0, 0, 0, 0)");
  return result;
}

test("real connecting orb follows live Light/Dark text and clears on failure", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/start", async route => {
    await pending;
    await route.fulfill({ status: 503, json: { error: "Retry this sign-in" } });
  });
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Example1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const status = page.locator("[data-loading-status]:visible");
  await expect(status).toHaveText("Signing you in");
  const canvas = status.locator("canvas");
  const light = await expectInk(canvas);
  await page.screenshot({ path: info.outputPath("orb-light.png"), animations: "disabled" });
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await expect.poll(async () => (await orbInk(canvas)).cssColor).not.toBe(light.cssColor);
  const dark = await expectInk(canvas);
  expect(dark.frame).not.toBe(light.frame);
  expect(dark.cssColor).toBe(await status.locator("p").first().evaluate(element => getComputedStyle(element).color));
  await page.screenshot({ path: info.outputPath("orb-dark.png"), animations: "disabled" });
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Retry this sign-in" })).toBeVisible();
  await expect(canvas).toHaveCount(0);
});

test("inline working orb follows its button text, separately from status ink", async ({ page, context }, info) => {
  await context.addCookies([themeTestCookie]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(value => localStorage.setItem("nakshatra-app-theme", value), theme);
    await page.goto("/account");
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/account/sessions", async route => {
      await pending;
      await route.fulfill({ status: 503, json: { error: "Please retry" } });
    });
    const action = page.getByRole("button", { name: "Sign out others", exact: true });
    await action.click();
    const buttonOrb = action.locator("canvas");
    await expect(buttonOrb).toBeVisible();
    const result = await expectInk(buttonOrb);
    expect(result.cssColor).toBe(await buttonOrb.locator("..").locator("..").evaluate(element => getComputedStyle(element).color));
    await expect(buttonOrb).toHaveCSS("width", "20px");
    await expectInk(page.locator("[data-loading-status]:visible canvas"));
    await page.screenshot({ path: info.outputPath(`inline-${theme}.png`), animations: "disabled" });
    release();
    await expect(buttonOrb).toHaveCount(0);
    await expect(action).toBeEnabled();
    await page.unroute("**/api/account/sessions");
  }
});

test("destructive-action orb uses the action ink, not the neutral status tint", async ({ page, context }) => {
  // No deletion reaches a service: this synthetic account request is held and
  // answered locally with failure, just like the existing confirmation tests.
  await context.addCookies([themeTestCookie]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/account?reauth=complete");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Type DELETE/).fill("DELETE");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/account/deletion", async route => {
    await pending;
    await route.fulfill({ status: 503, json: { error: "Please retry later" } });
  });
  const action = dialog.getByRole("button", { name: "Schedule deletion", exact: true });
  await action.click();
  const orb = action.locator("canvas");
  await expect(orb).toBeVisible();
  const result = await expectInk(orb);
  const neutral = await expectInk(dialog.locator("[data-loading-status] canvas"));
  expect(result.cssColor).not.toBe(neutral.cssColor);
  expect(result.cssColor).toBe(await action.evaluate(element => getComputedStyle(element).color));
  release();
  await expect(orb).toHaveCount(0);
  await expect(action).toBeEnabled();
});
