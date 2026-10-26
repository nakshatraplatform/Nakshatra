import { expect, test } from "@playwright/test";

test("metadata and page share public resolution only within one request, and deferred views finish", async ({ page, request }, info) => {
  const token = `e2e-cache-${info.project.name}`;
  const counts = async () => (await request.get(`http://127.0.0.1:${process.env.E2E_SUPABASE_PORT || 54329}/__test/public-read-counts?token=${token}`)).json();
  await page.goto(`/p/${token}`);
  await expect.poll(counts).toEqual({ resolve_public_portfolio: 1, resolve_public_portfolio_identity_verified: 1, record_public_portfolio_view: 1 });
  await page.reload();
  await expect.poll(counts).toEqual({ resolve_public_portfolio: 2, resolve_public_portfolio_identity_verified: 2, record_public_portfolio_view: 2 });
});

test("an expired page does not repeat failed public resolution for availability", async ({ page, request }, info) => {
  const token = `e2e-cache-expired-${info.project.name}`;
  await page.goto(`/p/${token}`);
  await expect.poll(async () => (await request.get(`http://127.0.0.1:${process.env.E2E_SUPABASE_PORT || 54329}/__test/public-read-counts?token=${token}`)).json())
    .toEqual({ resolve_public_portfolio: 1, resolve_public_portfolio_identity_verified: 1, resolve_public_portfolio_status: 1 });
});
