// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const startAuthentication = vi.hoisted(() => vi.fn());
const verifyAuthenticationCode = vi.hoisted(() => vi.fn());
const continueToAuthProvider = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("@/features/auth/client/auth.api", () => ({ continueToAuthProvider, startAuthentication, verifyAuthenticationCode }));

import { InterestRequestModal } from "../src/components/portfolio/InterestRequestModal";
import { POST } from "../src/app/api/interest/route";
import {
  interestSubmissionSchema,
  interestRequestValidationMessage,
} from "../src/features/interest/server/interest.contract";

describe("interest request flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    fireEvent.change(screen.getByLabelText("Your full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Contacting for"), { target: { value: "self" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send interest" }));

    expect(await screen.findByText(/Request sent to Ananya's family/i)).toBeInTheDocument();
    const request = vi.mocked(fetch).mock.calls[0];
    const submitted = JSON.parse(String((request[1] as RequestInit).body));
    expect(submitted).toMatchObject({
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
      country: "",
      state: "",
      city: "",
      familyContext: "",
      message: "",
    });
  });

  it("verifies a signed-out viewer inside the modal before submitting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 })));
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Your full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Contacting for"), { target: { value: "self" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email and continue" }));

    await waitFor(() => expect(startAuthentication).toHaveBeenCalledWith({
      method: "email_otp",
      email: "rohan@example.com",
      redirect: "/p/portfolio-token",
    }));
    fireEvent.change(await screen.findByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    await waitFor(() => expect(verifyAuthenticationCode).toHaveBeenCalledWith({
      purpose: "viewer_interest",
      email: "rohan@example.com",
      token: "123456",
      redirect: "/p/portfolio-token",
    }));
    expect(await screen.findByText(/Request sent to Ananya's family/i)).toBeInTheDocument();
  });

  it("keeps verification disabled until six digits and resets an invalid code", async () => {
    verifyAuthenticationCode.mockResolvedValueOnce({ ok: false, body: { error: "That code is incorrect or has expired." } });
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
    fireEvent.change(screen.getByLabelText("Your full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Contacting for"), { target: { value: "self" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+1 555 010 2200" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
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

  it("keeps location and introductions optional in the form", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));

    expect(screen.getByLabelText("Your full name")).toBeRequired();
    expect(screen.getByLabelText("Contacting for")).toBeRequired();
    expect(screen.getByLabelText("Phone number")).toBeRequired();
    expect(screen.getByLabelText("Email address")).toBeRequired();
    fireEvent.click(screen.getByText("Add more details"));
    expect(screen.getByLabelText("Country")).not.toBeRequired();
    expect(screen.getByLabelText("State or province")).not.toBeRequired();
    expect(screen.getByLabelText("City")).not.toBeRequired();
    expect(screen.getByLabelText("Family context")).not.toBeRequired();
    expect(screen.getByLabelText("Message")).not.toBeRequired();
    expect(screen.getByLabelText("Country")).toHaveValue("");
    expect(screen.getByLabelText("State or province")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("Family context")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.queryByLabelText("Your portfolio link")).not.toBeInTheDocument();
  });

  it("offers an existing VivIntro user a Google continuation", async () => {
    startAuthentication.mockResolvedValueOnce({ ok: true, body: { url: "https://accounts.google.test/oauth" } });
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByText("Already use VivIntro?")).toBeInTheDocument();
    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    expect(googleButton).toHaveClass("portfolio-button-primary");
    fireEvent.click(googleButton);

    await waitFor(() => expect(startAuthentication).toHaveBeenCalledWith({
      method: "google",
      redirect: "/p/portfolio-token#portfolio-interest",
    }));
    expect(continueToAuthProvider).toHaveBeenCalledWith("https://accounts.google.test/oauth");
  });

  it("reuses an authenticated VivIntro profile and asks only for context", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="rohan@example.com" existingViewerProfile={{ name: "Rohan Mehta", profileFor: "self", phone: "", city: "Toronto" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));

    expect(screen.getByRole("heading", { name: "Add a note for Ananya's family" })).toBeInTheDocument();
    expect(screen.getByLabelText("VivIntro profile in use")).toHaveTextContent("Rohan Mehta");
    expect(screen.queryByLabelText("Your full name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Family context")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("derives an existing viewer identity from the authenticated account", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        draft_data: {
          personal: { name: "Rohan Mehta", profile_for: "self", city: "Toronto" },
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
        useExistingProfile: true,
        familyContext: "Our families have friends in common.",
        message: "We would be glad to connect.",
      }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("submit_public_interest", expect.objectContaining({
      p_share_token: "portfolio-token",
      p_name: "Rohan Mehta",
      p_profile_for: "self",
      p_phone: "",
      p_email: "rohan@example.com",
      p_city: "Toronto",
      p_family_context: "Our families have friends in common.",
      p_message: "We would be glad to connect.",
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
        name: "Rohan Mehta",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "rohan@example.com",
      }),
    }));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("submit_public_interest", {
      p_share_token: "portfolio-token",
      p_name: "Rohan Mehta",
      p_profile_for: "self",
      p_phone: "+1 555 010 2200",
      p_email: "rohan@example.com",
      p_location: null,
      p_family_context: null,
      p_message: null,
      p_portfolio_url: null,
      p_country: null,
      p_state: null,
      p_city: null,
    });

    const detailedResponse = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: JSON.stringify({
        portfolioToken: "portfolio-token",
        name: "Rohan Mehta",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "rohan@example.com",
        country: "Canada",
        state: "Ontario",
        city: "Toronto",
        familyContext: "Our family lives in Toronto.",
        message: "We would be glad to connect.",
        portfolioUrl: "https://untrusted.example/rohan",
      }),
    }));

    expect(detailedResponse.status).toBe(201);
    expect(rpc).toHaveBeenLastCalledWith("submit_public_interest", {
      p_share_token: "portfolio-token",
      p_name: "Rohan Mehta",
      p_profile_for: "self",
      p_phone: "+1 555 010 2200",
      p_email: "rohan@example.com",
      p_location: "Toronto, Ontario, Canada",
      p_family_context: "Our family lives in Toronto.",
      p_message: "We would be glad to connect.",
      p_portfolio_url: null,
      p_country: "Canada",
      p_state: "Ontario",
      p_city: "Toronto",
    });
  });

  it("requires a verified session before accepting an interest request", async () => {
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
        name: "Portfolio Owner",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "owner@example.com",
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
        name: "Rohan Mehta",
        profileFor: "self",
        phone: "+1 555 010 2200",
        email: "rohan@example.com",
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
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
    });
    const unavailable = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: payload,
    }));
    expect(unavailable.status).toBe(404);

    enforceRateLimit.mockResolvedValueOnce(new Response(null, { status: 429 }));
    const limited = await POST(new Request("http://local/api/interest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://local" },
      body: payload,
    }));
    expect(limited.status).toBe(429);

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
    [{ message: "x".repeat(601) }, "too long"],
  ])("explains the first invalid field in the interest form", (override, expectedMessage) => {
    const parsed = interestSubmissionSchema.safeParse({
      portfolioToken: "portfolio-token",
      name: "Rohan Mehta",
      profileFor: "self",
      phone: "+1 555 010 2200",
      email: "rohan@example.com",
      ...override,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(interestRequestValidationMessage(parsed.error)).toContain(expectedMessage);
    }
  });
});
