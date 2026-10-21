import { expect, test } from "@playwright/test";

test("Vivara meaning and founder rationale are readable in both themes", async ({ page }, testInfo) => {
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    if (await page.locator("html").getAttribute("data-app-theme") !== theme) {
      await page.getByRole("switch", { name: "Dark mode", checked: theme !== "dark" }).click();
    }
    const meaning = page.getByRole("region", { name: "Why we call it a Vivara" });
    await expect(meaning.locator('[lang="kn"]')).toHaveText("ವಿವರ");
    await expect(meaning).toContainText("an explanation or account in detail");
    await expect(meaning.locator("dt")).toHaveText(["VivIntro", "Vivara"]);
    await expect(meaning.getByRole("link", { name: "Read the Kannada dictionary entry for vivara" })).toHaveAttribute("href", /^https:\/\/alar\.ink\//);
    await meaning.screenshot({ path: testInfo.outputPath(`vivara-meaning-${theme}.png`), animations: "disabled" });
    const founder = page.getByRole("region", { name: "Why Rahul started VivIntro" });
    await expect(founder).toContainText("Rahul’s idea");
    await expect(founder).toContainText("conversation, time and your own judgment");
    await founder.screenshot({ path: testInfo.outputPath(`vivara-founder-${theme}.png`), animations: "disabled" });
    await expect(page.locator("#top").getByRole("link", { name: "Create your Vivara" })).toHaveAttribute("href", "/signup");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
});

test("Vivara definition and FAQ are available without JavaScript", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: testInfo.project.use.baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Why we call it a Vivara" })).toContainText("In Kannada");
    const faq = page.locator("#questions details").filter({ has: page.locator("summary", { hasText: "Does someone need an account to read my Vivara?" }) });
    await faq.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(faq).toHaveAttribute("open", "");
    await expect(faq.locator("p")).toBeVisible();
    await expect(faq).toContainText("must sign in and confirm their email");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("#how article")).toHaveCount(4);
    await expect(page.locator("#product-story article figure")).toHaveCount(3);
    for (const figure of await page.locator("#product-story article figure").all()) await expect(figure).toBeVisible();
    await expect(page.locator("#product-story aside")).toBeHidden();
    await expect(page.getByRole("region", { name: "Why Rahul started VivIntro" })).toContainText("Rahul’s idea");
  } finally {
    await context.close();
  }
});
