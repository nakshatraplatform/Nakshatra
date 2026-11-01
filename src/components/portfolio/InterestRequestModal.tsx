"use client";

import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { VisitorInterestFields } from "./VisitorInterestFields";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CheckCircle2, LoaderCircle, MessageCircle, ShieldCheck, X } from "lucide-react";
import type { NewViewerInterestInput } from "@/features/interest/server/interest.contract";
import type { ExistingViewerProfile } from "@/features/interest/server/existing-viewer-profile.service";
import type { CelestialAppearance } from "@/features/portfolio/celestial-theme";
import { activateModalLifecycle } from "@/lib/ui/modal-lifecycle";
import { boundedJsonRequest, withRequestDeadline } from "@/lib/api/bounded-json-request";

type ModalStep = "details" | "verify" | "success";
type InterestPayload = {
  portfolioToken: string;
  name: FormDataEntryValue | null;
  profileFor: FormDataEntryValue | null;
  phone: FormDataEntryValue | null;
  email: string;
  country: FormDataEntryValue | null;
  state: FormDataEntryValue | null;
  city: FormDataEntryValue | null;
  countryCode: FormDataEntryValue | null;
  subdivisionCode: FormDataEntryValue | null;
  cityGeonameId: FormDataEntryValue | null;
  postalCode: FormDataEntryValue | null;
  locationSource: FormDataEntryValue | null;
  familyContext: FormDataEntryValue | null;
  message: FormDataEntryValue | null;
  useExistingProfile?: boolean;
  location?: NewViewerInterestInput["location"];
  candidate?: NonNullable<NewViewerInterestInput["candidate"]>;
};

async function guestExchange<T>(body: unknown, signal: AbortSignal): Promise<{ ok: boolean; body: T | null }> {
  try {
    const result = await boundedJsonRequest<T>("/api/interest/guest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal,
    });
    return { ok: result.response.ok, body: result.body };
  } catch {
    return { ok: false, body: null };
  }
}

