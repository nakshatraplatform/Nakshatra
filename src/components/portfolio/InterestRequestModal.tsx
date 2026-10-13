"use client";

import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { VisitorInterestFields } from "./VisitorInterestFields";
import type { InterestLocationDraft } from "./InterestLocationFields";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, CheckCircle2, MailCheck, MessageCircle, ShieldCheck, X } from "lucide-react";
import type { NewViewerInterestInput } from "@/features/interest/server/interest.contract";
import { continueToAuthProvider, startAuthentication, verifyAuthenticationCode } from "@/features/auth/client/auth.api";
import type { ExistingViewerProfile } from "@/features/interest/server/existing-viewer-profile.service";
import type { CelestialAppearance } from "@/features/portfolio/celestial-theme";

type ModalStep = "choice" | "details" | "verify" | "success";
type InterestPayload = {
  portfolioToken: string;
  name: FormDataEntryValue | null;
  profileFor: FormDataEntryValue | null;
  phone: FormDataEntryValue | null;
  email: string;
  country: FormDataEntryValue | null;
  state: FormDataEntryValue | null;
  city: FormDataEntryValue | null;
  familyContext: FormDataEntryValue | null;
  message: FormDataEntryValue | null;
  useExistingProfile?: boolean;
  location?: InterestLocationDraft;
  candidate?: Omit<NonNullable<NewViewerInterestInput["candidate"]>, "location"> & { location: InterestLocationDraft };
};

