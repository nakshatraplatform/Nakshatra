import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const challengeId = "11111111-1111-4111-8111-111111111111";
const mockOrigin = `http://127.0.0.1:${process.env.E2E_SUPABASE_PORT || 54329}`;

test("verified guest refresh unlocks only after approval and loses access after revocation", async ({ page, context }) => {
  const submitted = await context.request.post("/api/interest/guest", {
    headers: { Origin: String(test.info().project.use.baseURL || `http://127.0.0.1:${process.env.E2E_APP_PORT || 3100}`) },
    data: { action: "complete", challengeId, email: "guest@example.test", code: "123456" },
  });
  expect(submitted.status()).toBe(201);
  const proof = (await context.cookies()).find(cookie => cookie.name.startsWith("vivintro_view_"));
  expect(proof?.httpOnly).toBe(true);
  expect(proof?.path).toBe("/p/e2e-portfolio-token");
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(false);
  await page.goto("/p/e2e-portfolio-token");
  await expect(page.getByText("private-guest@example.test", { exact: true })).toHaveCount(0);
  const proofHash = createHash("sha256").update(proof!.value).digest("hex");
  await context.request.post(`${mockOrigin}/__test/guest-viewing`, { data: { proofHash, approved: true } });
  await page.reload();
  await expect(page.getByText("private-guest@example.test", { exact: true })).toBeVisible();
  await page.goto("/p/e2e-portfolio-token/horoscope");
  await expect(page.getByRole("heading", { name: /Original horoscope/ })).toBeVisible();
  await context.request.post(`${mockOrigin}/__test/guest-viewing`, { data: { proofHash, approved: false } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByAltText("Scanned original horoscope")).toHaveCount(0);
  await page.goto("/p/e2e-portfolio-token");
  await expect(page.getByText("private-guest@example.test", { exact: true })).toHaveCount(0);
});

test("forwarded viewing URL stays public until the approved email is verified on this browser", async ({ page, context }) => {
  await page.route("**/api/interest/viewing", route => {
    if (route.request().postDataJSON().action === "start") return route.fulfill({ json: { sent: true, challengeId } });
    return route.continue();
  });
  await page.goto("/p/e2e-portfolio-token/view");
  await expect(page.getByRole("heading", { name: "View the portfolio shared with you" })).toBeVisible();
  await expect(page.getByText("private-guest@example.test", { exact: true })).toHaveCount(0);
  await page.getByLabel("Approved email address").fill("guest@example.test");
  await page.getByRole("button", { name: "Send viewing code" }).click();
  await page.getByLabel("Six-digit viewing code").fill("000000");
  await page.getByRole("button", { name: "Verify and view portfolio" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That code is incorrect" })).toBeVisible();
  await page.getByLabel("Six-digit viewing code").fill("123456");
  await page.getByRole("button", { name: "Verify and view portfolio" }).click();
  await expect(page).toHaveURL(/\/p\/e2e-portfolio-token$/);
  await expect(page.getByText("private-guest@example.test", { exact: true })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(false);
});
