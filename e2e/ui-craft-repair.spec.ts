import { expect, test } from "@playwright/test";

test("phone captures preserve their complete viewport inside the hardware", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const hero = page.locator("#top figure img");
    await expect.poll(() => hero.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const images = viewport.width >= 1000
      ? [hero, page.locator("#product-story aside img").first()]
      : [hero, ...await page.locator("#product-story article figure img").all()];
    for (const image of images) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      const dimensions = await image.evaluate(element => {
        const image = element as HTMLImageElement;
        const bounds = image.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height,
          screenWidth: image.parentElement!.clientWidth, screenHeight: image.parentElement!.clientHeight,
          naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
          fit: getComputedStyle(image).objectFit };
      });
      expect(dimensions.fit).toBe("contain");
      expect(Math.abs(dimensions.screenWidth / dimensions.screenHeight - 0.5)).toBeLessThan(0.002);
      expect(Math.abs(dimensions.width / dimensions.height - dimensions.naturalWidth / dimensions.naturalHeight)).toBeLessThan(0.002);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`phone-frame-${viewport.width}.png`), animations: "disabled" });
  }
});

test("auth targets are comfortable and press feedback respects reduced motion", async ({ page }) => {
  await page.goto("/login");
  for (const name of ["Show password", "Forgot password?"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  for (const [path, selector] of [["/", "#top a[href='/signup']"], ["/signup", "button[type='submit']"], ["/signup", "button[aria-busy]"]]) {
    await page.goto(path);
    const action = page.locator(selector);
    await action.scrollIntoViewIfNeeded();
    const box = (await action.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await expect(action).not.toHaveCSS("transform", "none");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(action).toHaveCSS("transform", "none");
    } finally {
      // Release away from the action: this test must never submit or navigate.
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  }
});

test("landing header honors independent transparency and contrast preferences", async ({ page }) => {
  const session = await page.context().newCDPSession(page);
  await page.goto("/");
  const header = page.getByRole("banner");
  for (const preference of ["prefers-reduced-transparency", "prefers-contrast"]) {
    await session.send("Emulation.setEmulatedMedia", { features: [{ name: preference, value: preference === "prefers-contrast" ? "more" : "reduce" }] });
    expect(await page.evaluate(query => matchMedia(query).matches, `(${preference}: ${preference === "prefers-contrast" ? "more" : "reduce"})`)).toBe(true);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark") await page.getByRole("switch", { name: "Dark mode", checked: false }).click();
      await expect(header).toHaveCSS("backdrop-filter", "none");
      expect(await header.evaluate(element => getComputedStyle(element).backgroundColor
        === getComputedStyle(element.parentElement!).backgroundColor)).toBe(true);
    }
    await page.getByRole("switch", { name: "Dark mode", checked: true }).click();
  }
  await session.send("Emulation.setEmulatedMedia", { features: [] });
  await session.detach();
});
