"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cancelCandidateVerificationRequest, getCurrentCandidateVerificationRequest, navigateToDiditVerification, resumeCandidateVerificationRequest, startSelfIdentityVerificationRequest, type IdentityVerificationApiFailure } from "./identity-verification.api";
import type { CandidateRecovery } from "../candidate-recovery.types";

type PendingAction = "self" | "resume" | "cancel" | null;

/** Provides explicit consent for a candidate verifying their own portfolio. */
export function IdentityVerificationDashboard({ candidateId }: { candidateId: string }) {
  return <CandidateRecoveryControls key={candidateId} candidateId={candidateId} />;
}

function CandidateRecoveryControls({ candidateId }: { candidateId: string }) {
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [providerLink, setProviderLink] = useState<{ attemptId: string; url: string } | null>(null);
  const [managementLink, setManagementLink] = useState<{ attemptId: string; url: string } | null>(null);
  const [current, setCurrent] = useState<CandidateRecovery | null>(null);
  const [awaitingStartStatus, setAwaitingStartStatus] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownScope, setCooldownScope] = useState<"creation" | "interaction">("creation");
  const [now, setNow] = useState(0);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (busy.current || (cooldownScope === "interaction" && Date.now() < cooldownUntil)) return;
    const version = ++requestVersion.current;
    const result = await getCurrentCandidateVerificationRequest(candidateId, signal);
    if (signal?.aborted || version !== requestVersion.current) return;
    if (result.ok) {
      setCurrent(result.data);
      setAwaitingStartStatus(false);
      setStatusError(null);
      setProviderLink(link => result.data.canResume && link?.attemptId === result.data.attemptId ? link : null);
      setManagementLink(link => link?.attemptId === result.data.attemptId ? link : null);
      if (["verified", "failed", "declined", "expired", "cancelled", "cleanup_pending"].includes(result.data.state)) {
        setConsent(false); setManagementLink(null);
      }
      return result.data;
    } else {
      setStatusError(result.message);
      if (result.retryAfter) { const timestamp = Date.now(); setNow(timestamp); setCooldownUntil(timestamp + result.retryAfter * 1000); setCooldownScope(result.retryScope ?? "interaction"); }
    }
  }, [candidateId, cooldownScope, cooldownUntil]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void refresh(controller.signal), 0);
    const update = () => { if (document.visibilityState === "visible") void refresh(controller.signal); };
    document.addEventListener("visibilitychange", update);
    return () => { clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);

  const unfinished = awaitingStartStatus || (current && (["creating", "active", "awaiting_result", "cleanup_pending"].includes(current.state) || current.cleanupPending || current.canCancel));
  useEffect(() => {
    if (!unfinished) return;
    const controller = new AbortController();
    const update = () => { if (document.visibilityState === "visible") void refresh(controller.signal); };
    const timer = setInterval(update, 15_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [unfinished, refresh]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  function failure(result: IdentityVerificationApiFailure) {
    setError(result.message);
    if (result.retryAfter) { const timestamp = Date.now(); setNow(timestamp); setCooldownUntil(timestamp + result.retryAfter * 1000); setCooldownScope(result.retryScope ?? "creation"); }
  }

  async function startSelfVerification() {
    if (busy.current || awaitingStartStatus) return;
    busy.current = true; requestVersion.current++;
    setPending("self");
    setError(null);
    setStatusError(null);
    const result = await startSelfIdentityVerificationRequest(candidateId);
    if (!result.ok) {
      failure(result);
    } else {
      // Attachment succeeded; a failed status read must not restore the idle Start UI.
      // Status remains authoritative for exposing links, deadlines and recovery actions.
      setAwaitingStartStatus(true);
      setProviderLink({ attemptId: result.data.attemptId, url: result.data.url });
      setManagementLink({ attemptId: result.data.attemptId, url: result.data.managementUrl });
      setConsent(false);
    }
    busy.current = false;
    setPending(null);
    const refreshed = await refresh();
    if (result.ok && refreshed?.attemptId === result.data.attemptId && refreshed.canResume) navigateToDiditVerification(result.data.url);
  }

  async function recover(action: "resume" | "cancel") {
    if (!current?.attemptId || busy.current) return;
    busy.current = true; requestVersion.current++; setPending(action); setError(null);
    setStatusError(null);
    if (action === "cancel") setProviderLink(null);
    const result = action === "cancel" ? await cancelCandidateVerificationRequest(candidateId, current.attemptId)
      : await resumeCandidateVerificationRequest(candidateId, current.attemptId);
    if (!result.ok) {
      failure(result);
      if (["IDENTITY_VERIFICATION_PROVIDER_SESSION_MISSING", "IDENTITY_VERIFICATION_PROVIDER_CORRELATION_INVALID", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID"].includes(result.code)) setProviderLink(null);
    }
    else if ("url" in result.data && result.data.url) { setProviderLink({ attemptId: current.attemptId, url: result.data.url }); navigateToDiditVerification(result.data.url); }
    else if ("awaitingResult" in result.data) { setProviderLink(null); setCurrent({ ...current, state: "awaiting_result", canResume: false }); }
    else if ("state" in result.data) { setCurrent(result.data); setConsent(false); }
    setConfirmCancel(false); busy.current = false; setPending(null);
    // A provider completion stays in awaiting-result UI until background polling.
    if (!result.ok || action === "cancel") await refresh();
  }

  const statusText = awaitingStartStatus
    ? "Your check was created. We are confirming its current status before opening Didit. Refresh check status to continue; do not start another check."
    : current ? {
    not_started: "Ready to start a new liveness check.",
    creating: "Your check is being prepared. Do not start another check; you can cancel this attempt if needed.",
    active: "An unfinished check is available. Resume where you left off or cancel it before starting again.",
    awaiting_result: "We are checking the final result. You cannot reopen this check now.",
    cleanup_pending: "Your previous check is being cleaned up. A new check will be available after cleanup finishes.",
    failed: "The previous check could not finish. Start again with fresh consent when cleanup is complete.",
    declined: "The previous check did not pass. You can start again after cleanup with fresh consent.",
    expired: "The check has expired. A new check requires cleanup and fresh consent.",
    cancelled: "You cancelled this check. It cannot verify your profile.",
    verified: "Your liveness check is complete.",
  }[current.state] : "Loading your liveness check…";

  return (
    <section className="dashboard-glass p-5" aria-labelledby="identity-verification-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="identity-verification-heading" tabIndex={-1}>Liveness check</h2>
          <p>Verification is required before this profile can be publicly published.</p>
        </div>
      </div>
      <p className="text-sm text-[light-dark(#475569,var(--app-dark-muted))]">
        Didit checks that a live person is present. No ID document or portfolio-photo comparison is required. VivIntro stores your consent and check results, not camera evidence. This does not verify your identity or profile details.
      </p>
      <p className="dashboard-action-note mt-4" role="status">{statusText}</p>
      {current?.deadline && current.canResume ? <p className="dashboard-action-note">Resume before <time dateTime={current.deadline}>{new Date(current.deadline).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>. The 30-minute window does not reset.</p> : null}
      {!awaitingStartStatus && (current?.canStart || !current) ? <label className="mt-4 flex gap-3 text-sm text-[light-dark(#334155,var(--app-dark-ink))]">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I consent to Didit processing my live camera capture for liveness checks.</span>
      </label> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {!awaitingStartStatus && (current?.canStart || !current) ? <button type="button" className="dashboard-primary-action" disabled={!current?.canStart || !consent || pending !== null || cooldown > 0} onClick={() => void startSelfVerification()}>
          {pending === "self" ? "Starting liveness check…" : "Start liveness check"}
        </button> : null}
        {current?.canResume ? <button type="button" className="dashboard-primary-action" disabled={pending !== null || (cooldownScope === "interaction" && cooldown > 0)} onClick={() => void recover("resume")}>{pending === "resume" ? "Reopening check…" : "Resume check"}</button> : null}
        {current?.canCancel ? <button type="button" className="dashboard-secondary-action" disabled={pending !== null || (cooldownScope === "interaction" && cooldown > 0)} onClick={() => setConfirmCancel(true)}>Cancel check</button> : null}
      </div>
      {confirmCancel ? <fieldset className="mt-4" disabled={pending !== null || (cooldownScope === "interaction" && cooldown > 0)}>
        <legend>Cancel this check?</legend>
        <p className="dashboard-action-note">This attempt will no longer verify your profile. Wait for cleanup, then give fresh consent to start another check. An already-open Didit page may remain visible.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="dashboard-primary-action" onClick={() => void recover("cancel")}>{pending === "cancel" ? "Cancelling…" : "Confirm cancellation"}</button>
          <button type="button" className="dashboard-secondary-action" onClick={() => setConfirmCancel(false)}>Keep current check</button>
        </div>
      </fieldset> : null}
      <div className="mt-4" aria-live="polite" aria-atomic="true">
        {error || statusError ? <p className="dashboard-action-error" role="alert">{error || statusError}</p> : null}
        {cooldown > 0 ? <p className="dashboard-action-note">{cooldownScope === "creation" ? "New-check" : "Recovery"} cooldown: {Math.ceil(cooldown / 60)} minute(s). {cooldownScope === "creation" ? "You can still recover an existing check." : "Wait before checking status, resuming or cancelling."}</p> : null}
        {(error || statusError || awaitingStartStatus) && !pending ? <button type="button" className="dashboard-secondary-action" onClick={() => void refresh()}>Refresh check status</button> : null}
        {managementLink && managementLink.attemptId === current?.attemptId ? <p className="dashboard-action-note">Save your private <a href={managementLink.url}>verification-management link</a>.</p> : null}
        {providerLink && providerLink.attemptId === current?.attemptId && current.canResume ? <a className="dashboard-primary-action mt-3" href={providerLink.url}>Continue to Didit verification</a> : null}
      </div>
    </section>
  );
}
