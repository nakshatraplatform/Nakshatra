import { expect, test } from "@playwright/test";
import { APP_THEME_STORAGE_KEY } from "../src/lib/app-theme";

test("shared portfolio components retain typography, contrast and keyboard behavior across owner themes", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [token, appearance, appTheme] of [["e2e-long-narrative-token", "light", "dark"], ["e2e-dark-portfolio-token", "dark", "light"]] as const) {
    await page.goto("/");
    await page.evaluate(({ theme, key }) => localStorage.setItem(key, theme), { theme: appTheme, key: APP_THEME_STORAGE_KEY });
    await page.goto(`/p/${token}`);
    const root = page.locator(".portfolio-root");
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", appTheme);
    await expect(root).toHaveAttribute("data-appearance", appearance);
    await page.evaluate(() => document.fonts.ready);
    for (const area of [page.getByRole("banner"), page.getByRole("contentinfo")]) {
      const brand = area.locator('[data-brand-variant="horizontal"]');
      await expect(brand).toHaveAttribute("data-brand-tone", appearance === "dark" ? "reverse" : "primary");
      await expect(brand.locator("img")).toHaveCount(1);
      await expect(brand.locator("img")).toHaveAttribute("src", new RegExp(`-${appearance === "dark" ? "reverse" : "primary"}\\.svg`));
    }
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveCSS("font-family", /Plus Jakarta Sans/);
    await expect(root).toHaveCSS("font-family", /Inter/);
    const pill = root.locator(".portfolio-tags span").first();
    await expect(pill).toHaveCSS("font-weight", "500");
    await expect(pill).toHaveCSS("box-shadow", /inset/);
    expect(await pill.evaluate(el => getComputedStyle(el).color)).toBe(await title.evaluate(el => getComputedStyle(el).color));
    const portrait = root.locator(".portfolio-hero-photo");
    await expect(portrait).toHaveAttribute("data-editorial-photo", "");
    await expect(portrait).toHaveCSS("filter", "saturate(0.95) contrast(1.02) sepia(0.02)");
    const motif = root.locator('.portfolio-photo-stage svg[viewBox="0 0 480 480"]');
    await expect(motif).toHaveCSS("pointer-events", "none");
    await expect(motif).toHaveCSS("opacity", "0.05");
    const galleryTitle = page.getByRole("heading", { name: "Gallery", exact: true });
    const titleBox = (await galleryTitle.boundingBox())!;
    const countBox = (await root.locator(".portfolio-gallery-meta").boundingBox())!;
    expect(countBox.y - titleBox.y - titleBox.height).toBeGreaterThanOrEqual(16);
    const badge = page.getByLabel(/Liveness checked\. A live person completed/);
    const badgeContrast = await badge.evaluate(element => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const ancestors: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
      for (const node of ancestors) {
        context.fillStyle = getComputedStyle(node).backgroundColor;
        context.fillRect(0, 0, 1, 1);
      }
      const background = [...context.getImageData(0, 0, 1, 1).data];
      context.fillStyle = getComputedStyle(element).color;
      context.fillRect(0, 0, 1, 1);
      const foreground = [...context.getImageData(0, 0, 1, 1).data];
      const luminance = (rgba: number[]) => rgba.slice(0, 3).map(value => {
        const c = value / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
      const a = luminance(background), b = luminance(foreground);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(badgeContrast).toBeGreaterThanOrEqual(4.5);
    const shadow = await root.evaluate(element => {
      const probe = document.createElement("span");
      probe.className = "shadow-xl";
      element.append(probe);
      const value = getComputedStyle(probe).boxShadow;
      probe.remove();
      return value;
    });
    expect(shadow).not.toBe("none");
    expect(shadow).not.toMatch(/rgba?\(0[ ,]0[ ,]0/);

    if (appearance === "light") {
      const opener = page.getByRole("button", { name: "Read more: Personal story" });
      const controlledId = await opener.getAttribute("aria-controls");
      const more = root.locator(`button[aria-controls="${controlledId}"]`);
      // Resolve React useId directly rather than treating colons as CSS syntax.
      const masked = await more.evaluate(el => getComputedStyle(document.getElementById(el.getAttribute("aria-controls")!)!).maskImage);
      expect(masked).toContain("linear-gradient");
      await more.focus();
      await page.keyboard.press("Enter");
      await expect(more).toHaveAttribute("aria-expanded", "true");
      expect(await more.evaluate(el => getComputedStyle(document.getElementById(el.getAttribute("aria-controls")!)!).maskImage)).toBe("none");
      await page.keyboard.press("Enter");
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await expect(more).toBeFocused();
    }
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const menu = page.getByRole("button", { name: "Open portfolio sections" });
      if (width === 375) await menu.click();
      const overview = page.getByRole("navigation", { name: "Introduction quick actions" }).getByRole("link", { name: "Overview" });
      await expect(overview).toBeVisible();
      await expect(overview).toHaveAttribute("aria-current", "location");
      expect(await overview.evaluate(el => getComputedStyle(el, "::after").height)).toBe("2px");
      if (width === 375) await page.keyboard.press("Escape");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`shared-system-${appearance}.png`), fullPage: true, animations: "disabled" });
  }
});

