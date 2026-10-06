// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startSelf = vi.hoisted(() => vi.fn());
const createInvitation = vi.hoisted(() => vi.fn());
const current = vi.hoisted(() => vi.fn());
const resume = vi.hoisted(() => vi.fn());
const cancel = vi.hoisted(() => vi.fn());
vi.mock("@/features/identity-verification/client/identity-verification.api", () => ({
  startSelfIdentityVerificationRequest: startSelf,
  createIdentityVerificationInvitationRequest: createInvitation,
  getCurrentCandidateVerificationRequest: current,
  resumeCandidateVerificationRequest: resume,
  cancelCandidateVerificationRequest: cancel,
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

  it("recovers an existing session after mounting without starting another check", async () => {
    current.mockResolvedValue({ ok: true, data: { state: "active", attemptId: "attempt", deadline: "2099-10-06T01:00:00Z", cleanupPending: false, canStart: false, canResume: true, canCancel: true } });
    const user = userEvent.setup();
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await user.click(await screen.findByRole("button", { name: "Resume check" }));
    expect(resume).toHaveBeenCalledWith("candidate-id", "attempt");
    expect(startSelf).not.toHaveBeenCalled();
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
    expect(screen.getByRole("link", { name: "verification-management link" })).toHaveAttribute("href", "https://nakshatra.test/verify/manage");
  });

  it("does not offer delegated candidate invitations in the pilot", () => {
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    expect(screen.queryByRole("button", { name: "Create candidate invitation" })).not.toBeInTheDocument();
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