export function InterestRequestModal({ portfolioToken, profileName, authenticated, verifiedEmail, existingViewerProfile, isOwner = false, appearance = "light" }: {
  portfolioToken: string;
  profileName: string;
  authenticated: boolean;
  verifiedEmail?: string | null;
  existingViewerProfile?: ExistingViewerProfile | null;
  isOwner?: boolean;
  appearance?: CelestialAppearance;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>(authenticated ? "details" : "choice");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [email, setEmail] = useState(verifiedEmail || "");
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationAction, setVerificationAction] = useState<"idle" | "verifying" | "sending">("idle");
  const [requestPayload, setRequestPayload] = useState<InterestPayload | null>(null);
  const titleId = useId();
  const verificationErrorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const portfolioPath = `/p/${encodeURIComponent(portfolioToken)}`;
  const sessionEmail = authenticated ? verifiedEmail?.trim().toLowerCase() || null : null;

  useEffect(() => {
    if (step === "details" && Object.keys(fieldErrors).length) dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fieldErrors, step]);

  useEffect(() => {
    if (!authenticated || window.location.hash !== "#portfolio-interest") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const resume = window.setTimeout(() => {
      setStep("details");
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(resume);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") return setOpen(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function closeModal() {
    if (!pending) setOpen(false);
  }

  async function beginRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const locationValue = (prefix: string) => ({ countryCode: String(formData.get(`${prefix}CountryCode`) || ""), regionCode: String(formData.get(`${prefix}RegionCode`) || ""), cityId: Number(formData.get(`${prefix}CityId`)), cityLabel: String(formData.get(`${prefix}CityLabel`) || "") });
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
      familyContext: formData.get("familyContext"),
      message: formData.get("message"),
      useExistingProfile: Boolean(sessionEmail && existingViewerProfile),
      location: locationValue("viewer"),
      ...(formData.get("profileFor") !== "self" && !existingViewerProfile ? { candidate: {
        name: String(formData.get("candidateName") || ""), email: String(formData.get("candidateEmail") || ""), phone: String(formData.get("candidatePhone") || ""), relationship: String(formData.get("candidateRelationship") || ""), location: locationValue("candidate"),
      } } : {}),
    };
    setError("");
    setFieldErrors({});
    setPending(true);

    // Load authoring validation only when needed, not on the portfolio's first paint.
    try {
      const { interestSubmissionSchema, interestRequestValidationMessage, interestFieldErrors } = await import("@/features/interest/server/interest.contract");
      const parsed = interestSubmissionSchema.safeParse(payload);
      if (!parsed.success) {
        const errors = interestFieldErrors(parsed.error);
        setFieldErrors(errors);
        setError(interestRequestValidationMessage(parsed.error));
        setPending(false);
        return;
      }
    } catch {
      setError("We could not check your details. Please try again.");
      setPending(false);
      return;
    }
    setRequestPayload(payload);
    setEmail(payload.email);

    if (sessionEmail) return void await sendInterest(payload);

    const { ok, body } = await startAuthentication({ method: "email_otp", email: enteredEmail, redirect: portfolioPath });
    if (!ok || !body?.sent) {
      setError(body?.error || "We could not send the verification code. Please try again.");
      setPending(false);
      return;
    }
    setOtp("");
    setVerificationNotice("");
    setResendSeconds(60);
    setStep("verify");
    setPending(false);
  }

  async function continueWithVivIntro() {
    setPending(true);
    setError("");
    const { ok, body } = await startAuthentication({ method: "google", redirect: `${portfolioPath}#portfolio-interest`, ...(registeredEmail ? { email: registeredEmail } : {}) });
    if (!ok || !body?.url) {
      setError(body?.error || "We could not connect to Google. Please try again.");
      setPending(false);
      return;
    }
    continueToAuthProvider(body.url);
  }

  async function verifyAndSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestPayload) return setStep("details");
    setPending(true);
    setVerificationAction("verifying");
    setError("");
    const { ok, body } = await verifyAuthenticationCode({ purpose: "viewer_interest", email, token: otp, redirect: portfolioPath });
    if (!ok || !body?.verified) {
      setError(body?.error || "That code is incorrect or has expired.");
      setOtp("");
      setPending(false);
      setVerificationAction("idle");
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
      return;
    }
    setVerificationAction("sending");
    await sendInterest({ ...requestPayload, email: body.email || email });
  }

  async function resendCode() {
    if (resendSeconds > 0 || pending) return;
    setPending(true);
    setError("");
    const { ok, body } = await startAuthentication({ method: "email_otp", email, redirect: portfolioPath });
    if (!ok || !body?.sent) setError(body?.error || "We could not send another code.");
    else {
      setOtp("");
      setVerificationNotice("A new code was sent. Only the newest code will work; earlier codes are now invalid.");
      setResendSeconds(60);
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
    }
    setPending(false);
  }

  async function sendInterest(payload: InterestPayload) {
    try {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        setStep("verify");
        setError("Your verification session ended. Send a new code and try again.");
        return;
      }
      if (!response.ok) throw new Error(result?.error || "Unable to send interest");
      setSubmitted(true);
      setStep("success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send interest");
    } finally {
      setPending(false);
      setVerificationAction("idle");
    }
  }

  function openModal() {
    if (isOwner) return;
    setError("");
    if (!requestPayload) {
      setStep(authenticated ? "details" : "choice");
      setOtp("");
      setVerificationNotice("");
    }
    setVerificationAction("idle");
    setEmail(requestPayload?.email || sessionEmail || "");
    setOpen(true);
  }

  return (
    <>
      {submitted ? (
        <div className="interest-sent" role="status"><CheckCircle2 aria-hidden="true" /><span><strong>Request sent.</strong> The owner will decide whether to share protected details.</span></div>
      ) : isOwner ? (
        <div className="interest-owner-action">
          <button type="button" className="portfolio-button portfolio-button-primary" disabled aria-describedby="own-portfolio-interest-note"><MessageCircle aria-hidden="true" /> Show interest</button>
          <span id="own-portfolio-interest-note">This is your introduction.</span>
        </div>
      ) : (
        <button type="button" className="portfolio-button portfolio-button-primary" onClick={openModal}><MessageCircle aria-hidden="true" /> Show interest</button>
      )}

      {open && createPortal(
        <div className="interest-modal-backdrop" style={{ colorScheme: appearance }}>
          <div ref={dialogRef} className="interest-modal" data-step={step} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="interest-brand-lockup"><VivIntroBrand className="interest-brand" variant="stacked" decorative displayWidth={112} /></div>
            <div className="interest-modal-header">
              <div>
                <p className="portfolio-eyebrow">Show interest</p>
                <h2 id={titleId}>{step === "choice" ? "How would you like to continue?" : step === "verify" ? "Verify your email" : step === "success" ? "Request sent" : sessionEmail && existingViewerProfile ? `Add a note for ${firstName(profileName)}'s family` : `Introduce yourself to ${firstName(profileName)}'s family`}</h2>
                <p>{step === "choice" ? "Use your saved VivIntro details, or continue as a new visitor." : step === "verify" ? "Enter the six-digit code we sent. Your details will be submitted after verification." : step === "success" ? "The introduction owner can now review your request." : sessionEmail && existingViewerProfile ? "Your verified VivIntro details will be attached. Add only the context you want this family to see." : "Introduce yourself, your location and family background, then add a message."}</p>
              </div>
              <button type="button" className="interest-modal-close" onClick={closeModal} aria-label="Close interest form"><X aria-hidden="true" /></button>
            </div>

            {step === "choice" && (
              <div className="interest-account-choice">
                <div className="interest-account-choice-copy"><strong>Already use VivIntro?</strong><p>Sign in with Google to reuse the profile details connected to your account.</p></div>
                {error && <p className="interest-form-error" role="alert">{error}</p>}
                <form onSubmit={event => { event.preventDefault(); void continueWithVivIntro(); }} className="interest-choice-form"><label className="interest-field"><span>Registered email</span><input type="email" name="registeredEmail" autoComplete="email" spellCheck={false} required maxLength={180} value={registeredEmail} onChange={event => setRegisteredEmail(event.target.value.trim())} /></label><small>Choose this Google account when signing in. Your verified account determines which details are reused.</small><button type="submit" className="portfolio-button portfolio-button-primary" disabled={pending}>{pending ? "Connecting…" : "Continue with Google"}</button></form>
                <button type="button" className="interest-secondary-action" disabled={pending} onClick={() => { setError(""); setStep("details"); }}>Continue as a new visitor</button>
              </div>
            )}

            {step === "details" && <DetailsForm draft={requestPayload} sessionEmail={sessionEmail} existingViewerProfile={existingViewerProfile} pending={pending} error={error} fieldErrors={fieldErrors} onSubmit={beginRequest} />}

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
                <button type="submit" className="portfolio-button portfolio-button-primary" disabled={pending || otp.length !== 6}>{verificationAction === "sending" ? "Sending interest…" : verificationAction === "verifying" ? "Verifying…" : "Verify email"}</button>
                <button type="button" className="interest-secondary-action" onClick={() => void resendCode()} disabled={pending || resendSeconds > 0}>{resendSeconds > 0 ? `Send another code in ${resendSeconds}s` : "Send another code"}</button>
                <button type="button" className="interest-secondary-action" onClick={() => { setError(""); setStep("details"); }} disabled={pending}><ArrowLeft aria-hidden="true" /> Change details</button>
              </form>
            )}

            {step === "success" && (
              <div className="interest-success" role="status">
                <CheckCircle2 aria-hidden="true" />
                <h3>Request sent to {firstName(profileName)}.</h3>
                <p>The introduction owner can review it and decide whether to share protected details. You can return whenever you&apos;re ready.</p>
                <button type="button" className="portfolio-button portfolio-button-primary" onClick={closeModal}>Return to introduction</button>
              </div>
            )}
          </div>
        </div>, document.body
      )}
    </>
  );
}

