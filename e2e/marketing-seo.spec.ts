import { expect, test } from "@playwright/test";
test("the original landing name explanation has readable body contrast in both themes", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("switch", { name: "Dark mode" }).click();
    const ratios = await page.locator("#vivara p, #vivara dd").evaluateAll(elements => elements.map(el => {
      const context = document.createElement("canvas").getContext("2d")!;
      const ancestors: Element[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) ancestors.unshift(node);
      context.fillStyle = "white"; context.fillRect(0, 0, 1, 1);
      for (const node of ancestors) { context.fillStyle = getComputedStyle(node).backgroundColor; context.fillRect(0, 0, 1, 1); }
      const background = [...context.getImageData(0, 0, 1, 1).data];
      context.fillStyle = getComputedStyle(el).color; context.fillRect(0, 0, 1, 1);
      const foreground = [...context.getImageData(0, 0, 1, 1).data];
      const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const a = luminance(background), b = luminance(foreground);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }));
    expect(ratios.length).toBeGreaterThan(3);
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});
test("profile search privacy is present on the response and in rendered metadata", async ({ page }) => {
  const response = await page.goto("/p/e2e-portfolio-token");
  expect(response!.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});
test("marketing metadata, sitemap and schema stay separate from personal links", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Marriage biodata as a link | VivIntro");
  const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(schema["@graph"].find((item: { "@type": string }) => item["@type"] === "WebApplication").name).toBe("VivIntro");
  const sitemap = await request.get("/sitemap.xml"); const xml = await sitemap.text();
  expect(xml).toContain("/faq"); expect(xml).toContain("/guides/marriage-biodata-format"); expect(xml).not.toContain("/p/"); expect(xml).not.toContain("/account");
  for (const route of ["/about", "/trust", "/received-a-link"]) {
    await page.goto(route);
    const breadcrumb = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(breadcrumb["@type"]).toBe("BreadcrumbList");
  }
});
test("biodata guide is readable and linked from the landing page on desktop and mobile", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#questions");
    await page.getByRole("link", { name: "Read the marriage biodata guide" }).click();
    await expect(page).toHaveURL(/\/guides\/marriage-biodata-format$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Marriage biodata format");
    // Search crawlers request the route directly; inspect that response rather than transient client-navigation metadata.
    await page.reload();
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/guides\/marriage-biodata-format$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
});
