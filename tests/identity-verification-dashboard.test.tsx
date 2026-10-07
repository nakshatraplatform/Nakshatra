// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startSelf = vi.hoisted(() => vi.fn());
const createInvitation = vi.hoisted(() => vi.fn());
const current = vi.hoisted(() => vi.fn());
const resume = vi.hoisted(() => vi.fn());
const cancel = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/features/identity-verification/client/identity-verification.api", () => ({
  startSelfIdentityVerificationRequest: startSelf,
  createIdentityVerificationInvitationRequest: createInvitation,
  getCurrentCandidateVerificationRequest: current,
  resumeCandidateVerificationRequest: resume,
  cancelCandidateVerificationRequest: cancel,
  navigateToDiditVerification: navigate,
}));

import { IdentityVerificationDashboard } from "@/features/identity-verification/client/identity-verification-dashboard";

describe("identity-verification dashboard controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    current.mockResolvedValue({ ok: true, data: { state: "not_started", attemptId: null, deadline: null, cleanupPending: false, canStart: true, canResume: false, canCancel: false } });
    resume.mockResolvedValue({ ok: true, data: { url: "https://verify.didit.me/session/existing" } });
    startSelf.mockResolvedValue({ ok: true, data: { attemptId: "attempt", url: "https://verify.didit.me/session/opaque", managementUrl: "https://nakshatra.test/verify/manage" } });
    createInvitation.mockResolvedValue({ ok: true, data: { invitationUrl: "https://nakshatra.test/verify/invite", expiresAt: "2026-09-01T00:00:00.000Z" } });
  });

  afterEach(() => vi.useRealTimers());

  it.each(["active", "cancelled", "expired", "replacement"])("recovers an attached Start after a status outage without another creation (%s)", async outcome => {
    const user = userEvent.setup();
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await user.click(screen.getByRole("checkbox"));
    current.mockResolvedValue({ ok: false, code: "NETWORK_UNAVAILABLE", message: "Status unavailable", status: 0 });
    await user.click(screen.getByRole("button", { name: "Start liveness check" }));

    expect(await screen.findByText(/Your check was created/)).toBeInTheDocument();
    expect(screen.queryByText("Ready to start a new liveness check.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start liveness check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue to Didit verification" })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    const resumable = outcome === "active" || outcome === "replacement";
    current.mockResolvedValue({ ok: true, data: { state: resumable ? "active" : outcome,
      attemptId: outcome === "replacement" ? "replacement-attempt" : "attempt", deadline: "2099-10-06T01:00:00Z",
      cleanupPending: !resumable, canStart: false, canResume: resumable, canCancel: resumable } });
    await user.click(screen.getByRole("button", { name: "Refresh check status" }));
    await waitFor(() => expect(screen.queryByText(/Your check was created/)).not.toBeInTheDocument());
    expect(screen.queryByText("Status unavailable")).not.toBeInTheDocument();
    if (outcome === "active") {
      expect(screen.getByRole("link", { name: "Continue to Didit verification" })).toHaveAttribute("href", "https://verify.didit.me/session/opaque");
      expect(screen.getByRole("link", { name: "verification-management link" })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole("link", { name: "Continue to Didit verification" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "verification-management link" })).not.toBeInTheDocument();
    }
    expect(startSelf).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("polls status after an attached Start outage, pauses while hidden and stops at a terminal state", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(screen.getByRole("checkbox"));
    current.mockResolvedValue({ ok: false, code: "NETWORK_UNAVAILABLE", message: "Status unavailable", status: 0 });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start liveness check" })); });
    expect(screen.getByText(/Your check was created/)).toBeInTheDocument();
    const requests = current.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(current).toHaveBeenCalledTimes(requests);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(current).toHaveBeenCalledTimes(requests + 1);
    current.mockResolvedValue({ ok: true, data: { state: "cancelled", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: true, canResume: false, canCancel: false } });
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    const terminalRequests = current.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(current).toHaveBeenCalledTimes(terminalRequests);
    expect(screen.getByRole("button", { name: "Start liveness check" })).toBeDisabled();
    expect(startSelf).toHaveBeenCalledTimes(1);
  });

  it("recovers an existing session after mounting without starting another check", async () => {
    current.mockResolvedValue({ ok: true, data: { state: "active", attemptId: "attempt", deadline: "2099-10-06T01:00:00Z", cleanupPending: false, canStart: false, canResume: true, canCancel: true } });
    const user = userEvent.setup();
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await user.click(await screen.findByRole("button", { name: "Resume check" }));
    expect(resume).toHaveBeenCalledWith("candidate-id", "attempt");
    expect(startSelf).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("https://verify.didit.me/session/existing");
    expect(await screen.findByRole("link", { name: "Continue to Didit verification" })).toHaveAttribute("href", "https://verify.didit.me/session/existing");
  });

  it("refreshes a previously idle tab after another tab starts a check", async () => {
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start liveness check" })).toBeDisabled());
    await waitFor(() => expect(current).toHaveBeenCalled());
    current.mockResolvedValue({ ok: true, data: { state: "active", attemptId: "attempt", deadline: "2099-10-06T01:00:00Z", cleanupPending: false, canStart: false, canResume: true, canCancel: true } });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByRole("button", { name: "Resume check" })).toBeInTheDocument();
    expect(startSelf).not.toHaveBeenCalled();
  });

  it.each(["IDENTITY_VERIFICATION_PROVIDER_TIMEOUT", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID", "IDENTITY_VERIFICATION_STATE_CONFLICT"])("retains only eligible fallback links after %s and never automatically creates", async code => {
    current.mockResolvedValue({ ok: true, data: { state: "active", attemptId: "attempt", deadline: "2099-10-06T01:00:00Z", cleanupPending: false, canStart: false, canResume: true, canCancel: true } });
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await userEvent.click(await screen.findByRole("button", { name: "Resume check" }));
    expect(await screen.findByRole("link", { name: "Continue to Didit verification" })).toBeInTheDocument();
    resume.mockResolvedValue({ ok: false, code, message: "Retry recovery", status: code.endsWith("CONFLICT") ? 409 : 503 });
    await userEvent.click(screen.getByRole("button", { name: "Resume check" }));
    expect(await screen.findByText("Retry recovery")).toBeInTheDocument();
    if (code.endsWith("CONTRACT_INVALID")) expect(screen.queryByRole("link", { name: "Continue to Didit verification" })).not.toBeInTheDocument();
    else expect(screen.getByRole("link", { name: "Continue to Didit verification" })).toBeInTheDocument();
    expect(startSelf).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it.each(["replacement", "awaiting_result"])("invalidates the hosted link after %s", async (transition) => {
    const active = { state: "active", attemptId: "attempt-a", deadline: "2099-10-06T01:00:00Z", cleanupPending: false, canStart: false, canResume: true, canCancel: true };
    current.mockResolvedValue({ ok: true, data: active });
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await userEvent.click(await screen.findByRole("button", { name: "Resume check" }));
    expect(await screen.findByRole("link", { name: "Continue to Didit verification" })).toBeInTheDocument();
    current.mockResolvedValue({ ok: true, data: transition === "replacement"
      ? { ...active, attemptId: "attempt-b", deadline: "2099-10-07T02:00:00Z" }
      : { ...active, state: "awaiting_result", canResume: false } });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Continue to Didit verification" })).not.toBeInTheDocument());
  });

  it("requires consent for self-verification and exposes separate private recovery links", async () => {
    const user = userEvent.setup();
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);

    const self = screen.getByRole("button", { name: "Start liveness check" });
    expect(self).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    current.mockResolvedValue({ ok: true, data: { state: "active", attemptId: "attempt", deadline: "2099-10-06T01:00:00Z", cleanupPending: false, canStart: false, canResume: true, canCancel: true } });
    await user.click(self);
    await waitFor(() => expect(startSelf).toHaveBeenCalledWith("candidate-id"));
    expect(await screen.findByRole("link", { name: "Continue to Didit verification" })).toHaveAttribute("href", "https://verify.didit.me/session/opaque");
    expect(navigate).toHaveBeenCalledWith("https://verify.didit.me/session/opaque");
    expect(screen.getByRole("link", { name: "verification-management link" })).toHaveAttribute("href", "https://nakshatra.test/verify/manage");
  });

  it("does not offer delegated candidate invitations in the pilot", () => {
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    expect(screen.queryByRole("button", { name: "Create candidate invitation" })).not.toBeInTheDocument();
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
