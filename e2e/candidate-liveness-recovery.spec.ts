import { expect, test } from "@playwright/test";
import { recoveryTestCookie } from "./support/recovery-session.mjs";
test("refresh and a second tab recover the same check; cancellation requires confirmation", async ({ page, context }, testInfo) => {
  await context.addCookies([recoveryTestCookie]);
  const candidateId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let state = { state: "active", attemptId, deadline: "2099-10-06T08:00:00Z", cleanupPending: false, canResume: true, canCancel: true, canStart: false };
  let starts = 0, resumes = 0, cancellations = 0;
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "start") starts++;
    if (action === "resume") { resumes++; expect(route.request().postDataJSON()).toEqual({ candidateId, attemptId }); return route.fulfill({ json: { url: "https://verify.didit.me/session/existing" } }); }
    if (action === "cancel") { cancellations++; state = { ...state, state: "cleanup_pending", canResume: false, canCancel: false, cleanupPending: true }; }
    await route.fulfill({ json: state });
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Resume check" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume check" }).click();
  await expect(page.getByRole("link", { name: "Continue to Didit verification" })).toHaveAttribute("href", "https://verify.didit.me/session/existing");
  const other = await context.newPage(); await other.goto("/dashboard");
  await expect(other.getByRole("button", { name: "Resume check" })).toBeVisible();
  await other.close();
  await page.getByRole("button", { name: "Cancel check" }).click();
  expect(cancellations).toBe(0);
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByText("Your previous check is being cleaned up.", { exact: false })).toBeVisible();
  expect(cancellations).toBe(1); expect(starts).toBe(0); expect(resumes).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("recovery-cleanup.png"), fullPage: true });
});
