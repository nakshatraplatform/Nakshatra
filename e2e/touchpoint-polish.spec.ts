import { expect, test } from "@playwright/test";
import { publishedOwnerCookie, themeTestCookie } from "./support/theme-session.mjs";

test("consumer tab titles use one brand suffix", async ({ page, context }) => {
  test.setTimeout(90_000);
  for (const [path, title] of [
    ["/", "Vivara: your personal page for marriage | VivIntro"],
    ["/login", "Sign in | VivIntro"],
    ["/signup", "Create your introduction | VivIntro"],
    ["/demo", "Example introduction | VivIntro"],
    ["/p/e2e-portfolio-token", "Aditi’s marriage introduction | VivIntro"],
    ["/p/not-a-current-introduction", "Introduction unavailable | VivIntro"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
  await context.addCookies([publishedOwnerCookie]);
  await page.goto("/dashboard");
  await expect(page).toHaveTitle("Dashboard | VivIntro");
  await page.goto("/dashboard?edit=1");
  await expect(page).toHaveTitle("Edit introduction | VivIntro");
  await context.addCookies([themeTestCookie]);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Your account profile" })).toBeVisible();
  await expect(page).toHaveTitle("Settings | VivIntro");
});

for (const appearance of ["light", "dark"]) {
  test(`portfolio home opens separately without changing the introduction: ${appearance}`, async ({ page }, testInfo) => {
    const token = appearance === "dark" ? "e2e-dark-portfolio-token" : "e2e-portfolio-token";
    await page.goto(`/p/${token}`);
    const name = "VivIntro home — opens in a new tab";
    const logo = page.getByRole("banner").getByRole("link", { name, exact: true });
    await expect(logo).toHaveAttribute("target", "_blank");
    await expect(logo).toHaveAttribute("rel", "noopener noreferrer");
    const popupReady = page.waitForEvent("popup");
    await logo.click();
    const popup = await popupReady;
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/$/);
    await expect(page).toHaveURL(new RegExp(`/p/${token}$`));
    await popup.close();
    await expect(page.getByRole("contentinfo").getByRole("link", { name })).toHaveAttribute("target", "_blank");
    await expect(page.locator(".portfolio-hero h1")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`portfolio-${appearance}.png`), animations: "disabled" });
    await page.locator("#portfolio-interest").getByRole("button", { name: "Show interest", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name })).toHaveAttribute("target", "_blank");
    await expect(dialog).toHaveCSS("color-scheme", appearance);
    await expect(dialog.getByText("They’ll share more if they’d like to continue.")).toHaveCount(1);
  });
}

test("WhatsApp uses full public identity without maintenance or draft claims", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  await context.route("https://wa.me/**", route => route.fulfill({ contentType: "text/html", body: "<title>Local share capture</title>" }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Introduction link", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /download.*(?:pdf|json)/i })).toHaveCount(0);
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Share on WhatsApp", exact: true }).click();
  const popup = await opened;
  await popup.waitForURL(/wa\.me/);
  const text = new URL(popup.url()).searchParams.get("text")!;
  expect(text).toContain("Here’s my marriage introduction 🙏");
  expect(text).toContain("Aditi Rao");
  expect(text).toContain("/p/");
  expect(text).not.toMatch(/latest|always|up to date|@|\+1 617|private/i);
  expect(text).toContain("tap “Show interest”");
  await popup.close();
});