test("portfolio end stays bounded after scrolling, resizing, and closing interest", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/p/e2e-portfolio-token");
  const footer = page.getByRole("contentinfo");
  // Wait for the streamed footer and font layout before measuring document end.
  await expect(footer).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Open portfolio sections" }).click();
  await page.getByRole("button", { name: "Close portfolio sections" }).click();
  const end = () => page.evaluate(() => {
    const footer = document.querySelector('[data-portfolio-footer]')!;
    return { height: document.documentElement.scrollHeight, end: footer.getBoundingClientRect().bottom + scrollY,
      width: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  let previous = 0;
  for (const height of [874, 720, 874]) {
    await page.setViewportSize({ width: 402, height });
    for (let round = 0; round < 5; round++) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await expect(footer).toBeInViewport();
      const bounds = await end();
      expect(bounds.height - bounds.end).toBeLessThanOrEqual(2);
      expect(bounds.width).toBeLessThanOrEqual(bounds.viewport + 1);
      if (previous) expect(Math.abs(bounds.height - previous)).toBeLessThanOrEqual(2);
      previous = bounds.height;
    }
    const trigger = page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true });
    // WebKit may finish click auto-scrolling after scrollIntoViewIfNeeded returns.
    // Capture the actual position at activation, immediately before the portal opens.
    await trigger.evaluate(el => el.addEventListener("pointerdown", () => {
      (el as HTMLElement).dataset.scrollBeforeOpen = String(scrollY);
    }, { once: true }));
    await trigger.click();
    const savedScroll = Number(await trigger.getAttribute("data-scroll-before-open"));
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    const lockedScroll = await page.locator("body").evaluate(el => -parseFloat(el.style.top));
    expect(lockedScroll).toBeCloseTo(savedScroll, 0);
    await page.getByRole("button", { name: "Continue as a new visitor" }).click();
    await page.getByRole("button", { name: "Close interest form" }).click();
    await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - savedScroll)).toBeLessThanOrEqual(1);
    await expect(trigger).toBeFocused();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    expect((await end()).height - (await end()).end).toBeLessThanOrEqual(2);
  }
  await expect(page.getByText("A simple collection of everyday moments.", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("bounded-footer.png"), animations: "disabled" });
});

test("navbar has balanced artwork, pill actions, and no stuck touch tooltip", async ({ page }, testInfo) => {
  await page.goto("/p/e2e-portfolio-token");
  const header = page.getByRole("banner");
  const interest = header.getByRole("link", { name: "Show Interest", exact: true });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const logo = header.locator('[data-brand-variant="horizontal"]');
    const a = (await logo.boundingBox())!, b = (await interest.boundingBox())!;
    expect(a.height).toBeGreaterThanOrEqual(36);
    expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(1);
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(await interest.evaluate(el => parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThanOrEqual(22);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  if (testInfo.project.use.hasTouch) {
    await interest.tap();
    await expect(header.getByRole("tooltip")).toBeHidden();
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(header.getByRole("tooltip")).toBeHidden();
  } else {
    await interest.focus();
    await expect(header.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(header.getByRole("tooltip")).toBeHidden();
  }
  await page.screenshot({ path: testInfo.outputPath("portfolio-navbar.png"), animations: "disabled" });
});

test("candidate questions are optional except name and share the ZIP lookup", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/p/e2e-portfolio-token");
  await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
  await page.getByRole("button", { name: "Continue as a new visitor" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Contacting for").selectOption("daughter");
  await expect(dialog.getByLabel("Candidate’s full name")).toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Candidate’s email", { exact: true })).not.toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Candidate’s phone (optional)", { exact: true })).not.toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Your relationship to candidate")).toHaveCount(0);
  await expect(dialog.getByLabel("Message", { exact: true })).not.toHaveAttribute("required", "");
  await expect(dialog.getByLabel("Family context", { exact: true })).toHaveAttribute("required", "");
  await dialog.getByRole("button", { name: "Add candidate location (optional)" }).click();
  await expect(dialog.getByRole("combobox", { name: "Candidate’s location ZIP or PIN code" })).toBeVisible();
  const locationAction = dialog.getByRole("group", { name: "Candidate’s location", exact: true }).getByRole("button", { name: "Enter location manually" });
  await expect(locationAction).toHaveCSS("font-weight", "500");
  await expect(locationAction).toHaveCSS("border-radius", "12px");
  expect((await locationAction.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await dialog.getByRole("button", { name: "Remove location", exact: true }).click();
  await expect(dialog.locator('[name="candidateCountryCode"]')).toHaveCount(0);
  await dialog.getByLabel("Contacting for").selectOption("self");
  await expect(dialog.getByLabel("Candidate’s full name")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Verify email and continue" }).click();
  await expect(dialog.getByLabel("Your full name")).toBeFocused();
  await expect(dialog.getByLabel("Message", { exact: true })).toHaveAttribute("aria-invalid", "false");
  await page.screenshot({ path: testInfo.outputPath("interest-cards-errors.png"), animations: "disabled" });
});
