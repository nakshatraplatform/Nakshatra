// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  function fillVisitor() {
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "self" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Country calling code" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "6175550123" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "rohan@example.com" } });
    fillDecisionDetails();
  }

  it("opens the visitor form without sign-in or account creation choices", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-step", "details");
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign in to VivIntro")).not.toBeInTheDocument();
    expect(screen.getByText(/No account is needed/)).toBeInTheDocument();
  });

  it("validates the phone before starting guest verification", async () => {
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fillVisitor();
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "abc" } });
    fireEvent.submit(screen.getByRole("button", { name: "Verify email and continue" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Phone number" })).toHaveAttribute("aria-invalid", "true"));
    expect(request).not.toHaveBeenCalled();
  });

  it("starts and completes guest verification without calling the Auth OTP flow", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ sent: true, challengeId: "11111111-1111-4111-8111-111111111111" }))
      .mockResolvedValueOnce(Response.json({ submitted: true }, { status: 201 }));
    vi.stubGlobal("fetch", request);
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fillVisitor();
    fireEvent.submit(screen.getByRole("button", { name: "Verify email and continue" }).closest("form")!);
    const code = await screen.findByLabelText("Six-digit code");
    const startBody = JSON.parse(request.mock.calls[0][1]!.body as string);
    expect(request.mock.calls[0][0]).toBe("/api/interest/guest");
    expect(startBody.action).toBe("start");
    expect(startBody.details.email).toBe("rohan@example.com");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("button", { name: "Verify email" }).closest("form")!);
    await screen.findByText("Interest sent to Ananya.");
    const completeBody = JSON.parse(request.mock.calls[1][1]!.body as string);
    expect(completeBody).toEqual({ action: "complete", challengeId: "11111111-1111-4111-8111-111111111111", email: "rohan@example.com", code: "123456" });
    expect(startAuthentication).not.toHaveBeenCalled();
    expect(verifyAuthenticationCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Return to introduction" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("keeps form answers across close and reopen", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
    fireEvent.click(screen.getByRole("button", { name: "Close interest form" }));
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Rohan Mehta");
  });

  it("uses the guest path even when the page was opened in a signed-in browser", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="rohan@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.queryByText("Using your VivIntro profile")).not.toBeInTheDocument();
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
