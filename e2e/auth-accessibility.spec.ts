import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`signup errors and account recovery preserve keyboard context (${theme})`, async ({ page }, info) => {
    await page.addInitScript(theme => localStorage.setItem("nakshatra-app-theme", theme), theme);
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByText("Confirm your email to begin. A liveness check is required before publishing.")).toBeVisible();
    await page.getByLabel("Email address").fill("example@example.test");
    await page.getByLabel("Password", { exact: true }).fill("onlyletters");
    await page.getByRole("button", { name: "Create account" }).click();
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toBeFocused();
    await expect(password).toHaveAttribute("aria-invalid", "true");
    const errorId = await page.getByRole("main").getByRole("alert").getAttribute("id");
    expect((await password.getAttribute("aria-describedby"))!.split(" ")).toContain(errorId);
    await password.fill("Wedding2026");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    const inputBounds = await password.boundingBox();
    const helpBounds = await page.locator("#signup-password-help").boundingBox();
    expect(helpBounds!.y - (inputBounds!.y + inputBounds!.height)).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole("link", { name: "Terms", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`signup-${theme}.png`), fullPage: true });

    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email address")).toBeFocused();
    await page.route("**/api/auth/start", route => route.fulfill({ json: { sent: true } }));
    await page.getByLabel("Email address").fill("example@example.test");
    await page.getByRole("button", { name: "Send recovery email" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page.getByRole("heading", { name: "Sign in to VivIntro" })).toBeFocused();
  });
}

test("invalid verification codes are associated without blaming network failures on the code", async ({ page }) => {
  await page.route("**/api/auth/start", route => route.fulfill({ json: { verificationRequired: true, email: "example@example.test" } }));
  await page.goto("/signup");
  await page.getByLabel("Email address").fill("example@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Wedding2026");
  await page.getByRole("button", { name: "Create account" }).click();
  const code = page.getByLabel("Verification code");
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await page.route("**/api/auth/verify", route => route.fulfill({ status: 400, json: { code: "OTP_REJECTED", error: "That code is incorrect or has expired." } }));
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await code.fill("654321");
  await page.route("**/api/auth/verify", route => route.fulfill({ status: 503, json: { code: "OTP_VERIFY_FAILED", error: "We could not verify the code. Please try again." } }));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Please try again");
  await expect(code).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeFocused();
});

test("password mismatch supports correction without suggesting another recovery email", async ({ page }) => {
  await page.goto("/reset-password");
  await page.getByLabel("New password", { exact: true }).fill("Wedding2026");
  const confirmation = page.getByLabel("Confirm new password");
  await confirmation.fill("Different2026");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("The passwords do not match.");
  await expect(page.getByRole("link", { name: /request a new recovery email/ })).toHaveCount(0);
  await confirmation.fill("Wedding2026");
  await page.route("**/api/auth/password", route => route.fulfill({ status: 401, json: { code: "AUTH_SESSION_INVALID", error: "We could not verify your session." } }));
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("link", { name: /request a new recovery email/ })).toBeVisible();
});
