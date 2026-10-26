import { expect, test } from "@playwright/test";
import { publishedOwnerCookie } from "./support/theme-session.mjs";

test.beforeEach(async ({ context }) => { await context.addCookies([publishedOwnerCookie]); });

test("old active grants remain manageable through a server page, with error recovery", async ({ page }) => {
  const grantId = "d2840000-1111-4111-8111-000000000060";
  let unavailable = true;
  const offsets: number[] = [];
  await page.route("**/api/dashboard/relationships?**", route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    if (unavailable) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    const records = Array.from({ length: offset === 56 ? 4 : 8 }, (_, i) => ({
      kind: "grant", item: { id: offset === 56 && i === 3 ? grantId : `d2840000-1111-4111-8111-${String(offset + i + 1).padStart(12, "0")}`,
        interestRequestId: "d1840000-1111-4111-8111-000000000060", viewerName: `Older viewer ${offset + i + 1}`,
        viewerEmail: "older@example.test", status: "active", expiresAt: "2099-01-01T00:00:00Z" },
    }));
    return route.fulfill({ json: { total: 60, records, counts: { interests: 60, awaiting: 60, setAside: 0, active: 60 }, disclosure: null } });
  });
  await page.route(`**/api/access-grants/${grantId}`, async route => {
    expect(route.request().postDataJSON()).toEqual({ action: "revoke" });
    await route.fulfill({ json: { status: "revoked" } });
  });
  await page.goto("/dashboard");
  const stage = page.locator('[data-stage="access"]');
  // Wait for responsive hydration before interacting with the initially collapsed mobile stage.
  if (page.viewportSize()!.width <= 640) {
    const toggle = stage.getByRole("button", { name: /^People you’re sharing with/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
  }
  await stage.getByRole("button", { name: /View all/ }).click();
  const queue = page.getByRole("dialog", { name: "People you’re sharing with" });
  await expect(queue.getByRole("alert")).toContainText("We could not load this queue");
  unavailable = false;
  await queue.getByRole("button", { name: "Retry queue" }).click();
  await expect(queue.getByText("Page 1 of 8")).toBeVisible();
  for (let pageNumber = 2; pageNumber <= 8; pageNumber++) {
    await queue.getByRole("button", { name: "Next", exact: true }).click();
    await expect(queue.getByText(`Page ${pageNumber} of 8`)).toBeVisible();
  }
  const oldRecord = queue.getByRole("article").filter({ hasText: "Older viewer 60" });
  await oldRecord.getByRole("button", { name: "Manage", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Older viewer 60" });
  page.once("dialog", dialog => dialog.accept());
  const changed = page.waitForResponse(response => response.url().endsWith(`/api/access-grants/${grantId}`));
  await details.getByRole("button", { name: "Stop sharing", exact: true }).click();
  expect((await changed).status()).toBe(200);
  await expect(details).not.toBeVisible();
  expect(offsets).toContain(56);
});
