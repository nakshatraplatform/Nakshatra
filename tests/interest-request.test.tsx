// @vitest-environment jsdom

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const startAuthentication = vi.hoisted(() => vi.fn());
const verifyAuthenticationCode = vi.hoisted(() => vi.fn());
const continueToAuthProvider = vi.hoisted(() => vi.fn());
vi.mock("../src/components/portfolio/LocationFields", () => ({
  hasCompleteLocationHierarchy: (value: { countryCode?: string; regionCode?: string; city?: string; postalCode?: string }) =>
    value.countryCode === "US" && value.regionCode === "US-MA" && value.city === "Boston" && value.postalCode === "02108",
  LocationFields: ({ onChange }: { onChange: (value: Record<string, unknown>) => void }) => <fieldset>
    <legend>Your location</legend>
    <label>Country<select aria-label="Country" required defaultValue=""><option value="">Choose</option><option value="US">US</option></select></label>
    <label>State<select aria-label="State" required defaultValue=""><option value="">Choose</option><option value="MA">MA</option></select></label>
    <label>City<select aria-label="City" required defaultValue="" onChange={() => onChange({ country: "United States", countryCode: "US", region: "Massachusetts", regionCode: "US-MA", city: "Boston", postalCode: "02108", locationSource: "manual" })}><option value="">Choose</option><option value="4930956">4930956</option></select></label>
  </fieldset>,
}));
vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/auth/client/auth.api", () => ({ continueToAuthProvider, startAuthentication, verifyAuthenticationCode }));

import { InterestRequestModal } from "../src/components/portfolio/InterestRequestModal";
import { POST } from "../src/app/api/interest/route";
import {
  interestSubmissionSchema,
  interestRequestValidationMessage,
} from "../src/features/interest/server/interest.contract";

