// @vitest-environment jsdom

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Portfolio, PortfolioData, PortfolioMedia } from "../src/types/portfolio";
import { brokerIntroductionRouteRefSchema } from "../src/features/security/public-reference";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  clearLocalSession: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  renew: vi.fn(),
  rotate: vi.fn(),
  unpublish: vi.fn(),
  manageAccess: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  updateProgress: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/account/client/account.api", () => ({
  clearLocalAccountSession: mocks.clearLocalSession,
}));
vi.mock("@/features/portfolio/client/portfolio-dashboard.api", () => ({
  saveDashboardDraftRequest: mocks.save,
  publishPortfolioRequest: mocks.publish,
  renewPortfolioLinkRequest: mocks.renew,
  rotatePortfolioLinkRequest: mocks.rotate,
  unpublishPortfolioRequest: mocks.unpublish,
  uploadPortfolioPhotoRequest: mocks.upload,
  updatePortfolioPhotoRequest: mocks.update,
  deletePortfolioPhotoRequest: mocks.remove,
  updatePublicationProgressRequest: mocks.updateProgress,
}));
vi.mock("@/features/access/client/access-dashboard.api", () => ({
  manageAccessGrantRequest: mocks.manageAccess,
}));

import DashboardClient from "../src/app/dashboard/dashboard-client";

const data: PortfolioData = {
  personal: { name: "Aditi Rao", dob: "1996-08-12", gender: "female" },
  vitals: {}, astrology: { rashi: "kanya" }, education: {}, career: {}, family: {}, lifestyle: {}, contact: {},
  style: { template_name: "Royal Heritage" },
};

const readyData: PortfolioData = {
  ...data,
  personal: {
    ...data.personal,
    first_name: "Aditi",
    last_name: "Rao",
    current_location: "Boston",
    place_of_birth: "Bengaluru",
    short_bio: "A thoughtful introduction.",
  },
  career: { title: "Engineer" },
  vitals: { gotra: "Kashyap" },
  astrology: {
    rashi: "kanya",
    nakshatra: "Uttara Phalguni",
    pada: "2",
    time_of_birth: "09:15",
    manglik_status: "No",
  },
};

const readyPublicationReadiness = {
  portfolioExists: true,
  lastEditorSection: "privacy" as const,
  previewedAt: "2026-01-01T00:00:00.000Z",
  selectedPlanCode: "launch_30",
  verificationStatus: "verified" as const,
  paymentStatus: "paid" as const,
  paymentExpiresAt: "2099-01-01T00:00:00.000Z",
  paymentActive: true,
  disclosureConfirmed: true,
  published: true,
  missingRequired: [],
};

const portfolio: Portfolio = {
  id: "portfolio-1", user_id: "user-1", share_token: "token", draft_data: data,
  published_data: data, template_id: 3, theme_color: "#17151c", sun_sign: "kanya",
  is_published: true, published_at: "2026-01-01", expires_at: "2026-12-31",
  last_renewed_at: null, created_at: "2026-01-01", updated_at: "2026-01-01",
};

const media: PortfolioMedia = {
  id: "media-1", portfolio_id: "portfolio-1", storage_path: "one.webp",
  thumbnail_path: "one-thumb.webp", media_type: "gallery", visibility: "public",
  sort_order: 0, alt_text: "Portrait",
};
const accessGrantId = "11111111-1111-4111-8111-111111111111";

function renderDashboard(overrides: Partial<React.ComponentProps<typeof DashboardClient>> = {}) {
  return render(<DashboardClient portfolio={portfolio} viewCount={12} userEmail="aditi@example.com"
    canCreatePortfolio
    shareUrl="https://nakshatra.test/p/token" isExpired daysLeft={0} media={[media]}
    mediaUrls={{ "media-1": "https://signed.test/one-thumb.webp" }} {...overrides} />);
}

