import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), publicView: vi.fn(), complete: vi.fn(() => true), supabase: {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "www.vivintro.com", "x-forwarded-proto": "https" }) }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: async () => ({ supabase: mocks.supabase, user: { id: "owner", email: "owner@example.test" } }) }));
vi.mock("@/features/portfolio/server/dashboard-view.service", () => ({ loadDashboardView: mocks.load }));
vi.mock("@/features/portfolio/server/public-portfolio.service", () => ({ resolvePublicPortfolio: mocks.publicView }));
vi.mock("@/features/portfolio/readiness", () => ({ isProfileFullyComplete: mocks.complete }));
vi.mock("@/features/media/portfolio-photo", () => ({ isShareablePrimaryPhoto: () => true }));
vi.mock("@/app/dashboard/dashboard-client", () => ({ default: () => null }));

import DashboardPage, { generateMetadata } from "@/app/dashboard/page";

describe("dashboard public share projection", () => {
  it("does not use owner-only published fields or a different unpublished draft identity", async () => {
    const privatePublished = { personal: { name: "Owner-only stored name", dob: "1998-01-30", current_location: "Secret street" }, career: { title: "Private profession" } };
    mocks.load.mockResolvedValue({
      portfolio: { id: "portfolio", is_published: true, share_token: "public-token", published_data: privatePublished, draft_data: { personal: { name: "Unpublished draft name" } }, updated_at: "2026-10-17" },
      media: [{}], interests: [], accessSummary: { events: [], grants: [] }, publicationReadiness: {},
    });
    mocks.publicView.mockResolvedValue({ data: { personal: { name: "Public Full Name", age: 28, current_location: "Quincy, MA, United States" }, career: { title: "Public profession" } } });
    const result = await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(mocks.complete).toHaveBeenCalledWith(privatePublished, true);
    expect(mocks.publicView).toHaveBeenCalledWith(mocks.supabase, "public-token");
    expect(result.props.whatsappMessage).toContain("Public Full Name · 28 · Public profession · Quincy, USA");
    expect(result.props.whatsappMessage).not.toMatch(/Owner-only|Unpublished|Private profession|Secret street|1998/);
    mocks.publicView.mockResolvedValue(null);
    const unavailable = await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(unavailable.props.whatsappMessage).not.toMatch(/Owner-only|Unpublished|Private profession/);
  });

  it("titles the dashboard and direct editor without duplicating branding", async () => {
    expect(await generateMetadata({ searchParams: Promise.resolve({}) })).toEqual({ title: "Dashboard" });
    expect(await generateMetadata({ searchParams: Promise.resolve({ edit: "1" }) })).toEqual({ title: "Edit introduction" });
  });
});