const requiredLocationPayload = {
  country: "United States", state: "Massachusetts", city: "Boston", countryCode: "US",
  subdivisionCode: "US-MA", postalCode: "02108", locationSource: "manual",
};
const decisionDetails = {
  familyContext: "Our family values honesty, kindness and mutual respect.",
  message: "I enjoyed reading your introduction and would like to learn more about your family, interests and plans for the future.",
  location: requiredLocationPayload,
};
function fillDecisionDetails() {
  fireEvent.change(screen.getByLabelText("Family context"), { target: { value: decisionDetails.familyContext } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: decisionDetails.message } });
  for (const [field, value] of [["Country", "US"], ["State", "MA"], ["City", "4930956"]]) fireEvent.change(screen.getByLabelText(field), { target: { value } });
  if (screen.queryByLabelText("Candidate’s full name")) {
    fireEvent.change(screen.getByLabelText("Candidate’s full name"), { target: { value: "Arun Mehta" } });
    fireEvent.change(screen.getByLabelText("Candidate’s email"), { target: { value: "arun@example.com" } });
    fireEvent.change(screen.getByLabelText("Candidate’s phone (optional)"), { target: { value: "+1 617 555 0123" } });
  }
}
describe("interest flow", () => {
  it("dismisses pending Google work, preserves one operation, and requires explicit continuation after dismissal", async () => {
    let complete!: (value: unknown) => void;
    startAuthentication.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByRole("button", { name: "Connecting to Google" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close interest form" }));
    await act(async () => complete({ ok: true, body: { url: "https://accounts.google.test/oauth" } }));
    expect(continueToAuthProvider).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Google" }));
    expect(continueToAuthProvider).toHaveBeenCalledWith("https://accounts.google.test/oauth");
    expect(startAuthentication).toHaveBeenCalledTimes(1);
  });

  it("ignores a provider success after unmount", async () => {
    let complete!: (value: unknown) => void;
    startAuthentication.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const { unmount } = render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    unmount();
    await act(async () => complete({ ok: true, body: { url: "https://accounts.google.test/oauth" } }));
    expect(continueToAuthProvider).not.toHaveBeenCalled();
  });
  it("does not submit interest when an email verification response arrives after unmount", async () => {
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    let complete!: (value: unknown) => void;
    verifyAuthenticationCode.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    const { unmount } = render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 617 555 0123" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.submit(screen.getByRole("button", { name: "Verify email and continue" }).closest("form")!);
    const code = await screen.findByLabelText("Six-digit code");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("button", { name: "Verify email" }).closest("form")!);
    unmount();
    await act(async () => complete({ ok: true, body: { verified: true, email: "rohan@example.com" } }));
    expect(request).not.toHaveBeenCalled();
    expect(verifyAuthenticationCode.mock.calls[0][1].aborted).toBe(true);
  });
  it("focuses and describes an incomplete existing-profile location before sending", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="rohan@example.com" existingViewerProfile={{ name: "Rohan Mehta", profileFor: "self", phone: "", country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.submit(screen.getByRole("button", { name: "Send interest" }).closest("form")!);
    const location = await screen.findByRole("group", { name: "Your location", description: /./ });
    await waitFor(() => expect(location).toHaveFocus());
    expect(location).toHaveAttribute("data-invalid", "true");
    expect(location).toHaveAccessibleDescription();
    expect(request).not.toHaveBeenCalled();
  });
  it("submits a name-only candidate with a blank message and prevents duplicate in-flight sends", async () => {
    let complete!: (response: Response) => void;
    const request = vi.fn<typeof fetch>(() => new Promise<Response>(resolve => { complete = resolve; }));
    vi.stubGlobal("fetch", request);
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="rohan@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "daughter" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 617 555 0123" } });
    fillDecisionDetails();
    fireEvent.change(screen.getByLabelText("Candidate’s email"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Candidate’s phone (optional)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "" } });
    const form = screen.getByRole("button", { name: "Send interest" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Sending interest" })).toBeDisabled();
    const payload = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(payload.candidate).toEqual({ name: "Arun Mehta", relationship: "Parent" });
    expect(payload.message).toBeNull();
    complete(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    expect(await screen.findByText(/Interest sent to Ananya/)).toBeInTheDocument();
  });

  it("starts Google without a redundant registered-email field", async () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(screen.queryByLabelText("Registered email")).not.toBeInTheDocument();
    await waitFor(() => expect(startAuthentication).toHaveBeenCalledWith({ method: "google", redirect: "/p/portfolio-token#portfolio-interest" }, expect.any(AbortSignal)));
  });
  it.each(["light", "dark"] as const)("uses the %s dialog artwork independently of the document theme", (appearance) => {
    document.documentElement.dataset.appTheme = appearance === "dark" ? "light" : "dark";
    const { unmount } = render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} appearance={appearance} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest("[data-appearance]")).toHaveAttribute("data-appearance", appearance);
    const artwork = dialog.querySelector('[data-brand-variant="stacked"]')!;
    expect(artwork).toHaveAttribute("data-brand-tone", appearance === "dark" ? "reverse" : "primary");
    expect(artwork.querySelectorAll("img")).toHaveLength(1);
    unmount();
    delete document.documentElement.dataset.appTheme;
  });
  it.each(["abcdefg", "-------", "12", "+1 22222222222222222222"])("rejects invalid interest phone %s at the API contract", (phone) => {
    const parsed = interestSubmissionSchema.safeParse({ portfolioToken: "portfolio-token", name: "Rohan Mehta", profileFor: "self", phone, email: "rohan@example.com" });
    expect(parsed.success).toBe(false);
  });
  it("does not send an email code for an invalid phone entered in the modal", async () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 abcdefgh" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.submit(screen.getByRole("button", { name: "Verify email and continue" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("valid phone number");
    expect(startAuthentication).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    enforceRateLimit.mockResolvedValue(null);
    startAuthentication.mockResolvedValue({ ok: true, body: { sent: true } });
    verifyAuthenticationCode.mockResolvedValue({ ok: true, body: { verified: true, email: "rohan@example.com" } });
  });

  it("submits from a modal and returns to the introduction confirmation state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 })));
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="rohan@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.click(screen.getByRole("button", { name: "Send interest" }));

    expect(await screen.findByText(/Interest sent to Ananya/i)).toBeInTheDocument();
    expect(screen.getByText(/Ananya can review your interest and decide whether to share private details/i)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1900));
    expect(screen.getByRole("dialog", { name: "Interest sent" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to introduction" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("They’ll share more if they’d like to continue.");
    const request = vi.mocked(fetch).mock.calls[0];
    const submitted = JSON.parse(String((request[1] as RequestInit).body));
    expect(submitted).toMatchObject({
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
      ...requiredLocationPayload,
      ...decisionDetails,
    });
  });

  it("verifies a signed-out viewer inside the modal before submitting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 })));
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.click(screen.getByRole("button", { name: "Verify email and continue" }));

    await waitFor(() => expect(startAuthentication).toHaveBeenCalledWith({
      method: "email_otp",
      email: "rohan@example.com",
      redirect: "/p/portfolio-token",
    }, expect.any(AbortSignal)));
    fireEvent.change(await screen.findByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    await waitFor(() => expect(verifyAuthenticationCode).toHaveBeenCalledWith({
      purpose: "viewer_interest",
      email: "rohan@example.com",
      token: "123456",
      redirect: "/p/portfolio-token",
    }, expect.any(AbortSignal)));
    expect(await screen.findByText(/Interest sent to Ananya/i)).toBeInTheDocument();
  });

  it("keeps verification disabled until six digits and resets an invalid code", async () => {
    verifyAuthenticationCode.mockResolvedValueOnce({ ok: false, body: { error: "That code is incorrect or has expired." } });
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.click(screen.getByRole("button", { name: "Verify email and continue" }));

    const input = await screen.findByLabelText("Six-digit code");
    const verifyButton = screen.getByRole("button", { name: "Verify email" });
    expect(verifyButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "12345" } });
    expect(verifyButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "123456" } });
    expect(verifyButton).toBeEnabled();
    fireEvent.click(verifyButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect or has expired");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("does not discard an in-progress verification when the backdrop is clicked", async () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.click(screen.getByRole("button", { name: "Verify email and continue" }));

    const codeInput = await screen.findByLabelText("Six-digit code");
    fireEvent.change(codeInput, { target: { value: "123456" } });
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog.parentElement!);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Six-digit code")).toHaveValue("123456");
  });

  it("warns that a resent code replaces every earlier code", async () => {
    vi.useFakeTimers();
    try {
      render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
      fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
      fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
      fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 555 010 2200" } });
      fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
      fireEvent.click(screen.getByRole("button", { name: "Verify email and continue" }));
      await vi.runAllTimersAsync();

      expect(screen.getByText(/requesting another code makes the earlier code stop working/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores submitted details when the viewer returns from verification", async () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "relative" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
    fireEvent.click(screen.getByRole("button", { name: "Verify email and continue" }));

    fireEvent.click(await screen.findByRole("button", { name: "Change details" }));

    expect(screen.getByLabelText("Full name")).toHaveValue("Rohan Mehta");
    expect(screen.getByLabelText("Who are you contacting for?")).toHaveValue("relative");
    expect(screen.getByRole("textbox", { name: "Country calling code" })).toHaveValue("1");
    expect(screen.getByRole("textbox", { name: "Phone number" })).toHaveValue("555 010 2200");
    expect(screen.getByLabelText("Email address")).toHaveValue("rohan@example.com");
  });

  it("requires location and decision-making context in the new visitor form", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    for (const label of ["Full name", "Who are you contacting for?", "Email address", "Country", "State", "City", "Family context"]) expect(screen.getByLabelText(label)).toBeRequired();
expect(screen.getByRole("textbox", { name: "Phone number" })).toBeRequired();
    expect(screen.getByLabelText("Message")).not.toBeRequired();
    expect(screen.queryByRole("group", { name: "Candidate details" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "son" } });
    expect(screen.getByLabelText("Candidate’s full name")).toBeRequired();
    expect(screen.getByLabelText("Candidate’s email")).not.toBeRequired();
    expect(screen.getByLabelText("Candidate’s phone (optional)")).not.toBeRequired();
    expect(screen.queryByLabelText("Your relationship to candidate")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Candidate’s location country")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    expect(screen.queryByRole("group", { name: "Candidate details" })).not.toBeInTheDocument();
  });

  it("offers an existing VivIntro user a Google continuation", async () => {
    startAuthentication.mockResolvedValueOnce({ ok: true, body: { url: "https://accounts.google.test/oauth" } });
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByText("Already use VivIntro?")).toBeInTheDocument();
    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    expect(screen.getByRole("link", { name: "Sign in to VivIntro" })).toHaveClass("portfolio-button-primary");
    fireEvent.click(googleButton);

    await waitFor(() => expect(startAuthentication).toHaveBeenCalledWith({
      method: "google",
      redirect: "/p/portfolio-token#portfolio-interest",
    }, expect.any(AbortSignal)));
    expect(continueToAuthProvider).toHaveBeenCalledWith("https://accounts.google.test/oauth");
  });

  it("reuses an authenticated VivIntro profile and asks only for context", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="rohan@example.com" existingViewerProfile={{ name: "Rohan Mehta", profileFor: "self", phone: "", country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));

    expect(screen.getByRole("heading", { name: "Confirm your details for Ananya's family" })).toBeInTheDocument();
    expect(screen.getByLabelText("VivIntro profile in use")).toHaveTextContent("Rohan Mehta");
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
    expect(screen.getByText(/Boston, Massachusetts, United States/)).toBeInTheDocument();
    expect(screen.getByLabelText("Family context")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("derives an existing viewer identity from the authenticated account", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        draft_data: {
          personal: { name: "Rohan Mehta", profile_for: "self", country: "United States", country_code: "US", region: "Massachusetts", region_code: "US-MA", city: "Boston", postal_code: "02108" },
          contact: { phone: "" },
        },
        published_data: null,
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { email: "ROHAN@EXAMPLE.COM", email_confirmed_at: "2026-09-20T12:00:00Z" } },
    });
    getApiUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "viewer-1" },
      supabase: { auth: { getUser }, from: vi.fn(() => ({ select })), rpc },
    });

    const response = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({
        portfolioToken: "portfolio-token",
        ...decisionDetails,
        useExistingProfile: true,
        country: "United States",
        countryCode: "US",
        state: "Massachusetts",
        subdivisionCode: "US-MA",
        city: "Boston",
        postalCode: "02108",
        locationSource: "existing_profile",
        familyContext: decisionDetails.familyContext,
        message: "",
      }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("submit_existing_interest", expect.objectContaining({
      p_share_token: "portfolio-token",

      p_family_context: decisionDetails.familyContext,
      p_message: null,
    }));
  });

  it("disables interest on the signed-in owner's own portfolio", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="owner@example.com" isOwner />);

    const action = screen.getByRole("button", { name: "Show interest" });
    expect(action).toBeDisabled();
    expect(screen.getByText("This is your introduction.")).toBeInTheDocument();
    fireEvent.click(action);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("validates and stores an interest for an active portfolio", async () => {
    const contractCheck = interestSubmissionSchema.safeParse({ portfolioToken: "portfolio-token", ...decisionDetails, ...requiredLocationPayload, name: "Rohan Mehta", profileFor: "self", phone: "+1 555 010 2200", email: "rohan@example.com" });
    if (!contractCheck.success) throw new Error(JSON.stringify(contractCheck.error.issues));
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    getApiUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "viewer-1" },
      supabase: { rpc },
    });

    const response = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({
        portfolioToken: "portfolio-token",
        ...decisionDetails,
        name: "Rohan Mehta",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "rohan@example.com",
        ...requiredLocationPayload,
      }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("submit_interest_details", { p_details: expect.objectContaining({
      portfolioToken: "portfolio-token", name: "Rohan Mehta", ...decisionDetails,
    }) });

    const detailedResponse = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({
        portfolioToken: "portfolio-token",
        ...decisionDetails,
        name: "Rohan Mehta",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "rohan@example.com",
        country: "Canada",
        state: "Ontario",
        city: "Toronto",
        familyContext: decisionDetails.familyContext,
        message: decisionDetails.message,
        portfolioUrl: "https://untrusted.example/rohan",
      }),
    }));

    expect(detailedResponse.status).toBe(400);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("requires a verified session before accepting an interest", async () => {
    getApiUser.mockResolvedValue({ status: "missing_session" });
    const response = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(401);
  });

  it("returns a clear response when the owner requests their own portfolio", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "22023", message: "portfolio owner cannot request own portfolio" },
    });
    getApiUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "owner-1" },
      supabase: { rpc },
    });

    const response = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({
        portfolioToken: "portfolio-token",
        ...decisionDetails,
        name: "Portfolio Owner",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "owner@example.com",
        ...requiredLocationPayload,
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "OWN_PORTFOLIO_INTEREST",
      error: expect.stringContaining("own portfolio"),
    });
  });

  it.each([
    {
      databaseError: { code: "23505", message: 'duplicate key value violates unique constraint "idx_interest_requests_candidate_prospect"' },
      expectedStatus: 409,
      expectedCode: "INTEREST_REQUEST_EXISTS",
    },
    {
      databaseError: { code: "42501", message: "verified email required" },
      expectedStatus: 403,
      expectedCode: "VERIFIED_EMAIL_REQUIRED",
    },
    {
      databaseError: { code: "22023", message: "invalid phone number" },
      expectedStatus: 400,
      expectedCode: "INTEREST_REQUEST_REJECTED",
    },
    {
      databaseError: { code: "PGRST202", message: "Could not find the function public.submit_public_interest" },
      expectedStatus: 503,
      expectedCode: "INTEREST_DATABASE_UPDATE_REQUIRED",
    },
  ])("returns an actionable response for $expectedCode", async ({ databaseError, expectedStatus, expectedCode }) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: databaseError });
    getApiUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "viewer-1" },
      supabase: { rpc },
    });

    const response = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({
        portfolioToken: "portfolio-token",
        ...decisionDetails,
        name: "Rohan Mehta",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "rohan@example.com",
        ...requiredLocationPayload,
      }),
    }));

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toMatchObject({ code: expectedCode });
  });

  it("handles invalid, unavailable, rate-limited, and unexpected requests", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null });
    getApiUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "viewer-1" },
      supabase: { rpc },
    });

    const invalid = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({ portfolioToken: "portfolio-token", portfolioUrl: "http://localhost:3000" }),
    }));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      code: "INTEREST_REQUEST_INVALID",
      error: expect.any(String),
    });

    const payload = JSON.stringify({
      portfolioToken: "portfolio-token",
        ...decisionDetails,
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
      ...requiredLocationPayload,
    });
    const unavailable = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: payload,
    }));
    expect(unavailable.status).toBe(404);

    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0429", message: "quota exceeded", details: "60" } });
    const limited = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: payload,
    }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(enforceRateLimit).not.toHaveBeenCalled();

    enforceRateLimit.mockResolvedValue(null);
    rpc.mockRejectedValueOnce(new Error("database unavailable"));
    const failed = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: payload,
    }));
    expect(failed.status).toBe(500);
  });

  it.each([
    [{ name: "" }, "full name"],
    [{ profileFor: "" }, "contacting for"],
    [{ phone: "" }, "phone number"],
    [{ email: "not-an-email" }, "email address"],
    [{ message: "x".repeat(601) }, "80–600"],
  ])("explains the first invalid field in the interest form", (override, expectedMessage) => {
    const parsed = interestSubmissionSchema.safeParse({
      portfolioToken: "portfolio-token",
        ...decisionDetails,
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
      ...requiredLocationPayload,
      ...override,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(interestRequestValidationMessage(parsed.error)).toContain(expectedMessage);
    }
  });

  it("normalizes ZIP+4 and accepts the canonical US Virgin Islands hierarchy", () => {
    const parsed = interestSubmissionSchema.parse({
      familyContext: decisionDetails.familyContext,
      message: decisionDetails.message,
      portfolioToken: "portfolio-token",
      useExistingProfile: false,
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
      country: "United States",
      countryCode: "US",
      state: "United States Virgin Islands",
      subdivisionCode: "US-VI",
      city: "Charlotte Amalie",
      postalCode: "00802-1234",
      locationSource: "manual",
      location: { country: "United States", countryCode: "US", state: "United States Virgin Islands", subdivisionCode: "US-VI", city: "Charlotte Amalie", postalCode: "00802-1234", locationSource: "manual" },
    });

    expect(parsed.postalCode).toBe("00802");
  });
});
