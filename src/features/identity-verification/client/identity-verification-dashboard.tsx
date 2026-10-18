"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { cancelCandidateVerificationRequest, checkCandidateResultRequest, getCurrentCandidateVerificationRequest, navigateToDiditVerification, resumeCandidateVerificationRequest, startSelfIdentityVerificationRequest, type IdentityVerificationApiFailure } from "./identity-verification.api";
import type { CandidateRecovery } from "../candidate-recovery.types";
import { LivenessCompletionDialog, LivenessEmailFeedback } from "./liveness-completion-dialog";

type PendingAction = "self" | "resume" | "cancel" | "result" | null;

/** Provides explicit consent for a candidate verifying their own portfolio. */
type RecoveryProps = { candidateId: string; onStatusChange?: (state: CandidateRecovery["state"]) => void; checkResultOnLoad?: boolean; hideWhenVerified?: boolean; initiallyVerified?: boolean };
export function IdentityVerificationDashboard(props: RecoveryProps) {
  return <CandidateRecoveryControls key={props.candidateId} {...props} />;
}

function CandidateRecoveryControls({ candidateId, onStatusChange, checkResultOnLoad = false, hideWhenVerified = false, initiallyVerified = false }: RecoveryProps) {
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [statusLoading, setStatusLoading] = useState(true);
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
  const pendingHandoff = useRef<{ attemptId: string; url: string } | null>(null);
  const snapshot = useRef<CandidateRecovery | null>(null);
  const mounted = useRef(true);
  const announced = useRef(new Set<string>());
  const [completionAttempt, setCompletionAttempt] = useState<string | null>(null);
  const emailDispatchRequested = useRef(new Set<string>());
  const automaticChecks = useRef({ attemptId: "", count: 0, startedAt: 0, lastStartedAt: 0 });
  const [resultRevision, setResultRevision] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pendingHandoff.current = null; };
  }, []);
  const acceptCurrent = useCallback((next: CandidateRecovery) => {
    const previous = snapshot.current;
    snapshot.current = next;
    setCurrent(next);
    if (next.state === "verified") setError(null);
    if (next.state !== "verified" || !next.attemptId
      || (!checkResultOnLoad && (!previous || previous.state === "verified"))) return;
    const key = "vivintro:liveness-complete:" + candidateId + ":" + next.attemptId;
    if (announced.current.has(key)) return;
    announced.current.add(key);
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "shown");
    } catch { /* The mounted controller still prevents repeats when storage is unavailable. */ }
    setCompletionAttempt(next.attemptId);
  }, [candidateId, checkResultOnLoad]);
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const currentState = current?.state;
  useEffect(() => {
    if (currentState) onStatusChange?.(currentState);
  }, [currentState, onStatusChange]);

  const refresh = useCallback(async (signal?: AbortSignal, showFeedback = true) => {
    if (busy.current || (cooldownScope === "interaction" && Date.now() < cooldownUntil)) return;
    const version = ++requestVersion.current;
    // Quiet background reads must not replace an unchanged live status every
    // fifteen seconds. Initial and explicitly requested reads retain feedback.
    if (showFeedback || !snapshot.current) setStatusLoading(true);
    try {
      const result = await getCurrentCandidateVerificationRequest(candidateId, signal);
      if (signal?.aborted || version !== requestVersion.current) return;
      if (result.ok) {
        acceptCurrent(result.data);
        setAwaitingStartStatus(false);
        setStatusError(null);
        setProviderLink(link => result.data.canResume && link?.attemptId === result.data.attemptId ? link : null);
        setManagementLink(link => link?.attemptId === result.data.attemptId ? link : null);
        if (["verified", "failed", "declined", "expired", "cancelled", "cleanup_pending"].includes(result.data.state)) {
          setConsent(false); setManagementLink(null);
        }
        const handoff = pendingHandoff.current;
        if (handoff) {
          if (result.data.attemptId !== handoff.attemptId || result.data.cleanupPending
            || !["creating", "active"].includes(result.data.state)) pendingHandoff.current = null;
          else if (result.data.canResume) {
            pendingHandoff.current = null;
            setProviderLink(handoff);
            navigateToDiditVerification(handoff.url);
          }
        }
        return result.data;
      } else {
        setStatusError(result.message);
        if (result.retryAfter) { const timestamp = Date.now(); setNow(timestamp); setCooldownUntil(timestamp + result.retryAfter * 1000); setCooldownScope(result.retryScope ?? "interaction"); }
      }
    } finally {
      // An older or cancelled read must not clear the newer read's feedback.
      if (!signal?.aborted && version === requestVersion.current) setStatusLoading(false);
    }
  }, [candidateId, cooldownScope, cooldownUntil, acceptCurrent]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void refresh(controller.signal), 0);
    const update = () => { if (document.visibilityState === "visible") void refresh(controller.signal, false); };
    document.addEventListener("visibilitychange", update);
    return () => { clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);

  const unfinished = awaitingStartStatus || (current && (["creating", "active", "awaiting_result", "cleanup_pending"].includes(current.state) || current.cleanupPending || current.canCancel
    || (current.state === "verified" && ["queued", "processing"].includes(current.emailStatus ?? ""))));
  useEffect(() => {
    if (!unfinished) return;
    const controller = new AbortController();
    const update = () => { if (document.visibilityState === "visible") void refresh(controller.signal, false); };
    const timer = setInterval(update, 15_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [unfinished, refresh]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const failure = useCallback((result: IdentityVerificationApiFailure) => {
    setError(result.message);
    if (result.retryAfter) { const timestamp = Date.now(); setNow(timestamp); setCooldownUntil(timestamp + result.retryAfter * 1000); setCooldownScope(result.retryScope ?? "creation"); }
  }, []);

  async function startSelfVerification() {
    if (busy.current || awaitingStartStatus) return;
    busy.current = true; requestVersion.current++;
    setStatusLoading(false);
    setPending("self");
    setError(null);
    setStatusError(null);
    const result = await startSelfIdentityVerificationRequest(candidateId);
    if (!mounted.current) return;
    if (!result.ok) {
      failure(result);
    } else {
      // Attachment succeeded; a failed status read must not restore the idle Start UI.
      // Status remains authoritative for exposing links, deadlines and recovery actions.
      setAwaitingStartStatus(true);
      setProviderLink({ attemptId: result.data.attemptId, url: result.data.url });
      pendingHandoff.current = { attemptId: result.data.attemptId, url: result.data.url };
      setManagementLink({ attemptId: result.data.attemptId, url: result.data.managementUrl });
      setConsent(false);
    }
    busy.current = false;
    setPending(null);
    await refresh();
  }

  const recover = useCallback(async (action: "resume" | "cancel" | "result") => {
    if (!current?.attemptId || busy.current) return;
    busy.current = true; requestVersion.current++; setPending(action); setError(null);
    setStatusLoading(false);
    setStatusError(null);
    if (action === "cancel" || action === "resume") pendingHandoff.current = null;
    if (action === "cancel") setProviderLink(null);
    const result = action === "cancel" ? await cancelCandidateVerificationRequest(candidateId, current.attemptId)
      : action === "result" ? await checkCandidateResultRequest(candidateId, current.attemptId)
      : await resumeCandidateVerificationRequest(candidateId, current.attemptId);
    if (!mounted.current) return;
    if (!result.ok) {
      failure(result);
      if (["IDENTITY_VERIFICATION_PROVIDER_SESSION_MISSING", "IDENTITY_VERIFICATION_PROVIDER_CORRELATION_INVALID", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID"].includes(result.code)) setProviderLink(null);
    }
    else if ("url" in result.data && result.data.url) { setProviderLink({ attemptId: current.attemptId, url: result.data.url }); navigateToDiditVerification(result.data.url); }
    else if ("awaitingResult" in result.data) { setProviderLink(null); acceptCurrent({ ...current, state: "awaiting_result", canResume: false }); }
    else if ("state" in result.data) {
      if (action === "result" && result.data.state === "verified" && result.data.emailStatus === "queued") {
        // This response already scheduled the scoped after-response delivery.
        emailDispatchRequested.current.add(current.attemptId);
      }
      acceptCurrent(result.data); setConsent(false);
    }
    setConfirmCancel(false); busy.current = false; setPending(null);
    if (action === "result") setResultRevision(value => value + 1);
    // A provider completion stays in awaiting-result UI until background polling.
    if (!result.ok || action === "cancel") await refresh();
  }, [candidateId, current, failure, refresh, acceptCurrent]);

  useEffect(() => {
    const confirmedEmailPending = current?.state === "verified" && current.emailStatus === "queued";
    if (!checkResultOnLoad || !current?.attemptId || (!["active", "awaiting_result"].includes(current.state) && !confirmedEmailPending)
      || current.processingIssue === "policy_error" || pending !== null) return;
    const attemptId = current.attemptId;
    if (confirmedEmailPending && emailDispatchRequested.current.has(attemptId)) return;
    if (automaticChecks.current.attemptId !== attemptId) {
      automaticChecks.current = { attemptId, count: 0, startedAt: Date.now(), lastStartedAt: 0 };
    }
    const checks = automaticChecks.current;
    const eligibleAt = confirmedEmailPending ? Math.max(Date.now(), cooldownScope === "interaction" ? cooldownUntil : 0) : Math.max(checks.count ? checks.lastStartedAt + 15_000 : Date.now(),
      current.nextRetryAt ? Date.parse(current.nextRetryAt) : 0,
      cooldownScope === "interaction" ? cooldownUntil : 0);
    if (!confirmedEmailPending && (checks.count >= 4 || eligibleAt > checks.startedAt + 120_000)) return;
    const timer = setTimeout(() => {
      if (document.visibilityState !== "visible" || busy.current
        || (!confirmedEmailPending && Date.now() > checks.startedAt + 120_000)
        || (cooldownScope === "interaction" && Date.now() < cooldownUntil)) return;
      if (confirmedEmailPending) emailDispatchRequested.current.add(attemptId);
      else { checks.count++; checks.lastStartedAt = Date.now(); }
      void recover("result");
    }, Math.max(0, eligibleAt - Date.now()));
    return () => clearTimeout(timer);
  }, [checkResultOnLoad, current, pending, cooldownScope, cooldownUntil, recover, resultRevision]);

  const statusText = awaitingStartStatus
    ? "Your check was created. We are confirming its current status before opening Didit. Refresh check status to continue; do not start another check."
    : checkResultOnLoad && current && ["active", "awaiting_result"].includes(current.state)
      ? "We are confirming your liveness result. Once it is confirmed, we will email you. You can return to your dashboard."
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

  // Presentation can disappear; the controller stays mounted for authoritative
  // visibility refresh and polling. A later expiry/outage restores actionable UI.
  if (current?.state === "verified" && current.attemptId === completionAttempt && !error && !statusError) {
    return <LivenessCompletionDialog emailStatus={current.emailStatus} returnPage={checkResultOnLoad}
      onDismiss={() => setCompletionAttempt(null)} />;
  }
  if (hideWhenVerified && !error && !statusError && (current?.state === "verified" || (!current && initiallyVerified))) return null;
  const processing = awaitingStartStatus || current?.state === "creating" || current?.state === "awaiting_result" || current?.state === "cleanup_pending";
  const loadingTitle = pending === "self" ? "Preparing your liveness check"
    : pending === "resume" ? "Reopening your check" : pending === "cancel" ? "Cancelling your check"
    : pending === "result" ? "Checking your final result" : statusLoading ? "Refreshing your liveness status"
    : current?.state === "cleanup_pending" ? "Cleaning up your previous check" : "Waiting for the confirmed liveness result";

  return (
    <section className="dashboard-glass p-5" aria-labelledby="identity-verification-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="identity-verification-heading" tabIndex={-1}>Liveness check</h2>
          <p>Verification is required before this profile can be publicly published.</p>
        </div>
      </div>
      <p className="text-sm text-[var(--workspace-muted)]">
        Didit checks that a live person is present. No ID document or portfolio-photo comparison is required. VivIntro stores your consent and check results, not camera evidence. This does not verify your identity or profile details.
      </p>
      {pending || statusLoading || (processing && !error && !statusError && !current?.processingIssue) ?
        <LoadingStatus compact className="mt-4" state="connecting" title={loadingTitle} detail={statusText} />
        : <p className="dashboard-action-note mt-4" role="status">{statusText}</p>}
      {current?.processingIssue ? <p className="dashboard-action-error" role="alert">{current.processingIssue === "policy_error"
        ? "Didit returned a result that does not match this check's verification policy. Contact support; repeating the camera check will not fix this attempt."
        : current.processingIssue === "delayed" ? "Result processing is delayed. Your result is not confirmed yet. Refresh status or contact support if this continues."
        : "We could not finish processing this check. Recovery will retry automatically; you do not need to run a migration or reset it."}</p> : null}
      {current?.nextRetryAt && current.processingIssue === "retrying" ? <p className="dashboard-action-note">Next processing attempt is eligible after <time dateTime={current.nextRetryAt}>{new Date(current.nextRetryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>. Scheduling can take longer.</p> : null}
      {current?.state === "verified" ? <LivenessEmailFeedback status={current.emailStatus} /> : null}
      {current?.deadline && current.canResume ? <p className="dashboard-action-note">Resume before <time dateTime={current.deadline}>{new Date(current.deadline).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>. The 30-minute window does not reset.</p> : null}
      {!awaitingStartStatus && (current?.canStart || !current) ? <label className="mt-4 flex gap-3 text-sm text-[var(--workspace-ink)]">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I consent to Didit processing my live camera capture for liveness checks.</span>
      </label> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {current && ["active", "awaiting_result"].includes(current.state) ? <button type="button" className="dashboard-secondary-action" disabled={pending !== null || (cooldownScope === "interaction" && cooldown > 0)} onClick={() => void recover("result")}>{pending === "result" ? "Checking result…" : "Check final result"}</button> : null}
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
      <div className="mt-4">
        {error || statusError ? <p className="dashboard-action-error" role="alert">{error || statusError}</p> : null}
        {cooldown > 0 ? <p className="dashboard-action-note" role="status" aria-atomic="true">{cooldownScope === "creation" ? "New-check" : "Recovery"} cooldown: {Math.ceil(cooldown / 60)} minute(s). {cooldownScope === "creation" ? "You can still recover an existing check." : "Wait before checking status, resuming or cancelling."}</p> : null}
        {(error || statusError || unfinished) && !pending ? <button type="button" disabled={statusLoading || (cooldownScope === "interaction" && cooldown > 0)} className="dashboard-secondary-action" onClick={() => void refresh()}>Refresh check status</button> : null}
        {managementLink && managementLink.attemptId === current?.attemptId ? <p className="dashboard-action-note">Save your private <Link href={managementLink.url} prefetch={false}>verification-management link</Link>.</p> : null}
        {providerLink && providerLink.attemptId === current?.attemptId && current.canResume ? <a className="dashboard-primary-action mt-3" href={providerLink.url}>Continue to Didit verification</a> : null}
      </div>
    </section>
  );
}