export function InterestRequestModal({ portfolioToken, profileName, profileSummary, isOwner = false, appearance = "light" }: {
  portfolioToken: string;
  profileName: string;
  profileSummary?: string;
  authenticated: boolean;
  verifiedEmail?: string | null;
  existingViewerProfile?: ExistingViewerProfile | null;
  isOwner?: boolean;
  appearance?: CelestialAppearance;
}) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [step, setStep] = useState<ModalStep>("details");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationAction, setVerificationAction] = useState<"idle" | "verifying" | "sending">("idle");
  const [requestPayload, setRequestPayload] = useState<InterestPayload | null>(null);
  const titleId = useId();
  const verificationErrorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const sessionEmail = null;

  useEffect(() => () => { operation.current?.abort(); }, []);

  function startOperation() {
    const controller = new AbortController();
    operation.current = controller;
    inFlight.current = true;
    setPending(true);
    return controller.signal;
  }

  useEffect(() => {
    if (step === "details" && Object.keys(fieldErrors).length) {
      const first = dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      first?.focus({ preventScroll: true });
      first?.closest('label, [role="group"]')?.scrollIntoView?.({ block: "center" });
    }
  }, [fieldErrors, step]);

  useEffect(() => {
    if (window.location.hash !== "#portfolio-interest") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const resume = window.setTimeout(() => {
      setStep("details");
      setHasOpened(true);
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(resume);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    return activateModalLifecycle(dialog, closeModal, triggerRef.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (step === "verify") codeInputRef.current?.focus();
    else headingRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function closeModal() {
    // Dismissal does not undo a request. Keep the draft and duplicate guard alive.
    setOpen(false);
  }

  async function beginRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const viewerLocation = (prefix = "") => {
      const field = (key: string) => String(formData.get(prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key) || "");
      return { country: field("country"), state: field("state"), city: field("city"), countryCode: field("countryCode"),
        subdivisionCode: field("subdivisionCode"), cityGeonameId: Number(field("cityGeonameId")) || undefined,
        postalCode: field("postalCode"), locationSource: field("locationSource") };
    };
    const enteredEmail = String(formData.get("email") || "").trim().toLowerCase();
    const payload: InterestPayload = {
      portfolioToken,
      name: formData.get("name"),
      profileFor: formData.get("profileFor"),
      phone: formData.get("phone"),
      email: sessionEmail || enteredEmail,
      country: formData.get("country"),
      state: formData.get("state"),
      city: formData.get("city"),
      countryCode: formData.get("countryCode"),
      subdivisionCode: formData.get("subdivisionCode"),
      cityGeonameId: formData.get("cityGeonameId"),
      postalCode: formData.get("postalCode"),
      locationSource: formData.get("locationSource"),
      familyContext: formData.get("familyContext"),
      message: formData.get("message"),
      useExistingProfile: false,
      location: viewerLocation() as NewViewerInterestInput["location"],
      ...(formData.get("profileFor") !== "self" ? { candidate: {
        name: String(formData.get("candidateName") || ""), email: String(formData.get("candidateEmail") || ""), phone: String(formData.get("candidatePhone") || ""), relationship: "",
        ...(formData.has("candidateCountryCode") ? { location: viewerLocation("candidate") as NewViewerInterestInput["location"] } : {}),
      } } : {}),
    };
    setError("");
    setFieldErrors({});
    const signal = startOperation();

    // Load authoring validation only when needed, not on the portfolio's first paint.
    try {
      const { interestSubmissionSchema, interestRequestValidationMessage, interestFieldErrors } = await withRequestDeadline(
        () => import("@/features/interest/server/interest.contract"), signal,
      );
      if (signal.aborted) return;
      const parsed = interestSubmissionSchema.safeParse(payload);
      if (!parsed.success) {
        const errors = interestFieldErrors(parsed.error);
        setFieldErrors(errors);
        setError(interestRequestValidationMessage(parsed.error));
        setPending(false);
        inFlight.current = false;
        return;
      }
      payload.familyContext = parsed.data.familyContext;
      payload.message = parsed.data.message ?? null;
      if (!parsed.data.useExistingProfile) payload.candidate = parsed.data.candidate;
    } catch {
      if (signal.aborted) return;
      setError("We could not check your details. Please try again.");
      setPending(false);
      inFlight.current = false;
      return;
    }
    setRequestPayload(payload);
    setEmail(payload.email);

    const { ok, body } = await guestExchange<{ sent?: boolean; challengeId?: string; error?: string }>(
      { action: "start", details: payload }, signal);
    if (signal.aborted) return;
    if (!ok || !body?.sent || !body.challengeId) {
      setError(body?.error || "We could not send the verification code. Please try again.");
      setPending(false);
      inFlight.current = false;
      return;
    }
    setChallengeId(body.challengeId);
    setOtp("");
    setVerificationNotice("");
    setResendSeconds(60);
    setStep("verify");
    setPending(false);
    inFlight.current = false;
  }

  async function verifyAndSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (!requestPayload || !challengeId) return setStep("details");
    const signal = startOperation();
    setVerificationAction("verifying");
    setError("");
    const { ok, body } = await guestExchange<{ submitted?: boolean; error?: string }>(
      { action: "complete", challengeId, email, code: otp }, signal);
    if (signal.aborted) return;
    if (!ok || !body?.submitted) {
      setError(body?.error || "That code is incorrect or has expired.");
      setOtp("");
      setPending(false);
      inFlight.current = false;
      setVerificationAction("idle");
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
      return;
    }
    setSubmitted(true);
    setStep("success");
    setRequestPayload(null);
    setChallengeId(null);
    setOtp("");
    setPending(false);
    inFlight.current = false;
    setVerificationAction("idle");
  }

  async function resendCode() {
    if (resendSeconds > 0 || inFlight.current) return;
    if (!requestPayload) { setStep("details"); return; }
    const signal = startOperation();
    setError("");
    const { ok, body } = await guestExchange<{ sent?: boolean; challengeId?: string; error?: string }>(
      { action: "start", details: requestPayload }, signal);
    if (signal.aborted) return;
    if (!ok || !body?.sent || !body.challengeId) setError(body?.error || "We could not send another code.");
    else {
      setChallengeId(body.challengeId);
      setOtp("");
      setVerificationNotice("A new code was sent. Only the newest code will work; earlier codes are now invalid.");
      setResendSeconds(60);
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
    }
    setPending(false);
    inFlight.current = false;
  }

  function openModal() {
    if (isOwner) return;
    setHasOpened(true);
    setOpen(true);
  }

  return (
    <>
      {submitted ? (
        <div className="interest-sent" role="status"><CheckCircle2 aria-hidden="true" /><span><strong>Interest sent.</strong> The family may email you the contact details they choose to share.</span></div>
      ) : isOwner ? (
        <div className="interest-owner-action">
          <button type="button" className="portfolio-button portfolio-button-primary" disabled aria-describedby="own-portfolio-interest-note"><MessageCircle aria-hidden="true" /> Show interest</button>
          <span id="own-portfolio-interest-note">This is your introduction.</span>
        </div>
      ) : (
        <button ref={triggerRef} type="button" className="portfolio-button portfolio-button-primary" onClick={openModal}><MessageCircle aria-hidden="true" /> Show interest</button>
      )}

      {hasOpened && createPortal(
        <div className="interest-modal-backdrop" hidden={!open} data-appearance={appearance}>
          <div ref={dialogRef} tabIndex={-1} className="interest-modal" data-step={step} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <aside className="interest-context" aria-label="About this introduction">
              <VivIntroBrand href="/" openInNewTab variant="stacked" tone={appearance === "dark" ? "reverse" : "primary"} displayWidth={112} />
              <div className="interest-context-profile">
                <p className="portfolio-eyebrow">A thoughtful introduction</p>
                <h3>{profileName}</h3>
                {profileSummary && <p>{profileSummary}</p>}
              </div>
              <div className="interest-context-steps">
                <h3>Next steps</h3>
                <ol>
                  <li>Introduce yourself and your family.</li>
                  <li>Verify your email before sending.</li>
                  <li>{firstName(profileName)} reviews your interest.</li>
                </ol>
              </div>
              <p className="interest-context-privacy"><ShieldCheck aria-hidden="true" />This does not create an account or give you access to private details.</p>
            </aside>
            <div className="interest-main-pane">
            <div className="interest-brand-lockup"><VivIntroBrand href="/" openInNewTab className="interest-brand" variant="stacked" tone={appearance === "dark" ? "reverse" : "primary"} displayWidth={112} /></div>
            <div className="interest-modal-header">
              <div>
                <p className="portfolio-eyebrow">Show interest</p>
                <h2 ref={headingRef} tabIndex={-1} id={titleId}>{step === "verify" ? "Verify your email" : step === "success" ? "Interest sent" : `Introduce yourself to ${firstName(profileName)}'s family`}</h2>
                <p>{step === "verify" ? "Enter the six-digit code we sent. Your interest will be submitted after verification." : step === "success" ? `${firstName(profileName)} can now review your interest.` : "A few details help the family understand who is getting in touch. No account is needed."}</p>
              </div>
              <button type="button" className="interest-modal-close" onClick={closeModal} aria-label="Close interest form"><X aria-hidden="true" /></button>
            </div>

            {pending && <p className="interest-verification-help interest-pending-note">You can close this window. Your request may still finish; reopening will keep your progress. We stop waiting after 20 seconds per request.</p>}

            {/* Retain unsent answers only in this page session, including close/reopen and verification back. */}
            {(step === "details" || step === "verify") && <DetailsForm hidden={step !== "details"} draft={requestPayload} portfolioToken={portfolioToken} sessionEmail={sessionEmail} pending={pending} error={error} fieldErrors={fieldErrors} onSubmit={beginRequest} />}

            {step === "verify" && (
              <form className="interest-verification" onSubmit={verifyAndSend}>
                <div className="interest-verification-icon"><ShieldCheck aria-hidden="true" /></div>
                <p>Code sent to</p><strong>{email}</strong>
                <p className="interest-verification-help">Delivery can take a few minutes. Keep this window open. Requesting another code makes the earlier code stop working.</p>
                <label className="interest-code-field" htmlFor="interest-code">
                  <span>Six-digit code</span>
                  <input ref={codeInputRef} id="interest-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); if (error) setError(""); }} required autoFocus aria-invalid={Boolean(error)} aria-describedby={error ? verificationErrorId : undefined} />
                </label>
                {error && <p id={verificationErrorId} className="interest-form-error" role="alert">{error}</p>}
                {verificationNotice && !error && <p className="interest-verification-notice" role="status">{verificationNotice}</p>}
                <button type="submit" className="portfolio-button portfolio-button-primary" disabled={pending || otp.length !== 6} aria-busy={pending} aria-label={pending ? verificationAction === "sending" ? "Sending interest" : "Verifying email" : undefined}>{pending ? <InterestActionProgress label={verificationAction === "sending" ? "Sending interest" : "Verifying email"} /> : "Verify email"}</button>
                <button type="button" className="interest-secondary-action" onClick={() => void resendCode()} disabled={pending || resendSeconds > 0}>{resendSeconds > 0 ? `Send another code in ${resendSeconds}s` : "Send another code"}</button>
                <button type="button" className="interest-secondary-action" onClick={() => { setError(""); setStep("details"); }} disabled={pending}><ArrowLeft aria-hidden="true" /> Change details</button>
              </form>
            )}

            {step === "success" && (
              <div className="interest-success" role="status">
                <CheckCircle2 aria-hidden="true" />
                <h3>Interest sent to {firstName(profileName)}.</h3>
                <p>{firstName(profileName)} can review your interest and may email you their chosen contact details. This does not open private profile details.</p>
                <button type="button" className="portfolio-button portfolio-button-primary" onClick={closeModal}>Return to introduction</button>
              </div>
            )}
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}

function DetailsForm({ hidden, draft, portfolioToken, sessionEmail, pending, error, fieldErrors, onSubmit }: {
  hidden: boolean;
  draft: InterestPayload | null;
  portfolioToken: string;
  sessionEmail: string | null;
  pending: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} hidden={hidden} className="interest-form" noValidate>
      <div className="interest-form-scroll">
        <VisitorInterestFields draft={draft ? { name: fieldValue(draft.name), phone: fieldValue(draft.phone), email: draft.email, profileFor: fieldValue(draft.profileFor) as NewViewerInterestInput["profileFor"], familyContext: fieldValue(draft.familyContext), message: fieldValue(draft.message), location: draft.location, candidate: draft.candidate } : null} sessionEmail={sessionEmail} errors={fieldErrors} portfolioToken={draft?.portfolioToken || portfolioToken} />
        <p className="interest-verification-help">Your answers stay here while this page is open. Next, confirm your email to send your interest.</p>
        {error && <p className="interest-form-error" role="alert">{error}</p>}
        <details className="interest-sharing-info"><summary>How your details are shared</summary><p>Your phone is contact information only. We verify your email before sending.</p><p>Showing interest shares these details with the person you’re contacting. If they approve, we email only their chosen contact details to you. Read the <a href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</p></details>
      </div>
      <div className="interest-form-footer">
        <button type="submit" className="portfolio-button portfolio-button-primary" disabled={pending} aria-busy={pending} aria-label={pending ? "Sending verification code" : undefined}>{pending ? <InterestActionProgress label="Sending verification code" /> : "Verify email and continue"}</button>
      </div>
    </form>
  );
}

function InterestActionProgress({ label }: { label: string }) {
  return <span className="interest-action-progress" role="status"><LoaderCircle aria-hidden="true" /><span className="sr-only">{label}</span></span>;
}

function fieldValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value : "";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "the introduction owner";
}
