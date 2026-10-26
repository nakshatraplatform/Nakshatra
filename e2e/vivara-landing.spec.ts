import { expect, test, type Route } from "@playwright/test";
test("product and link naming stay readable within the original landing design", async ({ page }, info) => {
  await page.goto("/");
  for (const theme of ["light","dark"]) {
    if (await page.locator("html").getAttribute("data-app-theme") !== theme) await page.getByRole("switch", {name:"Dark mode"}).click();
    await expect(page.locator("#top")).toContainText("Vivara is the link you share");
    await page.evaluate(() => window.scrollTo({top:0,behavior:"instant"}));
    await page.screenshot({path:info.outputPath("hero-" + theme + ".png"),animations:"disabled"});
    const meaning = page.getByRole("region",{name:"Why we call it a Vivara"});
    await expect(meaning.locator('[lang="kn"]')).toHaveText("ವಿವರ");
    await expect(meaning.locator("dt")).toHaveText(["VivIntro","Vivara"]);
    await expect(meaning).toContainText("The link you share");
    await meaning.screenshot({path:info.outputPath("meaning-" + theme + ".png")});
  }
});
test.describe("without JavaScript", () => {
  test.use({javaScriptEnabled:false});
  test("delayed images do not hide workflow or FAQ answers", async ({page}) => {
    const pending:Route[]=[];
    await page.route(url=>url.pathname==="/_next/image", route=>{pending.push(route);});
    try {
      await page.goto("/",{waitUntil:"domcontentloaded"});
      await expect.poll(()=>pending.length).toBeGreaterThan(0);
      await expect(page.locator("#how article")).toHaveCount(4);
      const faq=page.locator("#questions details").first();
      await faq.locator("summary").focus(); await page.keyboard.press("Enter");
      await expect(faq.locator("p")).toBeVisible();
    } finally { await Promise.all(pending.map(route=>route.abort())); }
  });
  test("all answers and naming work without animation or hydration", async ({page}) => {
    await page.goto("/"); await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("#questions details")).toHaveCount(6);
    await page.getByRole("link",{name:"Read all questions"}).click();
    await expect(page.locator("main h2")).toHaveCount(10);
    await page.goto("/"); await expect(page.locator("#vivara")).toContainText("The product.");
  });
});
