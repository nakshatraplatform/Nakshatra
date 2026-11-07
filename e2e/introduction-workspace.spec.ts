import { expect, test } from "@playwright/test";
import { themeTestCookie } from "./support/theme-session.mjs";
import { introductionWorkspaceFixture } from "./support/introduction-workspace-fixture.mjs";
import { introductionActionSchema } from "../src/features/broker-introductions/server/introduction-workspace.contract";
const base = `/brokerdesk/w/wrk_${"e".repeat(32)}/introductions`;

test("broker opens an Introduction, confirms only one side, and sees honest sharing states", async ({ page, context }, testInfo) => {
  await context.addCookies([themeTestCookie]);
  const data = introductionActionSchema.parse(structuredClone(introductionWorkspaceFixture));
  if (!data.available) throw new Error("Expected an available Introduction fixture");
  await page.route("**/api/v1/brokerdesk/workspaces/*/introductions/*/share-actions", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ side: "source", action: "confirm", expectedVersion: 1 });
    data.sides[0].shareState = "broker_confirmed"; data.sides[0].confirmedAt = "2026-11-07T12:00:00Z";
    data.sides[0].rowVersion = 2; data.sides[0].canRemind = true;
    await route.fulfill({ json: { available: true, side: "source", shareState: "broker_confirmed", rowVersion: 2 } });
  });
  await page.route(/\/api\/v1\/brokerdesk\/workspaces\/[^/]+\/introductions\/bir_[0-9a-f]{32}\?view=responses$/, route => route.fulfill({ json: data }));
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Introductions", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Older Introductions" }).click();
  await expect(page.getByText("Response period ended")).toBeVisible();
  await expect(page.getByRole("link", { name: "Older Introductions" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open Introduction" }).click();
  await expect(page.getByRole("heading", { name: "Family fixture customer A & Family fixture customer B" })).toBeVisible();
  const first = page.getByRole("region", { name: "Family fixture customer A sharing actions" });
  const other = page.getByRole("region", { name: "Family fixture customer B sharing actions" });
  await first.getByRole("button", { name: "I shared with this family" }).click();
  await expect(page.getByText("Your sharing confirmation was recorded.")).toBeVisible();
  await expect(first.getByText("Broker confirmed sharing")).toBeVisible();
  await expect(other.getByText("Not recorded yet")).toBeVisible();
  await expect(first.getByText("Awaiting response")).toBeVisible();
  await expect(first.getByRole("button", { name: "I shared with this family" })).toBeDisabled();
  await expect(page.getByText(/does not confirm delivery/)).toBeVisible();
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/nak204-${testInfo.project.name}.png`, fullPage: true });
});

test("signed-out visitors cannot open broker Introduction pages", async ({ page }) => {
  await page.goto(`${base}/bir_${"a".repeat(32)}`);
  await expect(page).toHaveURL(/\/login\?redirect=%2Fbrokerdesk/);
  await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(0);
});
