import { test, expect } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

const review = { records: [], total: 0, counts: { interests: 3, awaiting: 2, setAside: 1, active: 1 },
  disclosure: { revision: "b".repeat(32), data: { privacy_mode: "balanced", personal: { name: "Published Owner", dob: "1997-02-12", gender: "female" }, contact: { contact_person: "Published contact", email: "published@example.test" } }, photoCount: 1, privatePhotoCount: 0, hasHoroscope: false } };

test("published consent must load successfully and changed revisions remain unapproved", async ({ page, context }, info) => {
  await context.addCookies([publishedOwnerCookie]);
  let reviewReads = 0, decisions = 0;
  await page.route("**/api/dashboard/relationships?queue=overview", route => {
    reviewReads += 1;
    return route.fulfill({ status: reviewReads === 1 ? 503 : 200, json: reviewReads === 1 ? { error: "Unavailable" } : review });
  });
  await page.route("**/api/interest/*", route => {
    if (route.request().method() !== "PATCH") return route.continue();
    decisions += 1;
    expect(route.request().postDataJSON()).toEqual({ decision: "approved", revision: "b".repeat(32) });
    return route.fulfill({ status: 409, json: { code: "SHARING_REVIEW_CHANGED", error: "Published details changed. Close this confirmation and review them again before sharing." } });
  });
  await page.goto("/dashboard");
  // Wait for real client readiness before reading the responsive expanded state.
  await expect(page.getByRole("button", { name: "View all interest submissions" })).toBeEnabled();
  const awaiting = page.locator('[data-stage="awaiting"]');
  if (await awaiting.getByRole("button", { name: /Awaiting review/ }).getAttribute("aria-expanded") === "false") await awaiting.getByRole("button", { name: /Awaiting review/ }).click();
  await awaiting.getByRole("button", { name: "Review", exact: true }).first().click();
  await page.getByRole("dialog", { name: "Maya Shah" }).getByRole("button", { name: "Share details", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Share details with Maya Shah/ });
  await expect(dialog.getByRole("button", { name: "Share details for 15 days" })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("We could not check");
  expect(decisions).toBe(0);
  await dialog.getByRole("button", { name: "Retry disclosure review" }).click();
  await expect(dialog.getByText("Private contact details", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("Unpublished draft changes are not included");
  await dialog.getByRole("button", { name: "Share details for 15 days" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Published details changed");
  expect(decisions).toBe(1);
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: info.outputPath("consent-revision-error.png"), animations: "disabled" });
});

test("failed Stop sharing stays visible inside details and remains retryable", async ({ page, context }, info) => {
  await context.addCookies([publishedOwnerCookie]);
  await page.route("**/api/access-grants/*", route => route.fulfill({ status: 503, json: { error: "Sharing could not be stopped. Please retry." } }));
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "View all interest submissions" })).toBeEnabled();
  const access = page.locator('[data-stage="access"]');
  if (await access.getByRole("button", { name: /People you’re sharing with/ }).getAttribute("aria-expanded") === "false") await access.getByRole("button", { name: /People you’re sharing with/ }).click();
  await access.getByRole("button", { name: "Manage", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rohan" });
  await dialog.getByRole("button", { name: "Stop sharing" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Sharing could not be stopped");
  await expect(dialog.getByRole("button", { name: "Stop sharing" })).toBeEnabled();
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: info.outputPath("revoke-error-dialog.png"), animations: "disabled" });
});

test("an owner can find and stop sharing an old grant beyond the latest fifty", async ({ page, context }) => {
  await context.addCookies([publishedOwnerCookie]);
  const grants = Array.from({ length: 51 }, (_, index) => ({ kind: "grant", item: {
    id: `b1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    interestRequestId: `b2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    viewerName: index === 50 ? "Oldest family" : `Family ${index + 1}`,
    viewerEmail: `family-${index + 1}@example.test`, sourceType: "direct", status: "active", expiresAt: "2099-01-01T00:00:00.000Z",
  } }));
  const offsets: number[] = [];
  await page.route("**/api/dashboard/relationships?**", route => {
    const params = new URL(route.request().url()).searchParams;
    const offset = Number(params.get("offset") || 0);
    offsets.push(offset);
    return route.fulfill({ json: { ...review, counts: { ...review.counts, active: 51 }, records: grants.slice(offset, offset + 8), total: 51 } });
  });
  let revokedId = "";
  await page.route("**/api/access-grants/*", route => {
    revokedId = new URL(route.request().url()).pathname.split("/").at(-1)!;
    expect(route.request().postDataJSON()).toEqual({ action: "revoke" });
    return route.fulfill({ json: { status: "revoked" } });
  });
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "View all interest submissions" })).toBeEnabled();
  const access = page.locator('[data-stage="access"]');
  if (await access.getByRole("button", { name: /People you’re sharing with/ }).getAttribute("aria-expanded") === "false") await access.getByRole("button", { name: /People you’re sharing with/ }).click();
  await access.getByRole("button", { name: /View all/ }).click();
  const list = page.getByRole("dialog", { name: "People you’re sharing with" });
  for (let number = 1; number <= 6; number++) {
    await expect(list.getByText(`Page ${number} of 7`)).toBeVisible();
    await list.getByRole("button", { name: "Next" }).click();
  }
  await expect(list.getByText("Page 7 of 7")).toBeVisible();
  await list.locator("article").filter({ hasText: "Oldest family" }).getByRole("button", { name: "Manage" }).click();
  await page.getByRole("dialog", { name: "Oldest family" }).getByRole("button", { name: "Stop sharing" }).click();
  await expect.poll(() => revokedId).toBe(grants[50].item.id);
  expect(offsets).toEqual(expect.arrayContaining([0, 8, 16, 24, 32, 40, 48]));
});
