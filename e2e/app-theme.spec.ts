import { expect, test, type Page } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";

const key = "nakshatra-app-theme";
const brokerdeskTeamRoute = `/brokerdesk/w/wrk_${"e".repeat(32)}/settings/team`;
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("form text and placeholders meet normal-text contrast in both themes", async ({ page }) => {
  await page.goto("/login");
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(page.getByLabel("Email address")).toHaveCSS("background-color", theme === "light" ? "rgb(255, 253, 249)" : "rgb(27, 41, 50)");
    const ratios = await page.getByLabel("Email address").evaluate((input) => {
      function luminance(color: string) {
        const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return r * 0.2126 + g * 0.7152 + b * 0.0722;
      }
      const style = getComputedStyle(input);
      const background = luminance(style.backgroundColor);
      return [style.color, getComputedStyle(input, "::placeholder").color].map((color) => {
        const foreground = luminance(color);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
    });
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

test("Light default ignores device Dark; keyboard switch persists and syncs tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const hydrationErrors: string[] = [];
  page.on("console", (message) => { if (/hydration|didn't match/i.test(message.text())) hydrationErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "light");
  const toggle = page.getByRole("button", { name: "Switch to Dark theme" });
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe("dark");
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Switch to Light theme" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to Light theme" })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/privacy");
  await expect(other.getByRole("button", { name: "Switch to Light theme" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Light theme" }).click();
  await expect(other.locator("html")).toHaveAttribute("data-app-theme", "light");
  await page.evaluate((key) => localStorage.setItem(key, "dark"), key);
  await expect(other.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await page.evaluate(() => localStorage.clear());
  await expect(other.locator("html")).toHaveAttribute("data-app-theme", "light");
  expect(hydrationErrors).toEqual([]);
});

test("saved Dark is styled before hydration even with application scripts blocked", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "dark"), key);
  await page.route("**/_next/**/*.js*", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await expect(page.locator('[data-landing-variant]')).toHaveCSS("background-color", "rgb(17, 27, 34)");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});

test("invalid and blocked storage are safe and do not prevent switching", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "unsupported"), key);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "light");
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked"); } }); });
  await page.reload();
  await page.getByRole("button", { name: "Switch to Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await page.getByRole("button", { name: "Switch to Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "light");
});

test("public screens support both themes without layout overflow", async ({ page }, testInfo) => {
  for (const route of ["/", "/login", "/signup", "/reset-password", "/waitlist", "/privacy", "/verification/result", "/verify/unavailable"]) {
    await page.goto(route);
    await expect(page.getByRole("button", { name: "Switch to Dark theme" })).toBeVisible();
    await noOverflow(page);
    if (route === "/") await page.screenshot({ path: testInfo.outputPath("landing-light.png"), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(page.getByRole("button", { name: "Switch to Light theme" })).toBeVisible();
    await noOverflow(page);
    if (route === "/" || route === "/login" || route === "/waitlist") await page.screenshot({ path: testInfo.outputPath(`${route === "/" ? "landing" : route.slice(1)}-dark.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Switch to Light theme" }).click();
  }
});

test("authenticated dashboard, account and BrokerDesk retain usable themed controls", async ({ page, context }, testInfo) => {
  await context.addCookies([themeTestCookie]);
  for (const route of ["/dashboard", "/account", "/brokerdesk/onboarding", brokerdeskTeamRoute]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    if (route === "/dashboard") {
      const overview = page.getByLabel("Portfolio overview");
      await expect(overview).toBeVisible();
      expect(await overview.evaluate((element) => {
        const journey = document.querySelector('[aria-labelledby="creator-readiness-heading"]');
        return Boolean(journey && (element.compareDocumentPosition(journey) & Node.DOCUMENT_POSITION_FOLLOWING));
      })).toBe(true);
    }
    await page.getByRole("button", { name: "Switch to Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll("/", "-")}-dark.png`), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Switch to Light theme" }).click();
    await noOverflow(page);
  }
  await page.goto("/dashboard?edit=1");
  const editor = page.getByRole("dialog");
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Switch to Dark theme" }).click();
  await expect(editor.getByRole("button", { name: "Switch to Light theme" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("editor-dark.png"), fullPage: true, animations: "disabled" });
  const sectionSelect = editor.getByRole("combobox", { name: "Go to portfolio section" });
  if (await sectionSelect.isVisible()) await sectionSelect.selectOption("astrology");
  else await editor.getByRole("button", { name: /Astrology & traditions/ }).click();
  const attachment = editor.getByRole("button", { name: "Attach horoscope", exact: true });
  await expect(attachment).toHaveCSS("color", "rgb(237, 242, 239)");
  await expect(attachment).toHaveCSS("background-color", "rgb(38, 54, 64)");
  await attachment.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("editor-attachment-dark.png"), fullPage: true, animations: "disabled" });
});

test("deep BrokerDesk headers fit compact mobile widths", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Exact compact-width coverage runs once in the mobile browser project.");
  await context.addCookies([themeTestCookie]);

  for (const width of [412, 375, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(brokerdeskTeamRoute);
    await expect(page.getByRole("link", { name: "VivIntro home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Customer dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch to Dark theme" })).toBeVisible();
    await noOverflow(page);
  }
});

test("owner appearance and portaled interest forms ignore the app theme", async ({ page }) => {
  for (const [token, appearance, appTheme] of [["e2e-portfolio-token", "light", "dark"], ["e2e-dark-portfolio-token", "dark", "light"]]) {
    await page.goto("/");
    await page.evaluate(({ key, appTheme }) => localStorage.setItem(key, appTheme), { key, appTheme });
    await page.goto(`/p/${token}`);
    const portfolio = page.locator('[data-template="celestial-union"]');
    await expect(portfolio).toHaveAttribute("data-appearance", appearance);
    await expect(portfolio).toHaveCSS("color-scheme", appearance);
    await expect(page.getByRole("button", { name: /Switch to .* theme/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Show interest" }).click();
    await expect(page.getByRole("dialog")).toHaveCSS("color-scheme", appearance);
    await page.getByRole("button", { name: "Continue as a new visitor" }).click();
    await expect(page.getByLabel("Your full name")).toHaveCSS("color-scheme", appearance);
    await page.getByRole("button", { name: "Close interest form" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", appTheme);
  }
});