function DetailsForm({ draft, sessionEmail, existingViewerProfile, pending, error, fieldErrors, onSubmit }: {
  draft: InterestPayload | null;
  sessionEmail: string | null;
  existingViewerProfile?: ExistingViewerProfile | null;
  pending: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="interest-form" noValidate>
      <div className="interest-form-scroll">
        {sessionEmail && existingViewerProfile ? (
          <>
            <div className="interest-existing-profile" aria-label="VivIntro profile in use">
              <span><MailCheck aria-hidden="true" /><strong>Using your VivIntro profile</strong></span>
              <p>{existingViewerProfile.name} · {sessionEmail}</p>
              {existingViewerProfile.city && <p>{[existingViewerProfile.city, existingViewerProfile.state, existingViewerProfile.country].filter(Boolean).join(", ")}</p>}
              {existingViewerProfile.profession && <p>Profession: {existingViewerProfile.profession}</p>}
              {existingViewerProfile.coreValues && <p>Core values: {existingViewerProfile.coreValues}</p>}
            </div>
            <input type="hidden" name="name" value={existingViewerProfile.name} />
            <input type="hidden" name="profileFor" value={existingViewerProfile.profileFor} />
            <input type="hidden" name="phone" value={existingViewerProfile.phone} />
            <input type="hidden" name="email" value={sessionEmail} />
            <input type="hidden" name="country" value={existingViewerProfile.country || ""} />
            <input type="hidden" name="state" value={existingViewerProfile.state || ""} />
            <input type="hidden" name="city" value={existingViewerProfile.city || ""} />
            <div className="interest-optional-copy-grid">
              <label className="interest-field"><span>Family context</span><textarea name="familyContext" rows={4} maxLength={600} placeholder="A few helpful details about your family" /></label>
              <label className="interest-field"><span>Message</span><textarea name="message" rows={4} maxLength={600} placeholder="Anything you would like the family to know" /></label>
            </div>
          </>
        ) : (
          <>
        <VisitorInterestFields draft={draft ? { name: fieldValue(draft.name), phone: fieldValue(draft.phone), email: draft.email, profileFor: fieldValue(draft.profileFor) as NewViewerInterestInput["profileFor"], familyContext: fieldValue(draft.familyContext), message: fieldValue(draft.message), location: draft.location, candidate: draft.candidate } : null} sessionEmail={sessionEmail} errors={fieldErrors} />
          </>
        )}
        {error && <p className="interest-form-error" role="alert">{error}</p>}
        <details className="interest-sharing-info"><summary>How your details are shared</summary><p>{existingViewerProfile ? "Only your verified profile identity and the context above will be shared." : "Your phone is contact information only. We verify your email before sending."}</p><p>Sending interest shares these details with the introduction owner. Protected details are available only if they approve your request. Read the <a href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</p></details>
      </div>
      <div className="interest-form-footer">
        <button type="submit" className="portfolio-button portfolio-button-primary" disabled={pending}>{pending ? "Please wait..." : sessionEmail ? "Send interest" : "Verify email and continue"}</button>
      </div>
    </form>
  );
}

function fieldValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value : "";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "the introduction owner";
}
