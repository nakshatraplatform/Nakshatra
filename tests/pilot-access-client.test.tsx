// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startAuthentication = vi.hoisted(() => vi.fn());
const verifyAuthenticationCode = vi.hoisted(() => vi.fn());
const continueToAuthProvider = vi.hoisted(() => vi.fn());
const getPilotAccessState = vi.hoisted(() => vi.fn());
const submitPilotAccess = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/client/auth.api", () => ({
  startAuthentication,
  verifyAuthenticationCode,
  continueToAuthProvider,
}));
vi.mock("@/features/pilot-access/client/pilot-access.api", () => ({
  getPilotAccessState,
  submitPilotAccess,
}));

import PilotAccessClient from "../src/app/pilot-access/pilot-access-client";

describe("launch waitlist experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
  });

  it("verifies an email and submits only account-bound applicant details", async () => {
    getPilotAccessState
      .mockResolvedValueOnce({ ok: false, unauthenticated: true, state: null, failure: null })
      .mockResolvedValueOnce({
        ok: true,
        unauthenticated: false,
        state: { canCreatePortfolio: false, isPilotAdministrator: false, application: null },
        failure: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        unauthenticated: false,
        state: {
          canCreatePortfolio: false,
          isPilotAdministrator: false,
          application: {
            requestRef: `par_${"a".repeat(32)}`,
            status: "pending",
            submittedAt: "2026-09-12T12:00:00Z",
            reviewedAt: null,
          },
        },
        failure: null,
      });
    startAuthentication.mockResolvedValue({ ok: true, body: { sent: true } });
    verifyAuthenticationCode.mockResolvedValue({ ok: true, body: { verified: true } });
    submitPilotAccess.mockResolvedValue({ ok: true, state: { status: "pending" }, failure: null });

    const user = userEvent.setup();
    render(<PilotAccessClient />);
    expect(await screen.findByRole("heading", { name: /join the vivintro waitlist/i })).toBeInTheDocument();
    expect(document.querySelector("main")).toHaveClass("pilot-access-shell");

    await user.type(screen.getByLabelText("Email address"), "Applicant@Example.com");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    expect(startAuthentication).toHaveBeenCalledWith({
      method: "pilot_access_otp",
      email: "Applicant@Example.com",
    });

    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirm email" }));
    expect(verifyAuthenticationCode).toHaveBeenCalledWith({
      purpose: "pilot_access",
      email: "Applicant@Example.com",
      token: "123456",
      redirect: "/pilot-access",
    });

    await user.type(await screen.findByLabelText("Your name"), "Aditi Rao");
    await user.type(screen.getByLabelText(/Phone number/), "+14155550100");
    await user.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Join the waitlist" }).closest("form")!);
    expect(submitPilotAccess).toHaveBeenCalledWith({
      displayName: "Aditi Rao",
      phoneE164: "+14155550100",
      contactConsentVersion: "launch_waitlist_v1",
      idempotencyKey: "pilot-submit:11111111-1111-4111-8111-111111111111",
    });
    expect(await screen.findByRole("heading", { name: /waitlist is confirmed/i })).toBeInTheDocument();
  });

  it("shows approved access and begins Google authentication safely", async () => {
    getPilotAccessState.mockResolvedValueOnce({
      ok: true,
      unauthenticated: false,
      state: { canCreatePortfolio: true, isPilotAdministrator: false, application: null },
      failure: null,
    });
    const { unmount } = render(<PilotAccessClient />);
    expect(await screen.findByRole("link", { name: "Start portfolio" })).toHaveAttribute("href", "/dashboard?edit=1");
    unmount();

    getPilotAccessState.mockResolvedValueOnce({ ok: false, unauthenticated: true, state: null, failure: null });
    startAuthentication.mockResolvedValueOnce({ ok: true, body: { url: "https://accounts.google.test" } });
    render(<PilotAccessClient />);
    await userEvent.click(await screen.findByRole("button", { name: "Verify with Google" }));
    await waitFor(() => expect(continueToAuthProvider).toHaveBeenCalledWith("https://accounts.google.test"));
  });

  it("keeps the form recoverable when verification or consent is missing", async () => {
    getPilotAccessState.mockResolvedValueOnce({ ok: false, unauthenticated: true, state: null, failure: null });
    startAuthentication.mockResolvedValueOnce({ ok: false, body: { error: "Email delivery paused." } });
    const user = userEvent.setup();
    render(<PilotAccessClient />);
    await user.type(await screen.findByLabelText("Email address"), "a@example.com");
    await user.click(screen.getByRole("button", { name: /verify email/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email delivery paused.");
  });

  it("keeps Google verification recoverable when the provider cannot start", async () => {
    getPilotAccessState.mockResolvedValueOnce({ ok: false, unauthenticated: true, state: null, failure: null });
    startAuthentication.mockResolvedValueOnce({ ok: false, body: { error: "Google is unavailable." } });
    render(<PilotAccessClient />);
    await userEvent.click(await screen.findByRole("button", { name: "Verify with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Google is unavailable.");
  });

  it("requires explicit contact consent after an authenticated return", async () => {
    getPilotAccessState.mockResolvedValueOnce({
      ok: true,
      unauthenticated: false,
      state: { canCreatePortfolio: false, isPilotAdministrator: false, application: null },
      failure: null,
    });
    const user = userEvent.setup();
    render(<PilotAccessClient />);
    await user.type(await screen.findByLabelText("Your name"), "Aditi Rao");
    fireEvent.submit(screen.getByRole("button", { name: "Join the waitlist" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/confirm that we may contact/i);
    expect(submitPilotAccess).not.toHaveBeenCalled();
  });

  it("keeps legacy non-approved entries non-entitled", async () => {
    getPilotAccessState.mockResolvedValueOnce({
      ok: true,
      unauthenticated: false,
      state: {
        canCreatePortfolio: false,
        isPilotAdministrator: false,
        application: { requestRef: `par_${"d".repeat(32)}`, status: "declined", submittedAt: "2026-09-12T12:00:00Z", reviewedAt: "2026-09-12T13:00:00Z" },
      },
      failure: null,
    });
    const first = render(<PilotAccessClient />);
    expect(await screen.findByRole("heading", { name: /not available/i })).toBeInTheDocument();
    first.unmount();
    getPilotAccessState.mockResolvedValueOnce({
      ok: true,
      unauthenticated: false,
      state: {
        canCreatePortfolio: false,
        isPilotAdministrator: false,
        application: { requestRef: `par_${"e".repeat(32)}`, status: "revoked", submittedAt: "2026-09-12T12:00:00Z", reviewedAt: "2026-09-12T13:00:00Z" },
      },
      failure: null,
    });
    render(<PilotAccessClient />);
    expect(await screen.findByRole("heading", { name: /no longer active/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start portfolio" })).not.toBeInTheDocument();
  });
});
