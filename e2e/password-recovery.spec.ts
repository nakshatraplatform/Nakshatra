import { expect, test } from "@playwright/test";

test("recovery reaches password entry, saves, and supports sign-out failure and retry", async ({ page, context, baseURL }) => {
  await page.goto("/login");
  const started = await context.request.post(`${baseURL}/api/auth/start`, {
    headers: { Origin: baseURL! },
    data: { method: "password_recovery", email: "theme-test@example.test", redirect: "/account" },
  });
  expect(started.status()).toBe(200);
  expect((await context.cookies()).some(cookie => cookie.name.endsWith("-code-verifier"))).toBe(true);

  // Simulate an email callback that lost the nested reset destination.
  await page.goto("/api/auth/callback?code=loopback-password-recovery&next=/account");
  await expect(page).toHaveURL(/\/reset-password\?redirect=%2Faccount$/);
  await expect(page.getByRole("heading", { name: "Choose a new password." })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === "sb-127-auth-token")).toBe(true);
  await page.getByLabel("New password", { exact: true }).fill("LoopbackPassword42");
  await page.getByLabel("Confirm new password").fill("LoopbackPassword42");
  const passwordSaved = page.waitForResponse(response => response.url().endsWith("/api/auth/password") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save new password" }).click();
  expect((await passwordSaved).status()).toBe(200);
  await expect(page).toHaveURL(/\/account$/);

  let signOutRequests = 0;
  await page.route("**/auth/v1/logout*", async route => {
    signOutRequests += 1;
    if (signOutRequests === 1) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Fixture outage" }) });
    } else {
      await route.continue();
    }
  });
  await page.getByLabel("Account menu", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not sign out" })).toBeVisible();
  await expect(page).toHaveURL(/\/account$/);
  expect((await context.cookies()).some(cookie => cookie.name === "sb-127-auth-token")).toBe(true);

  if (!await page.getByRole("button", { name: "Sign out", exact: true }).isVisible()) {
    await page.getByLabel("Account menu", { exact: true }).click();
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  expect((await context.cookies()).some(cookie => cookie.name === "sb-127-auth-token")).toBe(false);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
