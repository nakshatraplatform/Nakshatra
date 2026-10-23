import { expect, test } from "@playwright/test";

test("landing explains the family problem, disclosure boundary and next step", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator("#why")).toContainText("Older versions keep circulating");
  await expect(page.locator("#privacy")).toContainText("Public introduction");
  await expect(page.locator("#privacy")).toContainText(/Copies already saved can.t be recalled/);
  await expect(page.locator("#privacy")).toContainText("aren’t included in either shared view");
  await expect(page.locator("#viewer article")).toHaveCount(2);
  await expect(page.locator("#viewer").getByRole("link", { name: "Read the viewer guide" })).toHaveAttribute("href", "/received-a-link");
  await expect(page.locator("#product-story")).toContainText("fictional");
  await page.locator("#privacy").screenshot({ path: info.outputPath("privacy.png"), animations: "disabled" });
});

test("FAQ and trust disclosures remain keyboard operable in both themes", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("switch", { name: "Dark mode" }).click();
    const faq = page.locator("#questions details").first();
    await page.keyboard.press("Tab");
    await faq.locator("summary").focus();
    await expect(faq.locator("summary")).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter"); await expect(faq).toHaveAttribute("open", "");
    await page.keyboard.press("Enter"); await expect(faq).not.toHaveAttribute("open", "");
  }
  await page.goto("/trust");
  const section = page.getByRole("heading", { name: "Liveness checks", exact: true }).locator("xpath=ancestor::details");
  await expect(section).toHaveAttribute("open", "");
  await section.locator("summary").click(); await expect(section).not.toHaveAttribute("open", "");
});

test("copy, privacy details and tour fit supported widths in both themes", async ({ page }, info) => {
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("switch", { name: "Dark mode" }).click();
    for (const width of [320, 375, 414, 768, 1024, 1081, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      for (const selector of ["#privacy dl > div", "#questions details"]) {
        const fits = await page.locator(selector).evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth + 1));
        expect(fits, selector + " at " + width).toBe(true);
      }
      if (width >= 1081) {
        const heights = await page.locator("header nav a").evaluateAll(links => links.map(el => el.getBoundingClientRect().height));
        expect(Math.max(...heights)).toBeLessThanOrEqual(54);
      }
      if (width === 375) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: info.outputPath("landing-" + theme + ".png"), fullPage: true, animations: "disabled" });
      }
    }
  }
});

test("native anchors clear the sticky header at narrow and wide widths", async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/");
    if (width >= 1081) await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "How it works" }).click();
    else await page.goto("/#how");
    await expect(page.locator("#how h2")).toBeInViewport();
    expect(await page.locator("#how h2").evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(68);
  }
});

test("sample portfolio footer retains its in-flow back-to-top link", async ({ page }) => {
  for (const width of [375, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/demo");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole("link", { name: "Back to top", exact: true })).toBeVisible();
    const overlaps = await page.evaluate(() => {
      const b = document.querySelector('footer a[href="#portfolio-top"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('nav[aria-label="Portfolio help and policies"] a')].some(el => {
        const r = el.getBoundingClientRect(); return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
      });
    }); expect(overlaps).toBe(false);
  }
});

test("the three sample phases retain captions outside their phone frames", async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/");
    const images = await page.locator("#product-story article figure img").evaluateAll(elements => elements.map(el => (el as HTMLImageElement).src));
    expect(images).toHaveLength(3); expect(new Set(images).size).toBe(3);
    const story = page.locator("#product-story");
    const figures = [page.locator("#top figure")];
    if (width < 1000) {
      await expect(story.locator("article figure").first()).toBeHidden();
      figures.push(story.locator("article figure").nth(1), story.locator("article figure").nth(2));
    } else {
      await expect(story).toHaveAttribute("data-story-motion", "true");
    }
    for (const figure of figures) {
      await expect(figure).toBeVisible();
      const phone = await figure.locator(":scope > div").boundingBox(); const caption = await figure.locator("figcaption").boundingBox();
      expect(caption!.y).toBeGreaterThanOrEqual(phone!.y + phone!.height);
      expect(await figure.locator("figcaption").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    }
  }
});
