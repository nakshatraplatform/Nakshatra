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
const checkResult = vi.hoisted(() => vi.fn());
vi.mock("@/features/identity-verification/client/identity-verification.api", () => ({
  startSelfIdentityVerificationRequest: startSelf,
  createIdentityVerificationInvitationRequest: createInvitation,
  getCurrentCandidateVerificationRequest: current,
  resumeCandidateVerificationRequest: resume,
  cancelCandidateVerificationRequest: cancel,
  navigateToDiditVerification: navigate,
  checkCandidateResultRequest: checkResult,
}));

import { IdentityVerificationDashboard } from "@/features/identity-verification/client/identity-verification-dashboard";

describe("identity-verification dashboard controls", () => {
  it("does not let initially verified presentation suppress a status outage", async () => {
    current.mockResolvedValue({ ok: false, code: "NETWORK_UNAVAILABLE", message: "Status unavailable", status: 0 });
    render(<IdentityVerificationDashboard candidateId="candidate-id" hideWhenVerified initiallyVerified />);
    expect(screen.queryByRole("heading", { name: "Liveness check" })).not.toBeInTheDocument();
    expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start liveness check" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh check status" })).toBeEnabled();
  });
  it("hides completed dashboard UI but continues authoritative refresh and restores expired work", async () => {
    const onStatusChange = vi.fn();
    current.mockResolvedValue({ ok: true, data: { state: "verified", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: false, canCancel: false } });
    // Prop is part of the new presentation contract; existing result screens remain visible.
    render(<IdentityVerificationDashboard candidateId="candidate-id" onStatusChange={onStatusChange} hideWhenVerified />);
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith("verified"));
    expect(screen.queryByRole("heading", { name: "Liveness check" })).not.toBeInTheDocument();
    current.mockResolvedValue({ ok: true, data: { state: "expired", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: true, canResume: false, canCancel: false } });
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByRole("heading", { name: "Liveness check" })).toBeInTheDocument();
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith("expired"));
    expect(startSelf).not.toHaveBeenCalled();
  });
  it("ends initial status feedback on failure and leaves a usable refresh action", async () => {
    let resolve!: (value: { ok: false; code: string; message: string; status: number }) => void;
    current.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing your liveness status");
    await waitFor(() => expect(current).toHaveBeenCalled());
    await act(async () => resolve({ ok: false, code: "NETWORK_UNAVAILABLE", message: "Status unavailable", status: 0 }));
    expect(screen.getByRole("alert")).toHaveTextContent("Status unavailable");
    expect(document.querySelector("[data-loading-status]")).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh check status" })).toBeEnabled();
  });

  it("shows result processing but stops for an actionable processing delay and confirmed email queue", async () => {
    const attempt = { state: "awaiting_result", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: false, canCancel: true };
    current.mockResolvedValueOnce({ ok: true, data: attempt });
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Waiting for the confirmed liveness result"));
    current.mockResolvedValueOnce({ ok: true, data: { ...attempt, processingIssue: "delayed" } });
    await userEvent.click(screen.getByRole("button", { name: "Refresh check status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Result processing is delayed");
    expect(document.querySelector("[data-loading-status]")).toBeNull();
    current.mockResolvedValueOnce({ ok: true, data: { ...attempt, state: "verified", canCancel: false, emailStatus: "queued" } });
    await userEvent.click(screen.getByRole("button", { name: "Refresh check status" }));
    expect(await screen.findByText("Your liveness check is complete.")).toBeInTheDocument();
    expect(document.querySelector("[data-loading-status]")).toBeNull();
    expect(screen.getByText(/you do not need to wait for it to continue/)).toBeInTheDocument();
  });

  it("checks a returning attempt once without resuming or creating another session", async () => {
    const active = { state: "active", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: true, canCancel: true };
    current.mockResolvedValue({ ok: true, data: active });
    checkResult.mockResolvedValue({ ok: true, data: { ...active, state: "verified", canResume: false, canCancel: false, emailStatus: "queued" } });
    render(<IdentityVerificationDashboard candidateId="candidate-id" checkResultOnLoad />);
    expect(await screen.findByText("Your liveness check is complete.")).toBeInTheDocument();
    expect(checkResult).toHaveBeenCalledTimes(1);
    expect(checkResult).toHaveBeenCalledWith("candidate-id", "attempt");
    expect(startSelf).not.toHaveBeenCalled(); expect(resume).not.toHaveBeenCalled();
    expect(screen.getByText(/confirmation email is queued/)).toBeInTheDocument();
  });
  it("announces an authoritative completion and offers status refresh while awaiting the result", async () => {
    const onStatusChange = vi.fn();
    current.mockResolvedValue({ ok: true, data: { state: "awaiting_result", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: false, canCancel: true } });
    render(<IdentityVerificationDashboard candidateId="candidate-id" onStatusChange={onStatusChange} />);
    await userEvent.click(await screen.findByRole("button", { name: "Refresh check status" }));
    current.mockResolvedValue({ ok: true, data: { state: "verified", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: false, canCancel: false } });
    await userEvent.click(screen.getByRole("button", { name: "Refresh check status" }));
    expect(await screen.findByText("Your liveness check is complete.")).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith("verified");
    expect(startSelf).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function () { this.removeAttribute("open"); } });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    current.mockResolvedValue({ ok: true, data: { state: "not_started", attemptId: null, deadline: null, cleanupPending: false, canStart: true, canResume: false, canCancel: false } });
    resume.mockResolvedValue({ ok: true, data: { url: "https://verify.didit.me/session/existing" } });
    startSelf.mockResolvedValue({ ok: true, data: { attemptId: "attempt", url: "https://verify.didit.me/session/opaque", managementUrl: "https://nakshatra.test/verify/manage" } });
    createInvitation.mockResolvedValue({ ok: true, data: { invitationUrl: "https://nakshatra.test/verify/invite", expiresAt: "2026-09-01T00:00:00.000Z" } });
  });

  afterEach(() => vi.useRealTimers());

  it("keeps a new attempt's handoff when a visibility refresh overtakes the start status read", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const user = userEvent.setup();
    render(<IdentityVerificationDashboard candidateId="candidate-id" />);
    await user.click(await screen.findByRole("checkbox"));
    let first!: (value: unknown) => void, latest!: (value: unknown) => void;
    current.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { latest = resolve; }));
    await user.click(screen.getByRole("button", { name: "Start liveness check" }));
    await waitFor(() => expect(first).toBeTypeOf("function"));
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(latest).toBeTypeOf("function"));
    const active = { ok: true, data: { state: "active", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: true, canCancel: true } };
    await act(async () => { first(active); });
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { latest(active); });
    await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith("https://verify.didit.me/session/opaque"));
  });

  it("announces a new authoritative completion before hiding verified dashboard controls", async () => {
    const active = { state: "active", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: true, canCancel: true };
    current.mockResolvedValue({ ok: true, data: active });
    const view = render(<IdentityVerificationDashboard candidateId="candidate-id" hideWhenVerified />);
    await screen.findByRole("button", { name: "Resume check" });
    current.mockResolvedValue({ ok: true, data: { ...active, state: "verified", canResume: false, canCancel: false, emailStatus: "queued" } });
    fireEvent(document, new Event("visibilitychange"));
    const dialog = await screen.findByRole("dialog", { name: "Liveness check complete" });
    expect(dialog).toHaveTextContent(/confirmation email is queued/i);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    const reads = current.mock.calls.length;
    render(<IdentityVerificationDashboard candidateId="candidate-id" checkResultOnLoad hideWhenVerified />);
    await waitFor(() => expect(current.mock.calls.length).toBeGreaterThan(reads));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rechecks a returning pending result boundedly instead of waiting solely for cron", async () => {
    vi.useFakeTimers();
    const active = { state: "awaiting_result", attemptId: "attempt", deadline: null, cleanupPending: false, canStart: false, canResume: false, canCancel: true };
    current.mockResolvedValue({ ok: true, data: active });
    checkResult.mockResolvedValue({ ok: true, data: active });
    render(<IdentityVerificationDashboard candidateId="candidate-id" checkResultOnLoad />);
    await act(() => vi.advanceTimersByTimeAsync(1));
    for (let i = 0; i < 8; i++) await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(checkResult.mock.calls.length).toBeGreaterThan(1);
    expect(checkResult.mock.calls.length).toBeLessThanOrEqual(4);
    const calls = checkResult.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(checkResult).toHaveBeenCalledTimes(calls);
    expect(startSelf).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("dispatches a queued email when background verification finishes after an earlier pending lookup", async () => {
    vi.useFakeTimers();
    const active = { state: "awaiting_result", attemptId: "attempt", deadline: null, cleanupPending: false,
      canStart: false, canResume: false, canCancel: true };
    current.mockResolvedValue({ ok: true, data: active });
    checkResult.mockResolvedValue({ ok: true, data: active });
    render(<IdentityVerificationDashboard candidateId="candidate-id" checkResultOnLoad />);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(checkResult).toHaveBeenCalledOnce();
    const verified = { ...active, state: "verified", canCancel: false, emailStatus: "queued" };
    current.mockResolvedValue({ ok: true, data: verified });
    checkResult.mockResolvedValue({ ok: true, data: verified });
    fireEvent(document, new Event("visibilitychange"));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole("dialog", { name: "Liveness check complete" })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(checkResult).toHaveBeenCalledTimes(2);
    expect(startSelf).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it("honors the worker retry deadline and stops automatic checking for policy errors", async () => {
    vi.useFakeTimers();
    const active = { state: "awaiting_result", attemptId: "attempt", deadline: null, cleanupPending: false,
      canStart: false, canResume: false, canCancel: true, nextRetryAt: new Date(Date.now() + 30_000).toISOString() };
    current.mockResolvedValue({ ok: true, data: active });
    checkResult.mockImplementation(async () => {
      current.mockResolvedValue({ ok: true, data: { ...active, processingIssue: "policy_error" } });
      return { ok: true, data: { ...active, processingIssue: "policy_error" } };
    });
    render(<IdentityVerificationDashboard candidateId="candidate-id" checkResultOnLoad />);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(checkResult).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1_001));
    expect(checkResult).toHaveBeenCalledOnce();
    // The next authoritative reads preserve the actionable policy failure.
    current.mockResolvedValue({ ok: true, data: { ...active, processingIssue: "policy_error" } });
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(checkResult).toHaveBeenCalledOnce();
  });

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
    if (outcome === "active") expect(navigate).toHaveBeenCalledExactlyOnceWith("https://verify.didit.me/session/opaque");
    else expect(navigate).not.toHaveBeenCalled();
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
