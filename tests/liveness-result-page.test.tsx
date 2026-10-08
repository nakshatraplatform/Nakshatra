import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const auth = vi.hoisted(() => vi.fn());
const portfolio = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("@/features/portfolio/server/dashboard.repository", () => ({ DashboardRepository: class { findPortfolioForUser = portfolio; } }));
vi.mock("@/components/theme/ThemeNavigation", () => ({ ThemeNavigation: () => null }));
vi.mock("@/components/brand/VivIntroBrand", () => ({ VivIntroBrand: () => null }));
vi.mock("@/features/identity-verification/client/identity-verification-dashboard", () => ({ IdentityVerificationDashboard: ({ candidateId }: { candidateId: string }) => <p>Authorized result for {candidateId}</p> }));
import ResultPage from "@/app/verification/result/page";
beforeEach(() => { auth.mockResolvedValue({ status: "missing_session" }); portfolio.mockResolvedValue({ data: { candidate_id: "candidate" }, error: null }); });
it("requires sign-in instead of trusting callback approval", async () => {
  const html = renderToStaticMarkup(await ResultPage());
  expect(html).toContain("Sign in to view result");
  expect(html).not.toContain("Authorized result");
  expect(portfolio).not.toHaveBeenCalled();
});
it("loads only the authenticated owner's portfolio and displays live protected status", async () => {
  auth.mockResolvedValue({ status: "authenticated", user: { id: "owner" }, supabase: {} });
  const html = renderToStaticMarkup(await ResultPage());
  expect(portfolio).toHaveBeenCalledWith("owner");
  expect(html).toContain("Authorized result for candidate");
  expect(html).toContain('href="/dashboard"');
});
it("does not present approval when status dependencies are unavailable", async () => {
  auth.mockResolvedValue({ status: "service_unavailable" });
  expect(renderToStaticMarkup(await ResultPage())).toContain("We could not load your check");
});
