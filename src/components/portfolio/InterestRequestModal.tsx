"use client";

import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { InterestContextFields, VisitorInterestFields } from "./VisitorInterestFields";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LoaderCircle, MailCheck, MessageCircle, ShieldCheck, X } from "lucide-react";
import type { NewViewerInterestInput } from "@/features/interest/server/interest.contract";
import { continueToAuthProvider, startAuthentication, verifyAuthenticationCode } from "@/features/auth/client/auth.api";
import type { ExistingViewerProfile } from "@/features/interest/server/existing-viewer-profile.service";
import type { CelestialAppearance } from "@/features/portfolio/celestial-theme";
import type { LocationValue } from "@/components/portfolio/LocationFields";
import { StructuredInterestLocation, interestLocationError } from "./StructuredInterestLocation";
import { lockPageScroll } from "@/lib/ui/scroll-lock";

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

export function InterestRequestModal({ portfolioToken, profileName, profileSummary, authenticated, verifiedEmail, existingViewerProfile, isOwner = false, appearance = "light" }: {
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
  const [step, setStep] = useState<ModalStep>(authenticated ? "details" : "choice");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState(verifiedEmail || "");
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
  const portfolioPath = `/p/${encodeURIComponent(portfolioToken)}`;
  const sessionEmail = authenticated ? verifiedEmail?.trim().toLowerCase() || null : null;

  useEffect(() => {
    if (step === "details" && Object.keys(fieldErrors).length) {
      const first = dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      first?.focus({ preventScroll: true });
      first?.closest('label, [role="group"]')?.scrollIntoView?.({ block: "center" });
    }
  }, [fieldErrors, step]);

  useEffect(() => {
    if (!authenticated || window.location.hash !== "#portfolio-interest") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const resume = window.setTimeout(() => {
      setStep("details");
      setHasOpened(true);
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(resume);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    // Safari does not focus a button on pointer activation; retain its trigger explicitly.
    const previous = triggerRef.current || document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll(document);
    const background = new Map<HTMLElement, boolean>();
    for (const element of Array.from(document.body.children)) {
      if (element instanceof HTMLElement && !element.contains(dialogRef.current)) { background.set(element, element.inert); element.inert = true; }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!inFlight.current) setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
      )).filter(element => {
        if (element.tabIndex < 0) return false;
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          if (node.hidden || getComputedStyle(node).display === "none") return false;
          if (node instanceof HTMLDetailsElement && !node.open && !node.querySelector("summary")?.contains(element)) return false;
        }
        return true;
      });
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && (index <= 0)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (index < 0 || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      background.forEach((inert, element) => { element.inert = inert; });
      unlockScroll();
      previous?.focus({ preventScroll: true });
    };
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
    if (!pending) setOpen(false);
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
      useExistingProfile: Boolean(sessionEmail && existingViewerProfile),
      location: viewerLocation() as NewViewerInterestInput["location"],
      ...(formData.get("profileFor") !== "self" && !existingViewerProfile ? { candidate: {
        name: String(formData.get("candidateName") || ""), email: String(formData.get("candidateEmail") || ""), phone: String(formData.get("candidatePhone") || ""), relationship: "",
        ...(formData.has("candidateCountryCode") ? { location: viewerLocation("candidate") as NewViewerInterestInput["location"] } : {}),
      } } : {}),
    };
    setError("");
    setFieldErrors({});
    setPending(true);
    inFlight.current = true;

    // Load authoring validation only when needed, not on the portfolio's first paint.
    try {
      const { interestSubmissionSchema, interestRequestValidationMessage, interestFieldErrors } = await import("@/features/interest/server/interest.contract");
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
      setError("We could not check your details. Please try again.");
      setPending(false);
      inFlight.current = false;
      return;
    }
    setRequestPayload(payload);
    setEmail(payload.email);

    if (sessionEmail) return void await sendInterest(payload);

    const { ok, body } = await startAuthentication({ method: "email_otp", email: enteredEmail, redirect: portfolioPath });
    if (!ok || !body?.sent) {
      setError(body?.error || "We could not send the verification code. Please try again.");
      setPending(false);
      inFlight.current = false;
      return;
    }
    setOtp("");
    setVerificationNotice("");
    setResendSeconds(60);
    setStep("verify");
    setPending(false);
    inFlight.current = false;
  }

  async function continueWithVivIntro() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const { ok, body } = await startAuthentication({ method: "google", redirect: `${portfolioPath}#portfolio-interest` });
    if (!ok || !body?.url) {
      setError(body?.error || "We could not connect to Google. Please try again.");
      setPending(false);
      inFlight.current = false;
      return;
    }
    continueToAuthProvider(body.url);
  }

  async function verifyAndSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (!requestPayload) return setStep("details");
    inFlight.current = true;
    setPending(true);
    setVerificationAction("verifying");
    setError("");
    const { ok, body } = await verifyAuthenticationCode({ purpose: "viewer_interest", email, token: otp, redirect: portfolioPath });
    if (!ok || !body?.verified) {
      setError(body?.error || "That code is incorrect or has expired.");
      setOtp("");
      setPending(false);
      inFlight.current = false;
      setVerificationAction("idle");
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
      return;
    }
    setVerificationAction("sending");
    await sendInterest({ ...requestPayload, email: body.email || email });
  }

  async function resendCode() {
    if (resendSeconds > 0 || inFlight.current) return;
    inFlight.current = true;
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
    inFlight.current = false;
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
      setRequestPayload(null);
      setOtp("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send interest");
    } finally {
      setPending(false);
      inFlight.current = false;
      setVerificationAction("idle");
    }
  }

  function openModal() {
    if (isOwner) return;
    setHasOpened(true);
    setOpen(true);
  }

  return (
    <>
      {submitted ? (
        <div className="interest-sent" role="status"><CheckCircle2 aria-hidden="true" /><span><strong>Request sent.</strong> The owner will decide whether to share private details.</span></div>
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
          <div ref={dialogRef} className="interest-modal" data-step={step} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <aside className="interest-context" aria-label="About this introduction">
              <VivIntroBrand href="/" variant="stacked" tone={appearance === "dark" ? "reverse" : "primary"} displayWidth={112} />
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
              <p className="interest-context-privacy"><ShieldCheck aria-hidden="true" />Private details are shared only after approval.</p>
            </aside>
            <div className="interest-main-pane">
            <div className="interest-brand-lockup"><VivIntroBrand href="/" className="interest-brand" variant="stacked" tone={appearance === "dark" ? "reverse" : "primary"} displayWidth={112} /></div>
            <div className="interest-modal-header">
              <div>
                <p className="portfolio-eyebrow">Show interest</p>
                <h2 ref={headingRef} tabIndex={-1} id={titleId}>{step === "choice" ? "How would you like to continue?" : step === "verify" ? "Verify your email" : step === "success" ? "Request sent" : sessionEmail && existingViewerProfile ? `Confirm your details for ${firstName(profileName)}'s family` : `Introduce yourself to ${firstName(profileName)}'s family`}</h2>
                <p>{step === "choice" ? "Sign in to reuse your details, or continue with email. You don’t need to create an introduction." : step === "verify" ? "Enter the six-digit code we sent. Your details will be submitted after verification." : step === "success" ? `${firstName(profileName)} can now review your interest.` : sessionEmail && existingViewerProfile ? "Check your location and add a short introduction. Your signed-in details are already filled in." : "A few details help the family understand who is getting in touch."}</p>
              </div>
              <button type="button" className="interest-modal-close" disabled={pending} onClick={closeModal} aria-label="Close interest form"><X aria-hidden="true" /></button>
            </div>

            {step === "choice" && (
              <div className="interest-account-choice">
                <div className="interest-account-choice-copy"><strong>Already use VivIntro?</strong><p>Sign in with your usual account to reuse your details.</p></div>
                {error && <p id={verificationErrorId} className="interest-form-error" role="alert">{error}</p>}
                <Link href={`/login?redirect=${encodeURIComponent(`${portfolioPath}#portfolio-interest`)}`} className="portfolio-button portfolio-button-primary">Sign in to VivIntro</Link>
                <button type="button" className="interest-secondary-action" onClick={() => void continueWithVivIntro()} disabled={pending} aria-busy={pending} aria-label={pending ? "Connecting to Google" : undefined}>{pending ? <InterestActionProgress label="Connecting to Google" /> : "Continue with Google"}</button>
                <button type="button" className="interest-secondary-action" disabled={pending} onClick={() => { setError(""); setStep("details"); }}>Continue as a new visitor</button>
              </div>
            )}

            {/* Retain unsent answers only in this page session, including close/reopen and verification back. */}
            {(step === "details" || step === "verify") && <DetailsForm hidden={step !== "details"} draft={requestPayload} portfolioToken={portfolioToken} sessionEmail={sessionEmail} existingViewerProfile={existingViewerProfile} pending={pending} error={error} fieldErrors={fieldErrors} onSubmit={beginRequest} />}

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
                <h3>Request sent to {firstName(profileName)}.</h3>
                <p>{firstName(profileName)} can review your interest and decide whether to share private details. There’s nothing else to send now.</p>
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

function DetailsForm({ hidden, draft, portfolioToken, sessionEmail, existingViewerProfile, pending, error, fieldErrors, onSubmit }: {
  hidden: boolean;
  draft: InterestPayload | null;
  portfolioToken: string;
  sessionEmail: string | null;
  existingViewerProfile?: ExistingViewerProfile | null;
  pending: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [location, setLocation] = useState<LocationValue>(() => existingViewerProfile ? {
    country: existingViewerProfile.country,
    countryCode: existingViewerProfile.countryCode,
    region: existingViewerProfile.state,
    regionCode: existingViewerProfile.subdivisionCode,
    city: existingViewerProfile.city,
    cityGeonameId: existingViewerProfile.cityGeonameId,
    postalCode: existingViewerProfile.postalCode,
    locationSource: "existing_profile",
  } : {});
  function updateLocation(changes: LocationValue) {
    setLocation((current) => ({ ...current, ...changes }));
  }

  return (
    <form onSubmit={onSubmit} hidden={hidden} className="interest-form" noValidate>
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
            <fieldset className="interest-form-section">
              <legend>Current location · Required</legend>
              <StructuredInterestLocation label="Your location" value={location} onChange={updateLocation} portfolioToken={portfolioToken}
                error={interestLocationError(fieldErrors)} />
            </fieldset>
            <InterestContextFields draft={{ familyContext: fieldValue(draft?.familyContext), message: fieldValue(draft?.message) }} errors={fieldErrors} />
          </>
        ) : (
          <>
        <VisitorInterestFields draft={draft ? { name: fieldValue(draft.name), phone: fieldValue(draft.phone), email: draft.email, profileFor: fieldValue(draft.profileFor) as NewViewerInterestInput["profileFor"], familyContext: fieldValue(draft.familyContext), message: fieldValue(draft.message), location: draft.location, candidate: draft.candidate } : null} sessionEmail={sessionEmail} errors={fieldErrors} portfolioToken={draft?.portfolioToken || portfolioToken} />
          </>
        )}
        <p className="interest-verification-help">Your answers stay here while this page is open. {sessionEmail ? "Sending shares them with this family." : "Next, confirm your email to send your interest."}</p>
        {error && <p className="interest-form-error" role="alert">{error}</p>}
        <details className="interest-sharing-info"><summary>How your details are shared</summary><p>{existingViewerProfile ? "Only your verified profile identity and the context above will be shared." : "Your phone is contact information only. We verify your email before sending."}</p><p>Sending interest shares these details with the introduction owner. Private details are available only if they approve your request. Read the <a href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</p></details>
      </div>
      <div className="interest-form-footer">
        <button type="submit" className="portfolio-button portfolio-button-primary" disabled={pending} aria-busy={pending} aria-label={pending ? sessionEmail ? "Sending interest" : "Sending verification code" : undefined}>{pending ? <InterestActionProgress label={sessionEmail ? "Sending interest" : "Sending verification code"} /> : sessionEmail ? "Send interest" : "Verify email and continue"}</button>
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
