// @vitest-environment jsdom

import React from "react";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Portfolio, PortfolioData, PortfolioMedia } from "../src/types/portfolio";
import { brokerIntroductionRouteRefSchema } from "../src/features/security/public-reference";
import type { RelationshipPage } from "../src/features/access/relationship-dashboard.contract";

let relationshipFixture: RelationshipPage;

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
  loadDashboardView: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost" }) }));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: async () => ({ supabase: {}, user: { id: "user-1", email: "owner@example.test" } }),
}));
vi.mock("@/features/portfolio/server/dashboard-view.service", () => ({
  loadDashboardView: mocks.loadDashboardView,
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
vi.mock("thinking-orbs", () => ({
  ThinkingOrb: () => <canvas aria-hidden="true" />,
}));

import DashboardClient from "../src/app/dashboard/dashboard-client";
import DashboardPage from "../src/app/dashboard/page";
import { CustomerAppFrame } from "@/components/navigation/CustomerAppFrame";
import { resolveServerTree } from "./resolve-server-tree";

const data: PortfolioData = {
  personal: { name: "Aditi Rao", dob: "1996-08-12", gender: "female", profile_for: "self" },
  vitals: {}, astrology: { rashi: "kanya" }, education: {}, career: {}, family: {}, lifestyle: {}, contact: {},
  style: { template_name: "Royal Heritage" },
};

const readyData: PortfolioData = {
  ...data,
  personal: {
    ...data.personal,
    first_name: "Aditi",
    last_name: "Rao",
    current_location: "Boston, Massachusetts, United States",
    country: "United States",
    country_code: "US",
    region: "Massachusetts",
    region_code: "US-MA",
    city: "Boston",
    postal_code: "02108",
    location_source: "manual",
    address_line_1: "1 Beacon Street",
    address_line_2: "Unit 2",
    place_of_birth: "Bengaluru",
    short_bio: "A thoughtful introduction.",
    marital_status: "Never Married",
  },
  career: { title: "Engineer" },
  vitals: { height: `5'5"`, gotra: "Kashyap" },
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
// Sharing-positive fixtures need a complete published snapshot and hero. Keep
// the default incomplete fixture for legacy lockout and draft editing tests.
const shareablePublished = {
  portfolio: { ...portfolio, published_data: readyData },
  media: [{ ...media, media_type: "hero" as const }],
};

function renderDashboard(overrides: Partial<React.ComponentProps<typeof DashboardClient>> = {}) {
  const published = (overrides.portfolio ?? portfolio)?.published_data;
  const items = overrides.interests ?? [];
  const grants = overrides.accessSummary?.grants ?? [];
  relationshipFixture = {
    records: [...items.map(item => ({ kind: "interest" as const, item })), ...grants.map(item => ({ kind: "grant" as const, item }))],
    total: items.length + grants.length,
    counts: { interests: items.length, awaiting: items.filter(item => ["new", "pending_review"].includes(item.status)).length, setAside: items.filter(item => item.status === "rejected").length, active: grants.filter(item => item.status === "active").length },
    disclosure: published ? { data: published, revision: "a".repeat(32), photoCount: 1, privatePhotoCount: 0, hasHoroscope: false } : null,
  };
  return render(<CustomerAppFrame currentPage="dashboard" userEmail="aditi@example.com" className="dashboard-shell flex flex-1 flex-col" loadingTitle="Getting your portfolio ready"><DashboardClient portfolio={portfolio} viewCount={12} userEmail="aditi@example.com"
    canCreatePortfolio
    relationshipOverview={relationshipFixture}
    shareUrl="https://nakshatra.test/p/token" isExpired daysLeft={0} media={[media]}
    mediaUrls={{ "media-1": "https://signed.test/one-thumb.webp" }} {...overrides} /></CustomerAppFrame>);
}

it("keeps server-rendered editor and WhatsApp controls disabled until hydration", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<DashboardClient {...shareablePublished}
    canCreatePortfolio viewCount={12} userEmail="owner@example.test"
    shareUrl="https://nakshatra.test/p/token" isExpired={false} daysLeft={20}
    publicationReadiness={readyPublicationReadiness} />);
  const controls = [...container.querySelectorAll("button")].filter(button =>
    /^(Edit details|Share on WhatsApp)$/.test(button.textContent?.trim() ?? ""));
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) expect(control).toBeDisabled();
});

it("keeps directly opened server-rendered editor fields disabled until hydration", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<DashboardClient {...shareablePublished}
    canCreatePortfolio viewCount={12} userEmail="owner@example.test"
    shareUrl="https://nakshatra.test/p/token" isExpired={false} daysLeft={20}
    initialEditorOpen publicationReadiness={{ ...readyPublicationReadiness, lastEditorSection: "foundation" }} />);
  const editor = container.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(within(editor).getByRole("textbox", { name: "First name" })).toBeDisabled();
  expect(within(editor).getByRole("combobox", { name: "Go to introduction section" })).toBeDisabled();
  expect(within(editor).getByRole("button", { name: "Save draft" })).toBeDisabled();
});

