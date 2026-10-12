import { expect, test, type Locator } from "@playwright/test";

async function painted(canvas: Locator) {
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) count++;
    return count;
  })).toBeGreaterThan(20);
}

test("sign-in displays a real themed orb through pending work and clears it on failure", async ({ page }, testInfo) => {
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => hydrationErrors.push(error.message));
  for (const theme of ["light", "dark"]) {
    await page.goto("/login");
    const themeButton = page.getByRole("button", { name: `Switch to ${theme === "dark" ? "Dark" : "Light"} theme` });
    if (await themeButton.isVisible()) await themeButton.click();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/auth/start", async (route) => {
      await wait;
      await route.fulfill({ status: 503, json: { error: "Sign-in temporarily unavailable" } });
    });
    await page.getByLabel("Email address").fill("owner@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Example1234");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const status = page.locator("[data-loading-status]:visible");
    await expect(status).toHaveText("Signing you in");
    await expect(page.getByRole("button", { name: "Please wait..." })).toBeDisabled();
    const canvas = status.locator("canvas");
    await painted(canvas);
    await expect(canvas).toHaveAttribute("aria-hidden", "true");
    const box = await canvas.boundingBox();
    expect(box?.width).toBe(32);
    expect(box?.height).toBe(32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (theme === "dark") await page.screenshot({ path: testInfo.outputPath("sign-in-pending-dark.png"), fullPage: true });
    release();
    await expect(page.getByRole("alert").filter({ hasText: "Sign-in temporarily unavailable" })).toHaveText("Sign-in temporarily unavailable");
    await expect(status).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    await page.unroute("**/api/auth/start");
  }
  expect(hydrationErrors).toEqual([]);
});

test("reduced motion keeps a painted static orb while the actual request remains pending", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/auth/start", async (route) => {
    await wait;
    await route.fulfill({ status: 503, json: { error: "Please retry" } });
  });
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Example1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const canvas = page.locator("[data-loading-status]:visible canvas");
  await painted(canvas);
  const frames = await canvas.evaluate(async (element: HTMLCanvasElement) => {
    const first = element.toDataURL();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return [first, element.toDataURL()];
  });
  expect(frames[0]).toBe(frames[1]);
  await expect(page.getByRole("status")).toHaveText("Signing you in");
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Please retry" })).toHaveText("Please retry");
  await expect(canvas).toHaveCount(0);
});

test("portaled interest waits retain the owner's appearance and disappear on failure", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nakshatra-app-theme", "dark"));
  await page.goto("/p/e2e-portfolio-token");
  await page.getByRole("button", { name: "Show interest" }).click();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/auth/start", async (route) => {
    await wait;
    await route.fulfill({ status: 503, json: { error: "Google unavailable" } });
  });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue with Google" }).click();
  const status = dialog.locator("[data-loading-status]");
  await expect(status).toHaveText("Connecting to Google");
  await expect(status).toHaveCSS("color-scheme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await painted(status.locator("canvas"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  release();
  await expect(dialog.getByRole("alert")).toHaveText("Google unavailable");
  await expect(status).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
});