function goToFoundation() {
  if (screen.queryByRole("heading", { name: "The essentials" })) return;
  fireEvent.click(screen.getByRole("button", { name: /Basics/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  vi.spyOn(window, "open").mockImplementation(() => null);
  mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1" } });
  mocks.publish.mockResolvedValue({ ok: true, data: {} });
  mocks.renew.mockResolvedValue({ ok: true, data: {} });
  mocks.rotate.mockResolvedValue({ ok: true, data: {} });
  mocks.unpublish.mockResolvedValue({ ok: true, data: {} });
  mocks.manageAccess.mockResolvedValue({ ok: true, status: "renewed", expiresAt: "2099-02-01T12:00:00.000Z" });
  mocks.remove.mockResolvedValue({ ok: true, data: {} });
  mocks.update.mockImplementation(async (_id, changes) => ({ ok: true, data: { media: { ...media, ...changes } } }));
  mocks.upload.mockResolvedValue({
    ok: true,
    data: { media: { ...media, id: "media-2" }, previewUrl: "https://signed.test/media-2.webp" },
  });
  mocks.updateProgress.mockResolvedValue({
    ok: true,
    data: { readiness: readyPublicationReadiness },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dashboard client", () => {
  it("shows identity-verification actions only after a saved candidate is linked", () => {
    renderDashboard({ portfolio: { ...portfolio, candidate_id: "candidate-1" } });
    expect(screen.getByRole("heading", { name: "Identity verification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify myself" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create candidate invitation" })).toBeInTheDocument();
  });

  it("opens the canonical editor when requested by an editing route", () => {
    renderDashboard({ initialEditorOpen: true });
    expect(screen.getByRole("heading", { name: "Portfolio details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Portfolio completion steps" })).toHaveAttribute("aria-valuenow", "1");
    goToFoundation();
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(screen.queryByText("Rashi palette")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Music")).not.toBeInTheDocument();
  });

  it("opens a new private draft, edits it, saves it, and exposes the gated final review", async () => {
    renderDashboard({ portfolio: null, shareUrl: null, media: [] });
    expect(screen.getByText(/one clear introduction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start with the basics/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "New" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Name" } });
    fireEvent.change(
      screen.getByLabelText("Brief personal introduction"),
      { target: { value: "A story" } }
    );
    fireEvent.change(screen.getByLabelText("Date of birth"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Gender"), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText("Height"), {
      target: { value: `5'5"` },
    });
    fireEvent.change(screen.getByLabelText("Marital status"), {
      target: { value: "Never Married" },
    });
    expect(screen.queryByText("Portfolio template")).not.toBeInTheDocument();
    const palette = screen.queryAllByRole("button").find((button) => button.textContent?.includes("#"));
    if (palette) fireEvent.click(palette);
    fireEvent.click(screen.getByRole("button", { name: /add photos/i }));
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    fireEvent.click(screen.getByRole("button", { name: /start with the basics/i }));
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /review before publishing/i }));
    expect(await screen.findByRole("dialog", { name: /check both views before publishing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open public introduction/i })).toHaveAttribute("href", "/preview");
    expect(screen.getByRole("link", { name: /open complete portfolio/i })).toHaveAttribute("href", "/approved-preview");
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Complete required details" })).toBeDisabled();
    expect(mocks.publish).not.toHaveBeenCalled();
  }, 10_000);

  it("operates published-link controls and signs out", async () => {
    renderDashboard({ isExpired: false, daysLeft: 20 });
    expect(screen.getByRole("link", { name: /preview complete portfolio/i })).toHaveAttribute("href", "/approved-preview");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /share portfolio/i }));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining("wa.me"), "_blank");
    const whatsappUrl = String(vi.mocked(window.open).mock.calls[0][0]);
    expect(decodeURIComponent(whatsappUrl)).toContain("Sharing Aditi Rao's VivIntro wedding portfolio");
    expect(decodeURIComponent(whatsappUrl)).toContain("This link opens the selected public Introduction");
    expect(decodeURIComponent(whatsappUrl)).toContain("The Complete Portfolio is shared only after the profile owner approves");
    fireEvent.click(screen.getByRole("button", { name: /rotate link/i }));
    await waitFor(() => expect(mocks.rotate).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /unpublish/i }));
    await waitFor(() => expect(mocks.unpublish).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(mocks.clearLocalSession).toHaveBeenCalled());
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("uses lifecycle-aware primary actions and expiry statistics", async () => {
    const { rerender } = renderDashboard({ isExpired: false, daysLeft: 6 });
    expect(screen.getByRole("button", { name: "Share portfolio" })).toBeInTheDocument();
    expect(screen.getByText("Public link").closest(".dashboard-stat-card")).toHaveAttribute(
      "data-link-state",
      "warning"
    );

    rerender(
      <DashboardClient
        portfolio={portfolio}
        viewCount={12}
        userEmail="aditi@example.com"
        canCreatePortfolio
        shareUrl="https://nakshatra.test/p/token"
        isExpired
        daysLeft={0}
        media={[media]}
        mediaUrls={{ "media-1": "https://signed.test/one-thumb.webp" }}
      />
    );

    expect(screen.getByText("Public link").closest(".dashboard-stat-card")).toHaveAttribute(
      "data-link-state",
      "expired"
    );
    fireEvent.click(screen.getByRole("button", { name: "Renew public link" }));
    await waitFor(() => expect(mocks.renew).toHaveBeenCalled());
  });

  it("opens final review from a complete unpublished draft without duplicating editor actions", async () => {
    renderDashboard({
      portfolio: {
        ...portfolio,
        draft_data: readyData,
        published_data: null,
        is_published: false,
        share_token: null,
      },
      shareUrl: null,
      isExpired: false,
      daysLeft: null,
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: { ...readyPublicationReadiness, published: false },
    });

    expect(screen.queryByRole("button", { name: "Portfolio details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and publish" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(await screen.findByRole("dialog", { name: /check both views before publishing/i })).toBeInTheDocument();
  });

  it("lets an owner approve a signed-in interest from the dashboard", async () => {
    const decisionFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "approved" }), { status: 200 })
    );
    vi.stubGlobal("fetch", decisionFetch);
    const disclosureData: PortfolioData = {
      ...data,
      education: { degree: "MS", institution: "Northeastern" },
      career: { title: "Engineer", company: "Nakshatra" },
      family: { father: { name: "Rao", occupation: "Engineer" } },
      lifestyle: { languages: "English, Telugu" },
      preferences: { narrative: "A kind partnership." },
      contact: { contacts: [{ name: "Rao", email: "family@example.com" }] },
    };
    renderDashboard({
      portfolio: { ...portfolio, draft_data: disclosureData, published_data: disclosureData },
      interests: [{
        id: "interest-1",
        viewer_name: "Rohan Mehta",
        viewer_phone: "+1 555 010 2200",
        viewer_email: "rohan@example.com",
        viewer_family_context: "Our family is based in Toronto and Bengaluru.",
        message: "We would be glad to introduce our families.",
        status: "new",
        requester_user_id: "viewer-1",
        metadata: { profile_for: "self", country: "Canada", state: "Ontario", city: "Toronto" },
        created_at: "2026-08-09T12:00:00.000Z",
        email_verified: true,
        source_type: "direct",
        broker_name: null,
        broker_representative_name: null,
        requester_portfolio_token: "rohan-portfolio-token",
      }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Toronto, Ontario, Canada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grant Complete Portfolio access" }));

    const approval = screen.getByRole("dialog", { name: /Grant Complete Portfolio access to Rohan Mehta/i });
    expect(within(approval).getByText(/Access expires 15 days after approval/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Personal profile, location, and story details/i)).toBeInTheDocument();
    expect(within(approval).getByText("Exact date of birth")).toBeInTheDocument();
    expect(within(approval).getByText(/Education, employer, career/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Family members, origins/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Lifestyle, languages/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Partner preferences/i)).toBeInTheDocument();
    expect(within(approval).getByText("Protected contact details")).toBeInTheDocument();
    expect(decisionFetch).not.toHaveBeenCalled();
    fireEvent.click(within(approval).getByRole("button", { name: "Confirm Complete Portfolio for 15 days" }));

    await waitFor(() => expect(decisionFetch).toHaveBeenCalledWith(
      "/api/interest/interest-1",
      expect.objectContaining({ method: "PATCH" })
    ));
    expect(await screen.findByText("0 waiting")).toBeInTheDocument();
  });

  it("lets the owner renew and revoke Complete Portfolio access", async () => {
    renderDashboard({
      accessSummary: {
        grants: [{
          id: accessGrantId,
          interestRequestId: "22222222-2222-4222-8222-222222222222",
          viewerName: "Rohan Mehta",
          status: "active",
          expiresAt: "2099-01-01T12:00:00.000Z",
          renewedAt: null,
          revokedAt: null,
          lastAccessedAt: null,
        }],
        events: [{
          id: 1,
          eventType: "grant_created",
          viewerName: "Rohan Mehta",
          createdAt: "2026-08-16T00:00:00.000Z",
          metadata: {},
        }],
      },
    });

    expect(screen.getByText("Active until Jan 1, 2099")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: "Renew 15 days" }));
    await waitFor(() => expect(mocks.manageAccess).toHaveBeenCalledWith(accessGrantId, "renew"));
    expect(await screen.findByText("Active until Feb 1, 2099")).toBeInTheDocument();

    mocks.manageAccess.mockResolvedValueOnce({ ok: true, status: "revoked" });
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: "End access" }));
    await waitFor(() => expect(mocks.manageAccess).toHaveBeenCalledWith(accessGrantId, "revoke"));
    fireEvent.click(screen.getByRole("button", { name: /Access history/i }));
    expect(screen.getByText("Complete Portfolio access granted to Rohan Mehta")).toBeInTheDocument();
  });

  it("updates, deletes, and uploads owner photos", async () => {
    const { container } = renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    goToFoundation();
    expect(screen.getByText("1/8")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Profile photo" })).toHaveClass("w-36", "sm:w-40");
    const portrait = await screen.findByAltText("Portrait");
    expect(portrait).toHaveAttribute("src", "https://signed.test/one-thumb.webp");
    expect(portrait.parentElement).toHaveClass("h-36", "sm:h-40");
    expect(screen.getByRole("button", { name: /add photos/i })).toHaveClass("h-36", "w-36", "sm:h-40", "sm:w-40");
    const visibility = screen.getByLabelText("Photo visibility");
    expect(within(visibility).getByRole("option", { name: "Blurred until approval" })).toBeInTheDocument();
    expect(within(visibility).getByRole("option", { name: "Visible to all" })).toBeInTheDocument();
    expect(within(visibility).queryByRole("option", { name: "Approved interest only" })).not.toBeInTheDocument();
    expect(within(visibility).queryByRole("option", { name: "Only me" })).not.toBeInTheDocument();
    fireEvent.change(visibility, { target: { value: "interest_required" } });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("media-1", { visibility: "interest_required" }));
    fireEvent.click(screen.getByRole("button", { name: /make primary photo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("media-1", { media_type: "hero" }));
    fireEvent.click(screen.getByRole("button", { name: /delete photo/i }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("media-1"));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["photo"], "portrait.png", { type: "image/png" })] } });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
  });

  it("redirects expired sessions and shows ordinary API failures", async () => {
    mocks.save.mockResolvedValueOnce({ ok: false, error: { code: "AUTH_SESSION_MISSING", message: "Sign in" } });
    mocks.publish.mockResolvedValueOnce({ ok: false, error: { code: "PUBLISH_FAILED", message: "Complete required fields" } });
    const first = renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: readyPublicationReadiness,
    });
    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    goToFoundation();
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?error=session_expired"));
    first.unmount();
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1" } });
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: readyPublicationReadiness,
    });
    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    fireEvent.click(screen.getByRole("button", { name: /review saved changes/i }));
    expect(await screen.findByRole("dialog", { name: /check both views before publishing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open public introduction/i })).toHaveAttribute("href", "/preview");
    expect(screen.getByRole("link", { name: /open complete portfolio/i })).toHaveAttribute("href", "/approved-preview");
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /publish reviewed changes/i }));
    expect(await screen.findByText(/complete required fields/i)).toBeInTheDocument();
  });

  it("confirms disclosure and publishes reviewed edits in one action", async () => {
    const disclosurePending = {
      ...readyPublicationReadiness,
      disclosureConfirmed: false,
    };
    mocks.updateProgress.mockImplementation(async (action) => ({
      ok: true,
      data: {
        readiness: action.action === "confirm_disclosure"
          ? readyPublicationReadiness
          : disclosurePending,
      },
    }));
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: disclosurePending,
    });

    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    fireEvent.click(screen.getByRole("button", { name: /review saved changes/i }));
    expect(await screen.findByRole("dialog", { name: /check both views before publishing/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirm & publish changes/i }));

    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({
      action: "confirm_disclosure",
      value: "publication-disclosure-v1",
    }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      personal: expect.objectContaining({ first_name: "Aditi" }),
    })));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("distinguishes direct and broker introductions and only links authenticated portfolios", () => {
    renderDashboard({
      interests: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          viewer_name: "Maya Shah",
          viewer_phone: "+1 555 010 3300",
          viewer_email: "maya@example.com",
          viewer_family_context: "Our families share similar values.",
          message: "I would be glad to connect.",
          status: "new",
          requester_user_id: "22222222-2222-4222-8222-222222222222",
          metadata: { profile_for: "self", city: "Boston" },
          created_at: "2026-08-10T12:00:00.000Z",
          email_verified: true,
          source_type: "direct",
          broker_name: null,
          broker_representative_name: null,
          requester_portfolio_token: "maya-authenticated-token",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          viewer_name: "Arjun Nair",
          viewer_phone: "+91 90000 10000",
          viewer_email: "arjun@example.com",
          viewer_family_context: null,
          message: "Introduced with the family's permission.",
          status: "new",
          requester_user_id: "44444444-4444-4444-8444-444444444444",
          metadata: { profile_for: "son", city: "Bengaluru" },
          created_at: "2026-08-11T12:00:00.000Z",
          email_verified: true,
          source_type: "broker",
          broker_name: "Sanskriti Introductions",
          broker_representative_name: "Priya Menon",
          requester_portfolio_token: null,
        },
      ],
    });

    expect(screen.getByText("Direct introduction")).toBeInTheDocument();
    expect(screen.getByText("Broker introduction")).toBeInTheDocument();
    const mayaCard = screen.getByText("Maya Shah").closest("article");
    expect(mayaCard).not.toBeNull();
    fireEvent.click(within(mayaCard as HTMLElement).getByRole("button", { name: "Review" }));
    expect(screen.getByRole("link", { name: "View their VivIntro portfolio" })).toHaveAttribute(
      "href",
      "/p/maya-authenticated-token"
    );
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    const arjunCard = screen.getByText("Arjun Nair").closest("article");
    expect(arjunCard).not.toBeNull();
    fireEvent.click(within(arjunCard as HTMLElement).getByRole("button", { name: "Review" }));
    expect(screen.getByText("Priya Menon")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("keeps only the latest three records on the dashboard and paginates the full queue", () => {
    const interests = Array.from({ length: 9 }, (_, index) => ({
      id: `interest-${index + 1}`,
      viewer_name: `Viewer ${index + 1}`,
      viewer_phone: null,
      viewer_email: `viewer${index + 1}@example.com`,
      viewer_family_context: null,
      message: `Message ${index + 1}`,
      status: "new",
      requester_user_id: `viewer-${index + 1}`,
      metadata: { profile_for: "self" },
      created_at: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      email_verified: true,
      source_type: index % 2 === 0 ? "direct" as const : "broker" as const,
      broker_name: index % 2 === 0 ? null : "Trusted Broker",
      broker_representative_name: null,
      requester_portfolio_token: null,
    }));
    renderDashboard({ interests });

    expect(screen.getByText("Viewer 9")).toBeInTheDocument();
    expect(screen.getByText("Viewer 8")).toBeInTheDocument();
    expect(screen.getByText("Viewer 7")).toBeInTheDocument();
    expect(screen.queryByText("Viewer 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View all (9)" }));
    const dialog = screen.getByRole("dialog", { name: "Awaiting review" });
    expect(within(dialog).getByText("Page 1 of 2")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viewer 1")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Next/i }));
    expect(within(dialog).getByText("Viewer 1")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText("Search by name or email"), { target: { value: "Viewer 4" } });
    expect(within(dialog).getByText("Viewer 4")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viewer 5")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close and return to dashboard" }));
    expect(screen.queryByRole("dialog", { name: "Awaiting review" })).not.toBeInTheDocument();
  });

  it("moves ended access out of the active queue and into history", () => {
    renderDashboard({
      accessSummary: {
        grants: [
          { id: "active-grant", interestRequestId: "interest-active", viewerName: "Active Viewer", status: "active", expiresAt: "2099-01-01T00:00:00.000Z" },
          { id: "expired-grant", interestRequestId: "interest-expired", viewerName: "Expired Viewer", status: "expired", expiresAt: "2025-01-01T00:00:00.000Z" },
          { id: "ended-grant", interestRequestId: "interest-ended", viewerName: "Ended Viewer", status: "revoked", expiresAt: "2099-01-01T00:00:00.000Z", revokedAt: "2026-01-01T00:00:00.000Z" },
        ],
        events: [],
      },
    });

    expect(screen.getByText("Active Viewer")).toBeInTheDocument();
    expect(screen.queryByText("Expired Viewer")).not.toBeInTheDocument();
    expect(screen.queryByText("Ended Viewer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Access history/i }));
    const history = screen.getByRole("dialog", { name: "Relationship history" });
    expect(within(history).getByText("Expired Viewer")).toBeInTheDocument();
    expect(within(history).getByText("Ended Viewer")).toBeInTheDocument();
  });

  it("keeps broker introduction responses in relationship history instead of expanding the dashboard", () => {
    renderDashboard({
      brokerIntroductionResponses: [{
        introductionRef: brokerIntroductionRouteRefSchema.parse(`bir_${"d".repeat(32)}`),
        brokerName: "Sangam Matchmakers",
        recipientLabel: "Priya Shah",
        response: "accepted",
        comment: "The family would like to continue the conversation.",
        respondedAt: "2026-08-12T12:00:00.000Z",
      }],
    });

    expect(screen.queryByText("Sangam Matchmakers")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Access history/i }));
    const history = screen.getByRole("dialog", { name: "Relationship history" });
    expect(within(history).getByText("Priya Shah")).toBeInTheDocument();
    expect(within(history).getByText("Broker introduction")).toBeInTheDocument();
    fireEvent.click(within(history).getByRole("button", { name: "Open details" }));
    expect(screen.getByRole("dialog", { name: "Priya Shah" })).toBeInTheDocument();
    expect(screen.getByText("Sangam Matchmakers")).toBeInTheDocument();
    expect(screen.getByText("The family would like to continue the conversation.")).toBeInTheDocument();
  });

  it("removes the publishing journey after a ready portfolio is published", () => {
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: readyPublicationReadiness,
      isExpired: false,
      daysLeft: 30,
    });

    expect(screen.queryByText("Your publishing journey")).not.toBeInTheDocument();
    expect(screen.getByText("Portfolio active")).toBeInTheDocument();
  });

  it("cancels publication review without changing the public portfolio", async () => {
    renderDashboard({ initialEditorOpen: true });
    fireEvent.click(screen.getByRole("button", { name: "Review saved changes" }));
    expect(await screen.findByRole("dialog", { name: /check both views before publishing/i })).toBeInTheDocument();
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /check both views before publishing/i })).not.toBeInTheDocument());
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("keeps interests, access history, and stats visible while unpublished", () => {
    renderDashboard({
      portfolio: { ...portfolio, is_published: false, share_token: null },
      shareUrl: null,
      viewCount: 8,
      interests: [{
        id: "interest-unpublished",
        viewer_name: "Maya Shah",
        viewer_phone: null,
        viewer_email: "maya@example.com",
        viewer_family_context: null,
        message: null,
        status: "new",
        requester_user_id: "viewer-2",
        metadata: null,
        created_at: "2026-08-10T12:00:00.000Z",
        email_verified: true,
        source_type: "direct",
        broker_name: null,
        broker_representative_name: null,
        requester_portfolio_token: null,
      }],
      accessSummary: {
        grants: [],
        events: [{
          id: 7,
          eventType: "portfolio_unpublished",
          viewerName: null,
          createdAt: "2026-08-11T12:00:00.000Z",
          metadata: {},
        }],
      },
    });

    expect(screen.getByRole("heading", { name: "Introductions and access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Awaiting review/i })).toBeInTheDocument();
    expect(screen.getByText("Maya Shah")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Access history/i }));
    expect(screen.getByText("Portfolio unpublished")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Public sharing is off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Share on WhatsApp/i })).not.toBeInTheDocument();
  });

  it("shows disclosure details only for fields hidden until approval", () => {
    renderDashboard({ initialEditorOpen: true });
    fireEvent.change(screen.getByLabelText("Go to portfolio section"), { target: { value: "privacy" } });
    fireEvent.click(screen.getByRole("button", { name: /Brief Introduction/i }));
    goToFoundation();
    expect(screen.queryByText(/Shown in:/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Shown after approval").length).toBeGreaterThan(0);
  });

  it("preserves unsaved answers, offers retry, and warns before closing", async () => {
    mocks.save.mockResolvedValueOnce({
      ok: false,
      error: { code: "DASHBOARD_SAVE_FAILED", message: "We could not save your portfolio right now." },
    });
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    fireEvent(window, beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    vi.mocked(confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(screen.getByRole("heading", { name: "Portfolio details" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still on this screen.");
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  });

  it("does not loop autosave requests after a failed attempt", async () => {
    vi.useFakeTimers();
    mocks.save.mockResolvedValue({
      ok: false,
      error: { code: "DASHBOARD_SAVE_FAILED", message: "Save unavailable", status: 500 },
    });
    renderDashboard({ initialEditorOpen: true });
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Updated" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it("requires an explicit choice for legacy photo privacy without expanding access", () => {
    renderDashboard({ media: [{ ...media, visibility: "hidden" }] });
    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    goToFoundation();
    expect(screen.getByLabelText("Photo visibility")).toHaveValue("");
    expect(screen.getByText(/existing privacy remains unchanged/i)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses a distinct redirect reason for an explicitly revoked session", async () => {
    mocks.save.mockResolvedValueOnce({
      ok: false,
      error: { code: "AUTH_SESSION_REVOKED", message: "This session was signed out", status: 401 },
    });
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /portfolio details/i }));
    goToFoundation();
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?error=session_revoked"));
  });

  it("keeps the paused-creator notice on a theme-aware contrast surface", () => {
    renderDashboard({ portfolio: { ...portfolio, is_published: false }, canCreatePortfolio: false });
    expect(screen.getByText(/Creator access is paused/)).toHaveClass(
      "bg-[light-dark(#dcebe580,var(--app-dark-success-surface))]",
      "text-[light-dark(#315f57,var(--app-dark-accent))]",
    );
  });

  it("shows the private-beta boundary without creator controls for non-invited accounts", () => {
    renderDashboard({
      portfolio: null,
      canCreatePortfolio: false,
      shareUrl: null,
      media: [],
      viewCount: 0,
    });

    expect(screen.getByText("Private beta testing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Portfolio creation is currently invite-only." })).toBeInTheDocument();
    expect(screen.getByText(/continue using portfolio links shared with you/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start with the basics/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /portfolio details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /interests to review/i })).not.toBeInTheDocument();
  });

});
