import { expect, test } from "@playwright/test";
import { recoveryTestCookie } from "./support/recovery-session.mjs";
test("authenticated return checks the authoritative result without starting or resuming", async ({ page, context }) => {
  await context.addCookies([recoveryTestCookie]);
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let checks = 0;
  let state = { state: "active", attemptId, deadline: "2099-10-06T08:00:00Z", cleanupPending: false, canResume: true, canCancel: true, canStart: false, emailStatus: null as string | null };
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    expect(["current", "check-result"]).toContain(action);
    if (action === "check-result") {
      checks++;
      state = { ...state, state: "verified", canResume: false, canCancel: false, emailStatus: "accepted" };
    }
    await route.fulfill({ json: state });
  });
  await page.goto("/verification/result?status=Declined");
  await expect(page.getByText("Your liveness check is complete.", { exact: true })).toBeVisible();
  await expect(page.getByText(/accepted by our email provider/i)).toBeVisible();
  expect(checks).toBe(1);
});

test("a forged approved callback cannot confirm a signed-out visitor", async ({ page }) => {
  await page.goto("/verification/result?status=Approved");
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  await expect(page.getByText("Your liveness check is complete.", { exact: true })).toHaveCount(0);
});
test("refresh and a second tab recover the same check; cancellation requires confirmation", async ({ page, context }, testInfo) => {
  await context.addCookies([recoveryTestCookie]);
  const candidateId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let state = { state: "active", attemptId, deadline: "2099-10-06T08:00:00Z", cleanupPending: false, canResume: true, canCancel: true, canStart: false };
  let starts = 0, resumes = 0, cancellations = 0;
  await context.route("https://verify.didit.me/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Loopback hosted check</h1>" }));
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
  await expect(page).toHaveURL("https://verify.didit.me/session/existing");
  const other = await context.newPage(); await other.goto("/dashboard");
  await expect(other.getByRole("button", { name: "Resume check" })).toBeVisible();
  await other.close();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Cancel check" }).click();
  expect(cancellations).toBe(0);
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByText("Your previous check is being cleaned up.", { exact: false })).toBeVisible();
  expect(cancellations).toBe(1); expect(starts).toBe(0); expect(resumes).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("recovery-cleanup.png"), fullPage: true });
});

test("Start hands off only after the returned attempt is attached and eligible", async ({ page, context }) => {
  await context.addCookies([recoveryTestCookie]);
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let started = false, starts = 0;
  await context.route("https://verify.didit.me/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Loopback hosted check</h1>" }));
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "start") { started = true; starts++; return route.fulfill({ json: { attemptId, url: "https://verify.didit.me/session/new", managementUrl: "http://localhost/verify/fixture" } }); }
    expect(action).toBe("current");
    await route.fulfill({ json: { state: started ? "active" : "not_started", attemptId: started ? attemptId : null,
      deadline: started ? "2099-10-06T08:00:00Z" : null, cleanupPending: false, canResume: started, canCancel: started, canStart: !started } });
  });
  await page.goto("/dashboard");
  await page.getByRole("checkbox", { name: /I consent to Didit/ }).check();
  await page.getByRole("button", { name: "Start liveness check" }).click();
  await expect(page).toHaveURL("https://verify.didit.me/session/new");
  expect(starts).toBe(1);
});

test("a status outage after Start offers recovery without creating another session", async ({ page, context }, testInfo) => {
  await context.addCookies([recoveryTestCookie]);
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let started = false, statusUnavailable = true, starts = 0;
  await context.route("https://verify.didit.me/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Loopback hosted check</h1>" }));
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "start") {
      started = true; starts++;
      return route.fulfill({ json: { attemptId, url: "https://verify.didit.me/session/attached", managementUrl: "http://localhost/verify/fixture" } });
    }
    expect(action).toBe("current");
    if (started && statusUnavailable) return route.fulfill({ status: 503, json: { code: "STATUS_UNAVAILABLE", error: "Status temporarily unavailable" } });
    return route.fulfill({ json: { state: started ? "active" : "not_started", attemptId: started ? attemptId : null,
      deadline: started ? "2099-10-06T08:00:00Z" : null, cleanupPending: false, canResume: started, canCancel: started, canStart: !started } });
  });
  await page.goto("/dashboard");
  await page.getByRole("checkbox", { name: /I consent to Didit/ }).check();
  await page.getByRole("button", { name: "Start liveness check" }).click();
  await expect(page.getByText("Your check was created.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start liveness check" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue to Didit verification" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Refresh check status" }).focus();
  await expect(page.getByRole("button", { name: "Refresh check status" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("created-status-outage.png"), fullPage: true });
  statusUnavailable = false;
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Resume check" })).toBeVisible();
  await expect(page.getByText("Status temporarily unavailable")).toHaveCount(0);
  await page.getByRole("link", { name: "Continue to Didit verification" }).click();
  await expect(page).toHaveURL("https://verify.didit.me/session/attached");
  expect(starts).toBe(1);
});
