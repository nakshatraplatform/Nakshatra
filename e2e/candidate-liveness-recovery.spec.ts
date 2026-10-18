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
  await expect(page).toHaveURL("https://verify.didit.me/session/attached");
  expect(starts).toBe(1);
});

// Provider traffic is intercepted: these assertions never create a live Didit session.
test("confirmed completion owns focus, reports queued mail and stays dismissed on reload", async ({ page, context }, testInfo) => {
  await context.addCookies([recoveryTestCookie]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 640 });
  if (testInfo.project.name === "tablet-chromium") await page.addInitScript(() => localStorage.setItem("nakshatra-app-theme", "dark"));
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let checks = 0;
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    expect(["current", "check-result"]).toContain(action);
    if (action === "check-result") checks++;
    await route.fulfill({ json: { state: "verified", attemptId, deadline: null,
      cleanupPending: false, canResume: false, canCancel: false, canStart: false, emailStatus: "queued" } });
  });
  await page.goto("/verification/result");
  const dialog = page.getByRole("dialog", { name: "Liveness check complete" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/confirmation email is queued/)).toBeVisible();
  await expect.poll(() => checks).toBe(1);
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await page.screenshot({ path: testInfo.outputPath("liveness-complete.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#liveness-check")).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.reload();
  await expect(page.getByText("Your liveness check is complete.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("return automatically retries a pending result before showing completion", async ({ page, context }) => {
  await context.addCookies([recoveryTestCookie]);
  await page.clock.install();
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let checks = 0;
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    expect(["current", "check-result"]).toContain(action);
    if (action === "check-result") checks++;
    await route.fulfill({ json: { state: checks > 1 ? "verified" : "awaiting_result", attemptId,
      deadline: null, cleanupPending: false, canResume: false, canCancel: true, canStart: false,
      emailStatus: checks > 1 ? "accepted" : null } });
  });
  await page.goto("/verification/result?status=Approved");
  await expect.poll(() => checks).toBe(1);
  await expect(page.getByText(/We are confirming your liveness result/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.clock.runFor(15_100);
  await expect(page.getByRole("dialog", { name: "Liveness check complete" })).toBeVisible();
  await expect(page.getByText(/accepted by our email provider/)).toBeVisible();
  expect(checks).toBe(2);
});

test("an overlapping visibility read preserves the first-click provider handoff", async ({ page, context }) => {
  await context.addCookies([recoveryTestCookie]);
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let starts = 0, postStartReads = 0;
  let releaseFirst!: () => Promise<void>;
  const active = { state: "active", attemptId, deadline: "2099-10-06T08:00:00Z", cleanupPending: false,
    canResume: true, canCancel: true, canStart: false };
  await context.route("https://verify.didit.me/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Loopback hosted check</h1>" }));
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    if (action === "start") {
      starts++;
      return route.fulfill({ json: { attemptId, url: "https://verify.didit.me/session/race", managementUrl: "http://localhost/verify/fixture" } });
    }
    expect(action).toBe("current");
    if (starts && ++postStartReads === 1) {
      releaseFirst = () => route.fulfill({ json: active });
      return;
    }
    await route.fulfill({ json: starts ? active : { ...active, state: "not_started", attemptId: null, canResume: false, canCancel: false, canStart: true } });
  });
  await page.goto("/dashboard");
  await page.getByRole("checkbox", { name: /I consent to Didit/ }).check();
  await page.getByRole("button", { name: "Start liveness check" }).click();
  await expect.poll(() => postStartReads).toBe(1);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page).toHaveURL("https://verify.didit.me/session/race");
  await releaseFirst().catch(() => {}); // Navigation can abort the deliberately obsolete response.
  expect(starts).toBe(1);
});

test("a background-confirmed result requests its queued email after an earlier pending lookup", async ({ page, context }) => {
  await context.addCookies([recoveryTestCookie]);
  const attemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let verified = false, checks = 0;
  await context.route("**/api/identity-verification/**", async route => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1);
    expect(["current", "check-result"]).toContain(action);
    if (action === "check-result") checks++;
    await route.fulfill({ json: { state: verified ? "verified" : "awaiting_result", attemptId,
      deadline: null, cleanupPending: false, canResume: false, canCancel: !verified, canStart: false,
      emailStatus: verified ? "queued" : null } });
  });
  await page.goto("/verification/result");
  await expect.poll(() => checks).toBe(1);
  verified = true;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("dialog", { name: "Liveness check complete" })).toBeVisible();
  await expect.poll(() => checks).toBe(2);
});