it("locks sharing of a legacy incomplete published snapshot even when the draft and publication flags are ready", () => {
  renderDashboard({ isExpired: false, daysLeft: 20, portfolio: { ...portfolio, draft_data: readyData },
    media: [{ ...media, media_type: "hero" }], publicationReadiness: readyPublicationReadiness });
  expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Share on WhatsApp" })).not.toBeInTheDocument();
  expect(screen.queryByText("https://nakshatra.test/p/token")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Update Profile to Resume Sharing" })).toBeInTheDocument();
});

it("keeps a complete published snapshot shareable while an incomplete draft is being revised", () => {
  renderDashboard({ isExpired: false, daysLeft: 20, portfolio: { ...portfolio, published_data: readyData },
    media: [{ ...media, media_type: "hero" }], publicationReadiness: { ...readyPublicationReadiness, previewedAt: null, disclosureConfirmed: false } });
  expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
});

it("does not serialize a share URL from the server page for an incomplete publication", async () => {
  mocks.loadDashboardView.mockResolvedValue({ ...shareablePublished,
    portfolio: { ...portfolio, draft_data: readyData },
    canCreatePortfolio: true, viewCount: 0, mediaUrls: {}, horoscope: null,
    interests: [], accessSummary: { grants: [], events: [] },
    publicationReadiness: readyPublicationReadiness,
  });
  const page = await DashboardPage({ searchParams: Promise.resolve({}) });
  const content = await page.props.children.type(page.props.children.props);
  expect(content.props.shareUrl).toBeNull();
});

function goToFoundation() {
  if (screen.queryByRole("heading", { name: "The essentials" })) return;
  fireEvent.click(screen.getByRole("button", { name: /Basics/ }));
}

async function acceptPublicationDisclosure() {
  await screen.findByRole("dialog", { name: /review and publish/i });
  await waitFor(() => expect(screen.getByRole("checkbox", { name: /I consent to publish/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("checkbox", { name: /I consent to publish/i }));
}

it("publishes a saved complete revision with fresh consent without mandatory preview visits", async () => {
  const readiness = { ...readyPublicationReadiness, published: false, previewedAt: null,
    reviewFingerprint: "a".repeat(64), publicPreviewReviewed: false,
    completePreviewReviewed: false, disclosureConfirmed: false };
  mocks.updateProgress.mockImplementation(async ({ action }) => ({ ok: true, data: {
    readiness: { ...readiness, disclosureConfirmed: action === "confirm_disclosure" },
  } }));
  renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
    media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
  fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
  const review = await screen.findByRole("dialog");
  const consent = within(review).getByRole("checkbox", { name: /I consent to publish/i });
  expect(consent).not.toBeChecked();
  const publish = within(review).getByRole("button", { name: "Save and publish" });
  expect(publish).toBeDisabled();
  expect(mocks.publish).not.toHaveBeenCalled();
  fireEvent.click(consent);
  expect(publish).toBeEnabled();
  fireEvent.click(publish);
  await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());
  expect(mocks.publish.mock.calls[0][0]).toMatchObject(readyData);
  expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "confirm_disclosure", value: "publication-disclosure-v2" });
  expect(mocks.updateProgress.mock.calls.map(([input]) => input.action)).not.toContain("public_preview");
  expect(mocks.updateProgress.mock.calls.map(([input]) => input.action)).not.toContain("complete_preview");
});

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.clearAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    if (String(input).startsWith("/api/dashboard/relationships")) {
      const params = new URL(String(input), "http://local").searchParams;
      const query = params.get("query")?.toLowerCase() || "";
      const offset = Number(params.get("offset") || 0);
      const records = [...relationshipFixture.records].reverse().filter(record => (record.kind === "interest" ? record.item.viewer_name : record.item.viewerName)?.toLowerCase().includes(query));
      return Response.json({ ...relationshipFixture, records: records.slice(offset, offset + 8), total: records.length });
    }
    return Response.json({ error: "Unexpected test request" }, { status: 500 });
  }));
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
  it("shows unavailable sharing status rather than fabricated zero counts", () => {
    renderDashboard({ relationshipsError: true, relationshipOverview: null });
    expect(screen.getByRole("alert")).toHaveTextContent("Existing access has not changed");
    expect(screen.getByRole("button", { name: "Retry sharing status" })).toBeEnabled();
    const stats = screen.getByLabelText("Introduction activity at a glance");
    expect(within(stats).getAllByText("—", { exact: true })).toHaveLength(3);
    expect(within(stats).getAllByText("Unavailable", { exact: true })).toHaveLength(2);
    expect(within(stats).queryByText("All caught up")).not.toBeInTheDocument();
  });
  it.each(["input", "option"])("dismisses expanded combobox suggestions from %s before Escape can dismiss the editor", (target) => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData },
      media: [{ ...media, media_type: "hero" }] });
    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /Personal story & lifestyle/ }));
    const languages = screen.getByRole("combobox", { name: "Languages" });
    fireEvent.focus(languages);
    expect(languages).toHaveAttribute("aria-expanded", "true");
    const focused = target === "option"
      ? within(screen.getByRole("listbox", { name: "Languages suggestions" })).getAllByRole("option")[0]
      : languages;
    focused.focus();
    fireEvent.keyDown(focused, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Introduction details" })).toBeInTheDocument();
    expect(languages).toHaveAttribute("aria-expanded", "false");
    expect(languages).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.keyDown(languages, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Introduction details" })).not.toBeInTheDocument();
  });
  it("closes the editor with Escape only after the existing unsaved-draft confirmation", () => {
    renderDashboard({ initialEditorOpen: true });
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    vi.mocked(confirm).mockReturnValueOnce(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Introduction details" })).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Introduction details" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("batches rapid typing and skips malformed intermediate answers without losing them", async () => {
    vi.useFakeTimers();
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData } });
    goToFoundation();
    const name = screen.getByLabelText("First name");
    for (const value of ["M", "Ma", "Mar", "Mary"]) {
      fireEvent.change(name, { target: { value } });
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    }
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(mocks.save).toHaveBeenCalledOnce();
    fireEvent.change(name, { target: { value: "Mary2" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(name).toHaveValue("Mary2");
    expect(mocks.save).toHaveBeenCalledOnce();
    fireEvent.change(name, { target: { value: "Mary Jane" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1][0].personal.first_name).toBe("Mary Jane");
  });

  it("serializes slow saves and autosaves newer edits after the first request settles", async () => {
    vi.useFakeTimers();
    let resolveSave!: (result: unknown) => void;
    mocks.save.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData } });
    goToFoundation();
    const name = screen.getByLabelText("First name");
    fireEvent.change(name, { target: { value: "Mary" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.save).toHaveBeenCalledOnce();
    fireEvent.change(name, { target: { value: "Mary Jane" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(mocks.save).toHaveBeenCalledOnce();
    for (const button of screen.getAllByRole("button", { name: /Saving/ })) expect(button).toBeDisabled();
    await act(async () => resolveSave({ ok: true, data: { portfolioId: "portfolio-1", draftData: {
      ...readyData, personal: { ...readyData.personal, first_name: "Mary" },
    } } }));
    expect(name).toHaveValue("Mary Jane");
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[1][0].personal.first_name).toBe("Mary Jane");
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("coalesces section changes and serializes the latest pending resume position", async () => {
    vi.useFakeTimers();
    let resolveProgress!: (result: unknown) => void;
    mocks.updateProgress.mockImplementationOnce(() => new Promise(resolve => { resolveProgress = resolve; }));
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData },
      publicationReadiness: readyPublicationReadiness, media: [{ ...media, media_type: "hero" }] });
    const section = screen.getByLabelText("Go to introduction section");
    fireEvent.change(section, { target: { value: "foundation" } });
    fireEvent.change(section, { target: { value: "story" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(mocks.updateProgress).toHaveBeenCalledExactlyOnceWith({ action: "editor_section", value: "story" });
    fireEvent.change(section, { target: { value: "work" } });
    fireEvent.change(section, { target: { value: "family" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.updateProgress).toHaveBeenCalledOnce();
    await act(async () => resolveProgress({ ok: true, data: { readiness: { ...readyPublicationReadiness, lastEditorSection: "story" } } }));
    expect(section).toHaveValue("family");
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(mocks.updateProgress).toHaveBeenCalledTimes(2);
    expect(mocks.updateProgress.mock.calls[1][0]).toEqual({ action: "editor_section", value: "family" });
    expect(section).toHaveValue("family");
  });

  it("does not loop resume-position writes after a transport exception", async () => {
    vi.useFakeTimers();
    mocks.updateProgress.mockRejectedValueOnce(new Error("Offline"));
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData },
      publicationReadiness: readyPublicationReadiness, media: [{ ...media, media_type: "hero" }] });
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "story" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(mocks.updateProgress).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Go to introduction section")).toHaveValue("story");
  });

  it("does not write an unchanged saved draft", async () => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("keeps only section navigation primary in the footer and draft tools separate", () => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData },
      publicationReadiness: { ...readyPublicationReadiness, lastEditorSection: "foundation" },
      media: [{ ...media, media_type: "hero" }] });
    const footer = document.querySelector<HTMLElement>(".dashboard-editor-footer")!;
    expect(within(footer).getByRole("button", { name: "Back" })).toBeDisabled();
    expect(within(footer).getByRole("button", { name: /Continue: Personal story/ })).toBeEnabled();
    expect(within(footer).queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Draft tools" })).getByRole("button", { name: "Save draft" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    expect(within(footer).getByRole("button", { name: "Review saved changes" })).toBeEnabled();
    expect(within(footer).queryByRole("button", { name: /^Continue:/ })).not.toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("does not write progress when the current section is selected repeatedly", async () => {
    vi.useFakeTimers();
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData },
      publicationReadiness: readyPublicationReadiness, media: [{ ...media, media_type: "hero" }] });
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mocks.updateProgress).not.toHaveBeenCalled();
  });
  it.each([true, false])("focuses a visible photo correction instead of hidden upload or deletion (existing photo: %s)", async (existingPhoto) => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData }, media: existingPhoto ? [media] : [] });
    goToFoundation();
    fireEvent.click(screen.getByRole("button", { name: /Continue: Personal story/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: existingPhoto ? "Make primary photo" : "Add photos" })).toHaveFocus());
    expect(screen.getByRole("button", { name: existingPhoto ? "Make primary photo" : "Add photos" })).toHaveAccessibleDescription(/Choose a primary photo/);
    expect(screen.getByRole("alert", { name: "Check these answers" })).toHaveTextContent("Shareable primary photo");
  });

  it("links an invalid optional contact phone to the visible split phone controls", async () => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio,
      draft_data: { ...readyData, contact: { contacts: [{ relationship: "self", phone: "123" }] } } },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readyPublicationReadiness });
    fireEvent.click(screen.getByRole("button", { name: "Review saved changes" }));
    await waitFor(() => expect(screen.getByLabelText("Country calling code")).toHaveFocus());
    expect(screen.getByLabelText("Phone number")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Phone number")).toHaveAccessibleDescription(/Enter a valid phone number/);
    expect(screen.getByRole("heading", { name: /Appearance and contact/ })).toBeInTheDocument();
  });

  it("routes all missing location errors to one working composite correction", async () => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: { ...readyData,
      personal: { ...readyData.personal, country: "", country_code: undefined, region: "", region_code: "", city: "", postal_code: "", current_location: "", location_source: undefined } } },
      media: [{ ...media, media_type: "hero" }] });
    goToFoundation();
    fireEvent.click(screen.getByRole("button", { name: /Continue: Personal story/ }));
    await waitFor(() => expect(screen.getByLabelText("Search country")).toHaveFocus());
    expect(screen.getByLabelText("Search country")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Search country")).toHaveAccessibleDescription(/Choose a country, state and city/);
    const summary = screen.getByRole("alert", { name: "Check these answers" });
    expect(within(summary).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Enter location manually" }));
    expect(screen.getByLabelText("Current state")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Current state")).toHaveAccessibleDescription(/Choose a country, state and city/);
  });

  it("routes API location errors to Change even when the current location is confirmed", async () => {
    mocks.save.mockResolvedValueOnce({ ok: false, error: { code: "INVALID_INPUT", status: 400,
      message: "Check your location.", fieldErrors: { "personal.city": ["Choose a valid city."], "personal.region_code": ["Choose a valid state."] } } });
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData }, media: [{ ...media, media_type: "hero" }] });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Change" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Change" })).toHaveAccessibleDescription("Choose a valid city.");
    expect(within(screen.getByRole("alert", { name: "Check these answers" })).getAllByRole("button")).toHaveLength(1);
  });

  it("clears actionable errors after correction and allows empty optional Family and Astrology", async () => {
    renderDashboard({ initialEditorOpen: true,
      portfolio: { ...portfolio, draft_data: { ...readyData, family: undefined, astrology: undefined,
        personal: { ...readyData.personal, first_name: "", name: "" } } },
      media: [{ ...media, media_type: "hero" }] });
    goToFoundation();
    fireEvent.click(screen.getByRole("button", { name: /Continue: Personal story/ }));
    expect(screen.getByLabelText("First name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("First name")).toHaveAccessibleDescription("This field is required.");
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mary Jane" } });
    expect(screen.getByLabelText("First name")).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: /Continue: Personal story/ }));
    expect(screen.getByRole("heading", { name: "Personal story" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "family" } });
    expect(screen.getByRole("heading", { name: "Family and background" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue: Astrology/ }));
    expect(screen.getByRole("heading", { name: "Astrology and horoscope" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue: Match & future/ }));
    expect(screen.getByRole("heading", { name: "Partner preferences" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Astrology and horoscope" })).toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("blocks forward section navigation and focuses the first missing required answer without blocking private saves", async () => {
    renderDashboard({ initialEditorOpen: true });
    goToFoundation();
    fireEvent.click(screen.getByRole("button", { name: /Continue: Personal story & lifestyle/ }));
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(screen.getByRole("alert", { name: "Check these answers" })).toHaveTextContent("Marital Status");
    await waitFor(() => expect(screen.getByLabelText("Marital Status")).toHaveFocus());
    expect(screen.getByLabelText("Marital Status")).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /Education & work/ }));
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next section" }));
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review saved changes" }));
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.updateProgress.mock.calls.some(([value]) => value.action === "confirm_disclosure")).toBe(false);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  });

  it("retains API field guidance and the typed answer when a private save is rejected", async () => {
    mocks.save.mockResolvedValueOnce({ ok: false, error: { code: "INVALID_INPUT", message: "Check the highlighted answers.", status: 400,
      fieldErrors: { "career.title": ["Use a shorter profession title."] } } });
    renderDashboard({ initialEditorOpen: true });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("Current profession title"), { target: { value: "Typed profession" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByLabelText("Current profession title")).toHaveFocus());
    expect(screen.getByLabelText("Current profession title")).toHaveValue("Typed profession");
    expect(screen.getByLabelText("Current profession title")).toHaveAccessibleDescription(/Use a shorter profession title/);
    expect(screen.getByRole("alert", { name: "Check these answers" })).toHaveTextContent("Current profession title");
  });
  it("separates the live Introduction from incomplete saved draft readiness", () => {
    renderDashboard({ ...shareablePublished, isExpired: false, publicationReadiness: readyPublicationReadiness });
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("heading", { level: 1, name: "Your Introduction is ready to share." })).toBeInTheDocument();
    expect(screen.getByText("Saved draft readiness")).toBeInTheDocument();
    expect(screen.getByText(/Your published Introduction stays live/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share on WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download.*(?:pdf|json)/i })).not.toBeInTheDocument();
  });

  it("exposes keyboard focus and a generous delete target for owner photos", () => {
    renderDashboard();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit details" })[0]);
    const privacy = screen.getByRole("combobox", { name: "Photo visibility" });
    expect(privacy.className).toContain("focus-visible:ring-2");
    expect(screen.getByRole("button", { name: "Delete photo" }).className).toContain("h-12 w-12");
  });

  it("renders request dates consistently across server and viewer timezones", () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;
    const format = vi.spyOn(Intl, "DateTimeFormat");
    for (const timeZone of ["UTC", "America/Los_Angeles"]) {
      format.mockImplementation(function (locales, options) {
        return new RealDateTimeFormat(locales, { timeZone, ...options });
      });
      const view = renderDashboard({ interests: [{
        id: "interest-zone", viewer_name: "Rohan", viewer_email: "viewer@example.test",
        viewer_phone: null, viewer_family_context: null, message: null, status: "new",
        requester_user_id: null, metadata: null, created_at: "2026-09-20T00:30:00Z",
        email_verified: true, source_type: "direct", broker_name: null,
        broker_representative_name: null, requester_portfolio_token: null,
      }] });
      expect(screen.getByText("Sep 20 · Verified email")).toBeInTheDocument();
      view.unmount();
    }
  });
  it("shows preview progress during the initial request and clears it after rejection", async () => {
    let reject!: (error: Error) => void;
    mocks.updateProgress.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData }, publicationReadiness: readyPublicationReadiness });
    fireEvent.click(screen.getByRole("link", { name: /preview public introduction/i }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "previewed" }));
    expect(screen.getByText("Saving preview progress")).toBeInTheDocument();
    await act(async () => reject(new Error("offline")));
    expect(screen.queryByText("Saving preview progress")).not.toBeInTheDocument();
    expect(screen.getByText(/Your preview progress could not be saved/)).toBeInTheDocument();
  });

  it.each([
    [null, undefined, "Preview"],
    [null, undefined, "Review and publish"],
    ["a".repeat(64), undefined, "Preview"],
    ["a".repeat(64), undefined, "Review and publish"],
    ["a".repeat(64), "b".repeat(64), "Preview"],
    ["a".repeat(64), "b".repeat(64), "Review and publish"],
  ] as const)("retains versioned review requirements after a save with older API responses (%s/%s/%s)", async (initialHash, savedHash, entry) => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: initialHash, publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", readiness: { ...readyPublicationReadiness, published: false, reviewFingerprint: savedHash } } });
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readyPublicationReadiness, published: false } } });
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData, is_published: false }, media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: entry }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.updateProgress.mock.calls.filter(([request]) => ["public_preview", "complete_preview", "confirm_disclosure"].includes(request.action))).toHaveLength(0);
  });
  it("keeps newer local edits private when answers change while a review save is in flight", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    let finishSave!: (value: unknown) => void;
    mocks.save.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Saving" } });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Latest" } });
    await act(async () => { finishSave({ ok: true, data: { portfolioId: "portfolio-1", readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } }); });
    expect(screen.getByLabelText("First name")).toHaveValue("Latest");
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
    expect(mocks.updateProgress.mock.calls.filter(([request]) => request.action !== "editor_section")).toHaveLength(0);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("reloads if another tab changes the draft between an intentional save and review loading", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } });
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readiness, reviewFingerprint: "c".repeat(64) } } });
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("remembers an unchanged editor's public preview without saving its answers again", async () => {
    const readiness = { ...readyPublicationReadiness, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.updateProgress.mockImplementation(async ({ action }) => ({ ok: true, data: { readiness: {
      ...readiness, publicPreviewReviewed: action === "public_preview",
    } } }));
    renderDashboard({ initialEditorOpen: true, publicationReadiness: readiness,
      portfolio: { ...portfolio, draft_data: readyData }, media: [{ ...media, media_type: "hero" }] });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "public_preview", value: "a".repeat(64) }));
    expect(window.open).toHaveBeenCalledWith("/preview", "_blank", "noopener,noreferrer");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("does not save or open an unchanged editor preview over another tab's newer answers", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } });
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalled());
    expect(mocks.save).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(window.open).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("does not adopt another tab's new review hash while keeping old local answers", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    fireEvent.click(screen.getByRole("link", { name: /preview public introduction/i }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.updateProgress).toHaveBeenCalledTimes(1);
    expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "previewed" });
    expect(await screen.findByText(/could not confirm your latest saved introduction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("reviews an unchanged editor without overwriting newer saved answers from another tab", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
  });
  it("reloads changed saved answers rather than reopening an obsolete review or saving stale data", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    const props = { portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" as const }], publicationReadiness: readiness };
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness } });
    const { unmount } = renderDashboard(props);
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await screen.findByRole("dialog", { name: /review and publish/i });
    mocks.updateProgress.mockResolvedValueOnce({ ok: false, error: { code: "PORTFOLIO_REVIEW_CHANGED", message: "Your saved introduction changed.", status: 409 } });
    fireEvent.click(screen.getByRole("link", { name: /^review public introduction$/i }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    // Server refresh remounts the dashboard with its authoritative draft and revision key.
    unmount();
    const latest = { ...readiness, reviewFingerprint: "b".repeat(64) };
    mocks.updateProgress.mockImplementation(async ({ action }) => ({ ok: true, data: { readiness: { ...latest, publicPreviewReviewed: action === "public_preview" } } }));
    renderDashboard({ ...props, portfolio: { ...props.portfolio, draft_data: { ...readyData, personal: { ...readyData.personal, short_bio: "Latest saved introduction" } } }, publicationReadiness: latest });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await screen.findByRole("dialog", { name: /review and publish/i });
    fireEvent.click(screen.getByRole("link", { name: /^review public introduction$/i }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenLastCalledWith({ action: "public_preview", value: "b".repeat(64) }));
  });

  it("refreshes media-only changes and records both durable view markers after returning to the dashboard", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: true, completePreviewReviewed: true };
    const mounted = renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    mocks.update.mockImplementation(async (_id, changes) => ({ ok: true, data: { media: { ...media, media_type: "hero", ...changes } } }));
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("Photo visibility"), { target: { value: "interest_required" } });
    await waitFor(() => expect(screen.getByLabelText("Photo visibility")).toHaveValue("interest_required"));
    fireEvent.click(screen.getByRole("button", { name: /Back to dashboard/ }));
    let publicOpened = false;
    let completeOpened = false;
    mocks.updateProgress.mockImplementation(async ({ action }) => {
      publicOpened ||= action === "public_preview";
      completeOpened ||= action === "complete_preview";
      return { ok: true, data: { readiness: { ...readiness, reviewFingerprint: "b".repeat(64),
        publicPreviewReviewed: publicOpened, completePreviewReviewed: completeOpened } } };
    });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The refreshed server page remounts the workspace with authoritative answers/media.
    mounted.unmount();
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero", visibility: "interest_required" }],
      publicationReadiness: { ...readiness, reviewFingerprint: "b".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false } });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await acceptPublicationDisclosure();
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: /^review public introduction$/i }));
    fireEvent.click(screen.getByRole("link", { name: /^review private details$/i }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "complete_preview", value: "b".repeat(64) }));
    expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "public_preview", value: "b".repeat(64) });
    expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "complete_preview", value: "b".repeat(64) });
    expect(mocks.updateProgress.mock.calls.filter(([action]) => action.action === "previewed")).toHaveLength(2);
  });

  it("reloads authoritative answers after a photo edit instead of recording previews for another tab's answers", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: true, completePreviewReviewed: true };
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    mocks.update.mockImplementation(async (_id, changes) => ({ ok: true, data: { media: { ...media, media_type: "hero", ...changes } } }));
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("Photo visibility"), { target: { value: "interest_required" } });
    await waitFor(() => expect(screen.getByLabelText("Photo visibility")).toHaveValue("interest_required"));
    fireEvent.click(screen.getByRole("button", { name: /Back to dashboard/ }));
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readiness,
      reviewFingerprint: "b".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false } } });
    fireEvent.click(screen.getByRole("link", { name: /^preview public introduction/i }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.updateProgress).not.toHaveBeenCalledWith({ action: "public_preview", value: "b".repeat(64) });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Loading the latest details/);
  });

  it("counts the dashboard overview previews so the final dialog does not ask for them again", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: false, completePreviewReviewed: false };
    let publicOpened = false;
    let completeOpened = false;
    mocks.updateProgress.mockImplementation(async ({ action }) => {
      publicOpened ||= action === "public_preview";
      completeOpened ||= action === "complete_preview";
      return { ok: true, data: { readiness: { ...readiness, publicPreviewReviewed: publicOpened, completePreviewReviewed: completeOpened } } };
    });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    fireEvent.click(screen.getByRole("link", { name: /preview public introduction/i }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "public_preview", value: "a".repeat(64) }));
    fireEvent.click(screen.getByRole("link", { name: /preview private details/i }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({ action: "complete_preview", value: "a".repeat(64) }));
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(await screen.findByRole("checkbox", { name: /I consent to publish/i })).not.toBeChecked();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Save and publish" })).toBeDisabled();
  });
  it("makes editing and direct liveness navigation available before either preview", async () => {
    renderDashboard({ portfolio: { ...portfolio, candidate_id: "candidate-1", draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" }], publicationReadiness: { ...readyPublicationReadiness, verificationStatus: "required", published: false } });
    expect(screen.getByRole("button", { name: "Edit details" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Go to liveness check" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Liveness check" })).toHaveFocus());
    expect(mocks.updateProgress).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("remembers reviews for the same saved version across closing and a fresh dashboard mount", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64),
      publicPreviewReviewed: true, completePreviewReviewed: true, disclosureConfirmed: false };
    const props = { portfolio: { ...portfolio, draft_data: readyData, is_published: false },
      media: [{ ...media, media_type: "hero" as const }], publicationReadiness: readiness };
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness } });
    const { unmount } = renderDashboard(props);
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(await screen.findByRole("checkbox", { name: /I consent to publish/i })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(await screen.findByRole("checkbox", { name: /I consent to publish/i })).not.toBeChecked();
    unmount();
    renderDashboard(props);
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(await screen.findByRole("checkbox", { name: /I consent to publish/i })).not.toBeChecked();
    expect(mocks.updateProgress).toHaveBeenCalledTimes(3);
    expect(mocks.updateProgress).toHaveBeenLastCalledWith({ action: "previewed" });
  });

  it("retains optional preview evidence but requires only fresh consent after an answer changes", async () => {
    const readiness = { ...readyPublicationReadiness, published: false, reviewFingerprint: "a".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false };
    let publicOpened = false;
    let completeOpened = false;
    mocks.updateProgress.mockImplementation(async ({ action }) => {
      publicOpened ||= action === "public_preview";
      completeOpened ||= action === "complete_preview";
      return { ok: true, data: { readiness: { ...readiness, publicPreviewReviewed: publicOpened, completePreviewReviewed: completeOpened } } };
    });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData, is_published: false }, media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("link", { name: /^review public introduction$/i }));
    fireEvent.click(screen.getByRole("link", { name: /^review private details$/i }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledTimes(3));
    await acceptPublicationDisclosure();
    expect(mocks.updateProgress).toHaveBeenNthCalledWith(2, { action: "public_preview", value: "a".repeat(64) });
    expect(mocks.updateProgress).toHaveBeenNthCalledWith(3, { action: "complete_preview", value: "a".repeat(64) });
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "My revised introduction." } });
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } });
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: { ...readiness, reviewFingerprint: "b".repeat(64) } } });
    fireEvent.click(screen.getByRole("button", { name: /review and publish/i }));
    await screen.findByRole("dialog", { name: /review and publish/i });
    expect(screen.getByRole("checkbox", { name: /I consent to publish/i })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save and publish" })).toBeDisabled();
  });
  it("refreshes server readiness only when the liveness proof disagrees, leaving transient handoffs uninterrupted", async () => {
    const attempt = { attemptId: "attempt", deadline: null, cleanupPending: false, canStart: true, canResume: false, canCancel: false };
    let recovery = { ...attempt, state: "not_started" };
    const statusFetch = vi.fn(async () => new Response(JSON.stringify(recovery), { status: 200 }));
    vi.stubGlobal("fetch", statusFetch);
    sessionStorage.clear();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function () { this.removeAttribute("open"); } });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    renderDashboard({ portfolio: { ...portfolio, candidate_id: "candidate-1", is_published: false },
      publicationReadiness: { ...readyPublicationReadiness, verificationStatus: "required" } });
    await screen.findByRole("button", { name: "Start liveness check" });
    await waitFor(() => expect(statusFetch).toHaveBeenCalled());
    expect(mocks.refresh).not.toHaveBeenCalled();
    recovery = { ...attempt, state: "active", canStart: false, canResume: true, canCancel: true };
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("button", { name: "Resume check" });
    expect(mocks.refresh).not.toHaveBeenCalled();
    recovery = { ...attempt, state: "verified", canStart: false };
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("dialog", { name: "Liveness check complete" });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("refreshes stale verified server readiness when the authoritative check has expired", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ state: "expired", attemptId: "attempt",
      deadline: null, cleanupPending: false, canStart: true, canResume: false, canCancel: false }), { status: 200 })));
    renderDashboard({ portfolio: { ...portfolio, candidate_id: "candidate-1", is_published: false },
      publicationReadiness: { ...readyPublicationReadiness, verificationStatus: "verified" } });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("uses refreshed server verification without resetting an unsaved editor draft", () => {
    const props = { ...shareablePublished, viewCount: 12, userEmail: "aditi@example.com", canCreatePortfolio: true,
      shareUrl: "https://nakshatra.test/p/token", isExpired: false, daysLeft: 20,
      mediaUrls: { "media-1": "https://signed.test/one-thumb.webp" } };
    const { rerender } = render(<DashboardClient {...props} publicationReadiness={{ ...readyPublicationReadiness, verificationStatus: "required" }} />);
    expect(screen.queryByRole("button", { name: "Share on WhatsApp" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Unsaved" } });
    rerender(<DashboardClient {...props} publicationReadiness={readyPublicationReadiness} />);
    expect(screen.getByLabelText("First name")).toHaveValue("Unsaved");
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(screen.getByRole("button", { name: "Share on WhatsApp" })).toBeInTheDocument();
  });
  it("starts a new creator with one clear action instead of empty activity metrics", () => {
    renderDashboard({ portfolio: null, shareUrl: null, viewCount: 0, media: [] });
    expect(screen.getByRole("button", { name: "Start with the basics" })).toBeInTheDocument();
    expect(document.querySelector(".dashboard-stats-grid")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /0% complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Introductions and access" })).not.toBeInTheDocument();
  });

  it("shows onboarding insights only to database-authorized administrators", () => {
    const { rerender } = renderDashboard({ pilotAccessState: { canCreatePortfolio: true, isPilotAdministrator: true, application: null } });
    expect(screen.getByRole("link", { name: "View feedback" })).toHaveAttribute("href", "/admin/onboarding-feedback");
    rerender(<DashboardClient portfolio={portfolio} viewCount={12} userEmail="aditi@example.com" canCreatePortfolio shareUrl="https://nakshatra.test/p/token" isExpired daysLeft={0} media={[media]} mediaUrls={{ "media-1": "https://signed.test/one-thumb.webp" }} pilotAccessState={{ canCreatePortfolio: true, isPilotAdministrator: false, application: null }} />);
    expect(screen.queryByRole("link", { name: "View feedback" })).not.toBeInTheDocument();
  });

  it("shows identity-verification actions only after a saved candidate is linked", () => {
    renderDashboard({ portfolio: { ...portfolio, candidate_id: "candidate-1" } });
    expect(screen.getByRole("heading", { name: "Liveness check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start liveness check" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create candidate invitation" })).not.toBeInTheDocument();
  });

  it("does not expose sharing controls or a URL when verification is missing", () => {
    renderDashboard({ isExpired: false, daysLeft: 20 });
    expect(screen.getByRole("button", { name: "Edit details" })).toHaveClass("dashboard-edit-action");
    expect(screen.queryByRole("button", { name: "Share on WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rotate link/i })).not.toBeInTheDocument();
    expect(document.querySelector(".dashboard-share-url")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.queryByText("Sharing paused")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Introduction overview")).toContainElement(screen.getByLabelText("Introduction activity at a glance"));
  });

  it("shows public-link controls for the test account without calling it identity verified", () => {
    renderDashboard({
      ...shareablePublished,
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      publicationReadiness: { ...readyPublicationReadiness, verificationStatus: "test_exempt" },
      isExpired: false,
    });
    expect(screen.getByRole("button", { name: "Share on WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByText(/not Didit identity verification/i)).toBeInTheDocument();
    expect(screen.queryByText("Sharing paused")).not.toBeInTheDocument();
  });

  it("keeps the ready-to-share heading without redundant supporting copy", () => {
    renderDashboard({
      ...shareablePublished,
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      publicationReadiness: readyPublicationReadiness,
      isExpired: false,
    });
    expect(screen.getByRole("heading", { name: "Your Introduction is ready to share." })).toBeInTheDocument();
    expect(screen.queryByText("Share your public Introduction, review new interests, or update your portfolio.")).not.toBeInTheDocument();
  });

  it("opens the canonical editor when requested by an editing route", () => {
    renderDashboard({ initialEditorOpen: true });
    expect(screen.getByRole("heading", { name: "Introduction details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Current form section" })).toHaveAttribute("aria-valuetext", "Section 1 of 7");
    goToFoundation();
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(screen.queryByText("Rashi palette")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Music")).not.toBeInTheDocument();
  });

  it("opens and saves a new incomplete private draft but keeps final review blocked", async () => {
    const savedReadiness = { ...readyPublicationReadiness, published: false, disclosureConfirmed: false,
      reviewFingerprint: "a".repeat(64), publicPreviewReviewed: false, completePreviewReviewed: false };
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", readiness: savedReadiness } });
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: savedReadiness } });
    renderDashboard({ portfolio: null, shareUrl: null, media: [] });
    expect(screen.queryByText("Public sharing is off")).not.toBeInTheDocument();
    expect(screen.getByText(/one clear introduction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start with the basics/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "New" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Name" } });
    fireEvent.change(
      screen.getByLabelText("Short description"),
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
    fireEvent.change(screen.getByLabelText("Marital Status"), {
      target: { value: "Never Married" },
    });
    goToFoundation();
    expect(screen.queryByText("Portfolio template")).not.toBeInTheDocument();
    const palette = screen.queryAllByRole("button").find((button) => button.textContent?.includes("#"));
    if (palette) fireEvent.click(palette);
    fireEvent.click(screen.getByRole("button", { name: /add photos/i }));
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    fireEvent.click(screen.getByRole("button", { name: /start with the basics/i }));
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /review and publish/i }));
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
    expect(screen.getByRole("alert", { name: "Check these answers" })).toHaveTextContent("Country, state, city, and ZIP/PIN");
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox", { name: /I consent to publish/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(mocks.publish).not.toHaveBeenCalled();
  }, 10_000);

  it("operates published-link controls and signs out", async () => {
    renderDashboard({ ...shareablePublished, isExpired: false, daysLeft: 20, publicationReadiness: readyPublicationReadiness });
    const metrics = document.querySelector(".dashboard-stats-grid") as HTMLElement;
    expect(metrics.children).toHaveLength(4);
    expect(within(metrics).getByText("Interests received")).toBeInTheDocument();
    expect(within(metrics).getByText("Needs review")).toBeInTheDocument();
    expect(within(metrics).getByText("Currently sharing with")).toBeInTheDocument();
    expect(within(metrics).getByText("Introduction views")).toBeInTheDocument();
    expect(within(metrics).getByText("All recorded opens")).toBeInTheDocument();
    expect(within(metrics).queryByText("Public link")).not.toBeInTheDocument();
    const shareLink = document.querySelector(".dashboard-share-url") as HTMLElement;
    expect(shareLink).toHaveTextContent("https://nakshatra.test/p/token");
    expect(shareLink.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: /preview private details/i })).toHaveAttribute("href", "/approved-preview");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /share on whatsapp/i }));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining("wa.me"), "_blank", "noopener,noreferrer");
    const whatsappUrl = String(vi.mocked(window.open).mock.calls[0][0]);
    expect(new URL(whatsappUrl).searchParams.get("text")).toMatch(/^Here’s my marriage introduction 🙏\n\n/);
    expect(new URL(whatsappUrl).searchParams.get("text")).toContain("If you’d like to know more, tap “Show interest” on the page.");
    expect(new URL(whatsappUrl).searchParams.get("text")).not.toMatch(/latest|up to date|always/i);
    fireEvent.click(screen.getByText("Manage link", { exact: true }));
    fireEvent.click(screen.getByRole("button", { name: /rotate link/i }));
    await waitFor(() => expect(mocks.rotate).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /unpublish/i }));
    await waitFor(() => expect(mocks.unpublish).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole("button", { name: /sign out/i })[0]);
    await waitFor(() => expect(mocks.clearLocalSession).toHaveBeenCalled());
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("uses lifecycle-aware primary actions without treating link status as an insight", async () => {
    const { rerender } = renderDashboard({ ...shareablePublished, isExpired: false, daysLeft: 6, publicationReadiness: readyPublicationReadiness });
    expect(screen.getByRole("button", { name: "Share on WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByText("Public link")).not.toBeInTheDocument();

    rerender(
      <DashboardClient
        portfolio={shareablePublished.portfolio}
        viewCount={12}
        userEmail="aditi@example.com"
        canCreatePortfolio
        shareUrl="https://nakshatra.test/p/token"
        isExpired
        daysLeft={0}
        media={shareablePublished.media}
        mediaUrls={{ "media-1": "https://signed.test/one-thumb.webp" }}
        publicationReadiness={readyPublicationReadiness}
      />
    );

    expect(screen.queryByText("Public link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Introduction link has expired." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share on WhatsApp" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reactivate public link" }));
    await waitFor(() => expect(mocks.renew).toHaveBeenCalled());
  });

  it("groups the active URL and routine actions without a redundant active badge", () => {
    renderDashboard({ ...shareablePublished, isExpired: false, publicationReadiness: readyPublicationReadiness });
    const sharing = screen.getByRole("region", { name: "Introduction link" });
    expect(sharing).toHaveTextContent("https://nakshatra.test/p/token");
    for (const name of ["Edit details", "Copy link", "Share on WhatsApp"]) {
      expect(within(sharing).getByRole("button", { name })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name })).toHaveLength(1);
    }
    expect(screen.queryByText("Introduction link active")).not.toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Introduction details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit details" }).compareDocumentPosition(screen.getByRole("button", { name: "Review and publish" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review and publish" }));
    expect(await screen.findByRole("dialog", { name: /review and publish/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to editing" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Back to dashboard" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to editing" }));
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Introduction details" })).toBeInTheDocument();
  });

  it("resumes a saved draft at its next required section and keeps mobile navigation outside the scrolling form", () => {
    renderDashboard({ portfolio: { ...portfolio, is_published: false, published_data: null } });
    expect(screen.getByRole("button", { name: "Edit details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    const mobileNavigation = screen.getByRole("progressbar", { name: "Current form section" }).closest(".dashboard-editor-mobile-step");
    expect(mobileNavigation).toBeInTheDocument();
    expect(mobileNavigation?.nextElementSibling).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    const formScroller = mobileNavigation?.nextElementSibling as HTMLElement;
    formScroller.scrollTop = 400;
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    expect(screen.getByRole("alert", { name: "Check these answers" })).toBeInTheDocument();
  });

  it("makes liveness available in the same visit as a first draft save", async () => {
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", candidateId: "candidate-1" } });
    renderDashboard({ portfolio: null, media: [], shareUrl: null });
    fireEvent.click(screen.getByRole("button", { name: /start with the basics/i }));
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(await screen.findByRole("heading", { name: "Liveness check" })).toBeInTheDocument();
  });

  it("guides a complete draft to liveness without showing publication consent early", async () => {
    const unverified = { ...readyPublicationReadiness, verificationStatus: "required" as const, published: false };
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness: unverified } });
    renderDashboard({
      portfolio: { ...portfolio, candidate_id: "candidate-1", draft_data: readyData, published_data: null, is_published: false },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: unverified,
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    fireEvent.click(screen.getByRole("button", { name: /review and publish/i }));
    const review = await screen.findByRole("dialog", { name: /review and publish/i });
    expect(within(review).queryByRole("checkbox", { name: /I consent to publish/i })).not.toBeInTheDocument();
    expect(within(review).queryByRole("button", { name: "Save and publish" })).not.toBeInTheDocument();
    fireEvent.click(await within(review).findByRole("button", { name: "Go to liveness check" }));
    expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Liveness check" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Liveness check" })).toHaveFocus());
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("lets an owner approve a signed-in interest from the dashboard", async () => {
    const decisionFetch = vi.fn(async (input: string) => String(input).startsWith("/api/dashboard/relationships")
      ? Response.json({ ...relationshipFixture, records: [] }) : Response.json({ ok: true, status: "approved" }));
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
      // A saved but unpublished edit must not change the information described
      // to the owner when granting the existing published private snapshot.
      portfolio: { ...portfolio, draft_data: { ...disclosureData, family: undefined, contact: undefined }, published_data: disclosureData },
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

    const metrics = document.querySelector(".dashboard-stats-grid") as HTMLElement;
    expect(within(metrics).getByText("Interests received").closest(".dashboard-stat-card")).toHaveTextContent("1");
    expect(within(metrics).getByText("Needs review").closest(".dashboard-stat-card")).toHaveTextContent("1");
    expect(within(metrics).getByRole("link", { name: "Review interests" })).toHaveAttribute("href", "#introductions-and-access");

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText(/Toronto, Ontario, Canada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share details" }));

    const approval = screen.getByRole("dialog", { name: /Share details with Rohan Mehta/i });
    expect(within(approval).getByText(/Details are shared for 15 days/i)).toBeInTheDocument();
    expect(await within(approval).findByText(/Personal profile, location, and story details/i)).toBeInTheDocument();
    expect(within(approval).getByText("Exact date of birth")).toBeInTheDocument();
    expect(within(approval).getByText(/Education, employer, career/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Family members, origins/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Lifestyle, languages/i)).toBeInTheDocument();
    expect(within(approval).getByText(/Partner preferences/i)).toBeInTheDocument();
    expect(within(approval).getByText("Private contact details")).toBeInTheDocument();
    expect(decisionFetch.mock.calls.some(([url]) => String(url).startsWith("/api/interest/"))).toBe(false);
    fireEvent.click(within(approval).getByRole("button", { name: "Share details for 15 days" }));

    await waitFor(() => expect(decisionFetch).toHaveBeenCalledWith(
      "/api/interest/interest-1",
      expect.objectContaining({ method: "PATCH" })
    ));
    expect(await screen.findByText("0 waiting")).toBeInTheDocument();
  });

  it("lets the owner renew and revoke private details access", async () => {
    renderDashboard({
      ...shareablePublished,
      isExpired: false,
      publicationReadiness: readyPublicationReadiness,
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

    const metrics = document.querySelector(".dashboard-stats-grid") as HTMLElement;
    expect(within(metrics).getByText("Currently sharing with").closest(".dashboard-stat-card")).toHaveTextContent("1");
    expect(within(metrics).getByRole("link", { name: "Manage access" })).toHaveAttribute("href", "#introductions-and-access");

    expect(screen.getByText("Active until Jan 1, 2099")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: "Share for another 15 days" }));
    await waitFor(() => expect(mocks.manageAccess).toHaveBeenCalledWith(accessGrantId, "renew"));
    expect(await screen.findByText("Active until Feb 1, 2099")).toBeInTheDocument();

    mocks.manageAccess.mockResolvedValueOnce({ ok: true, status: "revoked" });
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(mocks.manageAccess).toHaveBeenCalledWith(accessGrantId, "revoke"));
    fireEvent.click(screen.getByRole("button", { name: /Sharing history/i }));
    expect(screen.getByText("Private details shared with Rohan Mehta")).toBeInTheDocument();
  });

  it("distinguishes an existing approval from currently available viewing", () => {
    renderDashboard({
      ...shareablePublished,
      isExpired: false,
      publicationReadiness: { ...readyPublicationReadiness, verificationStatus: "required" },
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
        events: [],
      },
    });

    const metrics = document.querySelector(".dashboard-stats-grid") as HTMLElement;
    expect(within(metrics).getByText("Currently sharing with").closest(".dashboard-stat-card")).toHaveTextContent("1");
    expect(within(metrics).getByRole("link", { name: "Viewing unavailable · Manage" })).toHaveAttribute("href", "#introductions-and-access");
    expect(screen.getByText("Viewing paused · Sharing ends Jan 1, 2099")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByText(/Your sharing choice remains on record, but this person cannot open/)).toBeInTheDocument();
    expect(screen.getByText("Public sharing is off")).toBeInTheDocument();
  });

  it("updates, deletes, and uploads owner photos", async () => {
    const { container } = renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    expect(screen.getByText("1/8")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Profile photo" })).toHaveClass("w-36", "sm:w-40");
    const portrait = await screen.findByAltText("Portrait");
    expect(portrait).toHaveAttribute("src", "https://signed.test/one-thumb.webp");
    expect(portrait.parentElement).toHaveClass("h-36", "sm:h-40");
    expect(screen.getByRole("button", { name: /add photos/i })).toHaveClass("h-36", "w-36", "sm:h-40", "sm:w-40");
    const visibility = screen.getByLabelText("Photo visibility");
    expect(within(visibility).getByRole("option", { name: "Blurred until shared" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?error=session_expired"));
    first.unmount();
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1" } });
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: readyPublicationReadiness,
    });
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    fireEvent.click(screen.getByRole("button", { name: /review saved changes/i }));
    expect(await screen.findByRole("dialog", { name: /review and publish/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^review public introduction$/i })).toHaveAttribute("href", "/preview");
    expect(screen.getByRole("link", { name: /^review private details$/i })).toHaveAttribute("href", "/approved-preview");
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    await acceptPublicationDisclosure();
    fireEvent.click(screen.getByRole("button", { name: /save and publish/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    fireEvent.click(screen.getByRole("button", { name: /review saved changes/i }));
    expect(await screen.findByRole("dialog", { name: /review and publish/i })).toBeInTheDocument();
    await acceptPublicationDisclosure();
    fireEvent.click(screen.getByRole("button", { name: /save and publish/i }));

    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalledWith({
      action: "confirm_disclosure",
      value: "publication-disclosure-v2",
    }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      personal: expect.objectContaining({ first_name: "Aditi" }),
    })));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("shows truthful publish progress until the request succeeds", async () => {
    let finishPublish!: (value: unknown) => void;
    mocks.publish.mockImplementationOnce(() => new Promise((resolve) => { finishPublish = resolve; }));
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: readyPublicationReadiness,
    });

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    fireEvent.click(screen.getByRole("button", { name: /review saved changes/i }));
    const review = await screen.findByRole("dialog", { name: /review and publish/i });
    await acceptPublicationDisclosure();
    fireEvent.click(within(review).getByRole("button", { name: /save and publish/i }));

    const status = within(review).getByRole("status");
    expect(status).toHaveTextContent("Publishing your changes");
    expect(status).toHaveTextContent("Keep this page open until the result appears.");
    expect(within(review).getByRole("button", { name: "Publishing..." })).toBeDisabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());

    await act(async () => { finishPublish({ ok: true, data: {} }); });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument());
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("clears publish progress after an unexpected failure and permits a retry", async () => {
    let failPublish!: (reason?: unknown) => void;
    mocks.publish.mockImplementationOnce(() => new Promise((_resolve, reject) => { failPublish = reject; }));
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: readyData },
      media: [{ ...media, media_type: "hero" }],
      publicationReadiness: readyPublicationReadiness,
    });

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    fireEvent.click(screen.getByRole("button", { name: /review saved changes/i }));
    const review = await screen.findByRole("dialog", { name: /review and publish/i });
    await acceptPublicationDisclosure();
    fireEvent.click(within(review).getByRole("button", { name: /save and publish/i }));
    expect(within(review).getByRole("status")).toHaveTextContent("Publishing your changes");
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());

    await act(async () => { failPublish(new Error("Temporary service failure")); });
    expect(within(review).queryByRole("status")).not.toBeInTheDocument();
    expect(within(review).getByRole("alert")).toHaveTextContent("We could not publish your introduction. Please try again.");
    expect(within(review).getByRole("button", { name: /save and publish/i })).toBeEnabled();

    fireEvent.click(within(review).getByRole("button", { name: /save and publish/i }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument());
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
    expect(screen.getByRole("link", { name: "View their VivIntro introduction" })).toHaveAttribute(
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

  it("keeps only the latest three records on the dashboard and paginates the full server queue", async () => {
    const interests = Array.from({ length: 9 }, (_, index) => ({
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      viewer_name: `Viewer ${index + 1}`,
      viewer_phone: null,
      viewer_email: `viewer${index + 1}@example.com`,
      viewer_family_context: null,
      message: `Message ${index + 1}`,
      status: "new",
      requester_user_id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
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
    expect(await within(dialog).findByText("Page 1 of 2")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viewer 1")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Next/i }));
    expect(await within(dialog).findByText("Viewer 1")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText("Search by name or email…"), { target: { value: "Viewer 4" } });
    expect(await within(dialog).findByText("Viewer 4")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viewer 5")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close and return to dashboard" }));
    expect(screen.queryByRole("dialog", { name: "Awaiting review" })).not.toBeInTheDocument();
  });

  it("moves ended access out of the active queue and into history", async () => {
    renderDashboard({
      accessSummary: {
        grants: [
          { id: "11111111-1111-4111-8111-111111111111", interestRequestId: "22222222-2222-4222-8222-222222222221", viewerName: "Active Viewer", status: "active", expiresAt: "2099-01-01T00:00:00.000Z" },
          { id: "11111111-1111-4111-8111-111111111112", interestRequestId: "22222222-2222-4222-8222-222222222222", viewerName: "Expired Viewer", status: "expired", expiresAt: "2025-01-01T00:00:00.000Z" },
          { id: "11111111-1111-4111-8111-111111111113", interestRequestId: "22222222-2222-4222-8222-222222222223", viewerName: "Ended Viewer", status: "revoked", expiresAt: "2099-01-01T00:00:00.000Z", revokedAt: "2026-01-01T00:00:00.000Z" },
        ],
        events: [],
      },
    });

    expect(screen.getByText("Active Viewer")).toBeInTheDocument();
    expect(screen.queryByText("Expired Viewer")).not.toBeInTheDocument();
    expect(screen.queryByText("Ended Viewer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sharing history/i }));
    const history = screen.getByRole("dialog", { name: "Relationship history" });
    expect(await within(history).findByText("Expired Viewer")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Sharing history/i }));
    const history = screen.getByRole("dialog", { name: "Relationship history" });
    expect(within(history).getByText("Priya Shah")).toBeInTheDocument();
    expect(within(history).getByText("Broker introduction")).toBeInTheDocument();
    fireEvent.change(within(history).getByRole("textbox"), { target: { value: "Priya" } });
    expect(within(history).getByText("Priya Shah")).toBeInTheDocument();
    fireEvent.change(within(history).getByRole("textbox"), { target: { value: "someone else" } });
    expect(within(history).queryByText("Priya Shah")).not.toBeInTheDocument();
    fireEvent.change(within(history).getByRole("textbox"), { target: { value: "" } });
    fireEvent.change(within(history).getByRole("combobox"), { target: { value: "direct" } });
    expect(within(history).queryByText("Priya Shah")).not.toBeInTheDocument();
    fireEvent.change(within(history).getByRole("combobox"), { target: { value: "broker" } });
    expect(within(history).getByText("Priya Shah")).toBeInTheDocument();
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
    expect(screen.getByRole("region", { name: "Introduction link" })).toBeInTheDocument();
    expect(screen.queryByText("Introduction link active")).not.toBeInTheDocument();
  });

  it("cancels publication review without changing the public portfolio", async () => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData }, media: [{ ...media, media_type: "hero" }] });
    fireEvent.click(screen.getByRole("button", { name: "Review saved changes" }));
    expect(await screen.findByRole("dialog", { name: /review and publish/i })).toBeInTheDocument();
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /review and publish/i })).not.toBeInTheDocument());
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("keeps interests, sharing history, and stats visible while unpublished", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /Sharing history/i }));
    expect(screen.getByText("Introduction unpublished")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Public sharing is off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Share on WhatsApp/i })).not.toBeInTheDocument();
  });

  it("shows disclosure details only for fields hidden until approval", () => {
    renderDashboard({ initialEditorOpen: true, portfolio: { ...portfolio, draft_data: readyData }, media: [{ ...media, media_type: "hero" }] });
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "work" } });
    expect(screen.queryByText(/Shown in:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Employer or organisation")).toHaveAccessibleDescription(/Shared only when you choose/);
  });

  it("requires explicit sharing-setup update for a historical draft before review", () => {
    renderDashboard({
      initialEditorOpen: true,
      portfolio: { ...portfolio, draft_data: { ...readyData, privacy_mode: "private" } },
      media: [{ ...media, media_type: "hero" }],
    });
    fireEvent.change(screen.getByLabelText("Go to introduction section"), { target: { value: "privacy" } });
    expect(screen.getByRole("button", { name: "Update sharing setup" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brief Introduction/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update sharing setup" }));
    expect(screen.queryByRole("button", { name: "Update sharing setup" })).not.toBeInTheDocument();
  });

  it("preserves unsaved answers, offers retry, and warns before closing", async () => {
    mocks.save.mockResolvedValueOnce({
      ok: false,
      error: { code: "DASHBOARD_SAVE_FAILED", message: "We could not save your portfolio right now." },
    });
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    fireEvent(window, beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    vi.mocked(confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(screen.getByRole("heading", { name: "Introduction details" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still on this screen.");
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  });

  it("discards failed-save edits on confirmed exit and restores saved dashboard progress", async () => {
    mocks.save.mockResolvedValueOnce({
      ok: false,
      error: { code: "DASHBOARD_SAVE_FAILED", message: "Save unavailable" },
    });
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData },
      publicationReadiness: readyPublicationReadiness,
    });
    const savedProgress = screen.getByRole("heading", { name: /required draft answers complete/ }).textContent;
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still on this screen.");

    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Discard them"));
    expect(screen.queryByRole("heading", { name: "Introduction details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /required draft answers complete/ })).toHaveTextContent(savedProgress || "");

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    expect(screen.getByLabelText("Short description")).toHaveValue(readyData.personal.short_bio);
  });

  it("keeps field focus while editing and applies the same discard confirmation on Escape", () => {
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData } });
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    const firstName = screen.getByLabelText("First name");
    firstName.focus();
    fireEvent.change(firstName, { target: { value: "Changed" } });
    expect(firstName).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Discard them"));
    expect(screen.queryByRole("heading", { name: "Introduction details" })).not.toBeInTheDocument();
  });

  it("restores the latest successful save rather than stale initial props after a later failure", async () => {
    const newerDraft = { ...readyData, personal: { ...readyData.personal, short_bio: "A newly saved introduction." } };
    mocks.save.mockResolvedValueOnce({ ok: true, data: { portfolioId: "portfolio-1", draftData: newerDraft, readiness: readyPublicationReadiness } });
    mocks.save.mockResolvedValueOnce({ ok: false, error: { code: "DASHBOARD_SAVE_FAILED", message: "Save unavailable" } });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData }, publicationReadiness: readyPublicationReadiness });
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: newerDraft.personal.short_bio } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(screen.getByText("Draft saved")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still on this screen.");
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    expect(screen.getByLabelText("Short description")).toHaveValue(newerDraft.personal.short_bio);
  });

  it("shows the same currency error as Continue after clearing and saving a historical income", async () => {
    const historical = { ...readyData, career: { title: "Engineer", annual_income: "50k-75k" } };
    const cleared = { ...historical, career: { ...historical.career, annual_income: "" } };
    mocks.save.mockResolvedValueOnce({ ok: true, data: { portfolioId: "portfolio-1", draftData: cleared } });
    renderDashboard({ portfolio: { ...portfolio, draft_data: historical }, initialEditorOpen: true,
      media: [{ ...media, media_type: "hero" }], publicationReadiness: { ...readyPublicationReadiness, lastEditorSection: "work" } });
    fireEvent.change(screen.getByLabelText("Annual income range"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(screen.getByText("Draft saved")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Annual income range"), { target: { value: "50k-75k" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByRole("combobox", { name: /^Income currency/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("Choose the currency for this income range, or clear the income range.").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Education and work" })).toBeInTheDocument();
  });

  it("does not restore publication consent after a persisted photo change and discarded edit", async () => {
    mocks.save.mockResolvedValueOnce({ ok: false, error: { code: "DASHBOARD_SAVE_FAILED", message: "Save unavailable" } });
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: null, is_published: false },
      media: [{ ...media, media_type: "hero" }],
      shareUrl: null,
      publicationReadiness: { ...readyPublicationReadiness, published: false,
        publicPreviewReviewed: true, completePreviewReviewed: true, reviewFingerprint: "a".repeat(64) },
    });
    const reviewStep = () => within(screen.getByRole("list", { name: "Publication steps" }))
      .getByText("Final publication consent").closest("li");
    expect(reviewStep()?.className).toContain("bg-[var(--workspace-surface-muted)]");

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.change(screen.getByLabelText("Photo visibility"), { target: { value: "interest_required" } });
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still on this screen.");
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    expect(reviewStep()?.className).not.toContain("bg-[var(--workspace-surface-muted)]");
  });

  it("does not resurrect publication consent when a stale draft save finishes after a photo change", async () => {
    let resolveSave!: (result: unknown) => void;
    const reviewedReadiness = { ...readyPublicationReadiness, published: false,
      publicPreviewReviewed: true, completePreviewReviewed: true, reviewFingerprint: "a".repeat(64) };
    mocks.save.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    renderDashboard({
      portfolio: { ...portfolio, draft_data: readyData, published_data: null, is_published: false },
      media: [{ ...media, media_type: "hero" }],
      shareUrl: null,
      publicationReadiness: reviewedReadiness,
    });
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /delete photo/i }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("media-1"));
    await act(async () => resolveSave({ ok: true, data: { portfolioId: "portfolio-1", draftData: readyData,
      readiness: reviewedReadiness } }));
    await waitFor(() => expect(screen.getByText("Changes not saved")).toBeInTheDocument());

    mocks.save.mockResolvedValueOnce({ ok: false, error: { code: "DASHBOARD_SAVE_FAILED", message: "Save unavailable" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers are still on this screen.");
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    const reviewStep = within(screen.getByRole("list", { name: "Publication steps" }))
      .getByText("Final publication consent").closest("li");
    expect(reviewStep?.className).not.toContain("bg-[var(--workspace-surface-muted)]");
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
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mocks.save).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Updated" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it("keeps a saved editor open and defers its server refresh until returning to the dashboard", async () => {
    const readiness = { ...readyPublicationReadiness, reviewFingerprint: "a".repeat(64), disclosureConfirmed: false };
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", readiness } });
    mocks.updateProgress.mockResolvedValue({ ok: true, data: { readiness } });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData }, initialEditorOpen: true,
      media: [{ ...media, media_type: "hero" }], publicationReadiness: readiness });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(screen.getByText("Draft saved")).toBeInTheDocument());
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Introduction details" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Changed");
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Draft saved")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Review saved changes" }));
    await waitFor(() => expect(mocks.updateProgress).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const review = await screen.findByRole("dialog", { name: /review and publish/i });
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "Back to editing" }));
    expect(screen.getByLabelText("First name")).toHaveValue("Changed");
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /back to dashboard/i }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog", { name: "Introduction details" })).not.toBeInTheDocument();
  });

  it("retains an in-progress name space after autosave returns normalized name parts", async () => {
    vi.useFakeTimers();
    mocks.save.mockResolvedValue({ ok: true, data: { portfolioId: "portfolio-1", draftData: {
      ...readyData, personal: { ...readyData.personal, first_name: "Mary", name: "Mary Rao" },
    } } });
    renderDashboard({ portfolio: { ...portfolio, draft_data: readyData }, initialEditorOpen: true });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mary " } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("First name")).toHaveValue("Mary ");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("requires an explicit choice for legacy photo privacy without expanding access", () => {
    renderDashboard({ media: [{ ...media, visibility: "hidden" }] });
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login?error=session_revoked"));
  });

  it("keeps the paused-creator notice on a theme-aware contrast surface", () => {
    renderDashboard({ portfolio: { ...portfolio, is_published: false }, canCreatePortfolio: false });
    expect(screen.getByText(/Creator access is paused/)).toHaveClass(
      "bg-[var(--ui-success-surface)]",
      "text-[var(--workspace-ink)]",
    );
  });

  it("preserves unsaved answers across the real server page verification refresh", async () => {
    const dashboard = {
      portfolio: { ...portfolio, draft_data: readyData },
      canCreatePortfolio: true, viewCount: 0, media: [], mediaUrls: {}, horoscope: null,
      interests: [], accessSummary: { grants: [], events: [] },
      brokerIntroductionResponses: [], receivedBrokerIntroductions: [],
      publicationReadiness: { ...readyPublicationReadiness, verificationStatus: "required", reviewFingerprint: "a".repeat(64) },
    };
    mocks.loadDashboardView.mockResolvedValue(dashboard);
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(await resolveServerTree(await DashboardPage({ searchParams: Promise.resolve({ edit: "1" }) }))); });
    goToFoundation();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Unsaved" } });
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.loadDashboardView.mockResolvedValue({
      ...dashboard,
      publicationReadiness: { ...dashboard.publicationReadiness, verificationStatus: "verified" },
    });
    await act(async () => { view.rerender(await resolveServerTree(await DashboardPage({ searchParams: Promise.resolve({ edit: "1" }) }))); });
    expect(screen.getByLabelText("First name")).toHaveValue("Unsaved");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("fails safely when account setup has not become available", () => {
    renderDashboard({
      portfolio: null,
      canCreatePortfolio: false,
      shareUrl: null,
      media: [],
      viewCount: 0,
    });

    expect(screen.getByText("Account setup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your introduction is not ready to start yet." })).toBeInTheDocument();
    expect(screen.getByText(/shared-link access remain available/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start with the basics/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /interests to review/i })).not.toBeInTheDocument();
  });

});
