"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import {
  continueToAuthProvider,
  startAuthentication,
  verifyAuthenticationCode,
} from "@/features/auth/client/auth.api";
import {
  getPilotAccessState,
  submitPilotAccess,
} from "@/features/pilot-access/client/pilot-access.api";
import {
  PILOT_CONTACT_CONSENT_VERSION,
  type PilotAccessState,
} from "@/features/pilot-access/server/pilot-access.contract";

type Step = "loading" | "identify" | "verify" | "details" | "result";

function messageForState(state: PilotAccessState) {
  if (state.canCreatePortfolio) {
    return {
      icon: CheckCircle2,
      eyebrow: "Existing creator",
      title: "Your Nakshatra access is already active.",
      body: "Continue to your dashboard to create, update, and manage your portfolio.",
    };
  }
  switch (state.application?.status) {
    case "pending":
      return {
        icon: Clock3,
      eyebrow: "You're on the list",
      title: "Your place on the launch waitlist is confirmed.",
      body: "We will contact your verified email when signup opens. Joining the waitlist does not create portfolio access.",
      };
    case "declined":
      return {
        icon: LockKeyhole,
        eyebrow: "Private beta",
        title: "Access is not available for this account yet.",
        body: "Your earlier request was reviewed, but creator access was not granted. Your viewer access remains available.",
      };
    case "revoked":
      return {
        icon: LockKeyhole,
        eyebrow: "Creator access paused",
        title: "Your pilot creator access is no longer active.",
        body: "Your saved information is retained. Contact the Nakshatra team if you believe this is unexpected.",
      };
    default:
      return null;
  }
}

export default function PilotAccessClient() {
  const [step, setStep] = useState<Step>("loading");
  const [state, setState] = useState<PilotAccessState | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshState() {
    const result = await getPilotAccessState();
    if (result.unauthenticated) {
      setStep("identify");
      return;
    }
    if (!result.ok || !result.state) {
      setError(result.failure?.error ?? "The waitlist is temporarily unavailable.");
      setStep("identify");
      return;
    }
    setState(result.state);
    setStep(result.state.canCreatePortfolio || result.state.application ? "result" : "details");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial state comes from an external authenticated API response.
    void refreshState();
  }, []);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await startAuthentication({ method: "pilot_access_otp", email });
    setBusy(false);
    if (!result.ok) {
      setError(result.body?.error ?? "We could not send a code. Please try again.");
      return;
    }
    setStep("verify");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifyAuthenticationCode({
      purpose: "pilot_access",
      email,
      token: otp,
      redirect: "/pilot-access",
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.body?.error ?? "We could not verify that code.");
      return;
    }
    await refreshState();
    setBusy(false);
  }

  async function continueWithGoogle() {
    setBusy(true);
    setError(null);
    const result = await startAuthentication({ method: "google", redirect: "/pilot-access" });
    if (result.ok && result.body?.url) {
      continueToAuthProvider(result.body.url);
      return;
    }
    setBusy(false);
    setError(result.body?.error ?? "Google sign-in is temporarily unavailable.");
  }

  async function submitDetails(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setError("Confirm that we may contact you about the Nakshatra launch.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submitPilotAccess({
      displayName,
      phoneE164: phone.trim() || null,
      contactConsentVersion: PILOT_CONTACT_CONSENT_VERSION,
      idempotencyKey: `pilot-submit:${crypto.randomUUID()}`,
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.failure?.error ?? "We could not add you to the waitlist.");
      return;
    }
    await refreshState();
    setBusy(false);
  }

  const resultCopy = state ? messageForState(state) : null;
  const ResultIcon = resultCopy?.icon ?? ShieldCheck;

  return (
    <main id="main-content" className="min-h-screen bg-[#f8f6f0] px-4 py-8 text-[#18272e] sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.16em] text-[#244854]">NAKSHATRA</Link>
          <span className="rounded-full bg-[#e9e2cf] px-3 py-1.5 text-xs font-semibold text-[#725d2b]">Launch waitlist</span>
        </header>

        <section className="rounded-xl border border-[#d0d3ce] bg-[#fffdf8] p-6 shadow-[0_18px_50px_rgb(29_52_58/0.08)] sm:p-10">
          {step === "loading" ? (
            <p role="status" className="py-16 text-center text-slate-600">Checking your access…</p>
          ) : step === "result" && resultCopy ? (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#dcebe5] text-[#315f57]"><ResultIcon aria-hidden className="h-6 w-6" /></span>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#477b77]">{resultCopy.eyebrow}</p>
              <h1 className="mt-2 font-[family-name:var(--font-portfolio-display)] text-4xl font-medium leading-tight">{resultCopy.title}</h1>
              <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-600">{resultCopy.body}</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                {state?.canCreatePortfolio ? <Link href="/dashboard?edit=1" className="dashboard-primary-action">Start portfolio</Link> : null}
                <Link href="/dashboard" className="dashboard-secondary-action">Go to dashboard</Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#477b77]">Launching soon</p>
              <h1 className="mt-2 font-[family-name:var(--font-portfolio-display)] text-4xl font-medium leading-tight sm:text-5xl">Join the Nakshatra waitlist.</h1>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">Verify your email and leave a few basic details. We will send your signup invitation when Nakshatra opens—joining now does not create portfolio access.</p>

              {error ? <div role="alert" className="mt-6 border-l-4 border-[#b7483e] bg-[#f8e6e2] p-4 text-sm text-[#7d302b]">{error}</div> : null}

              {step === "identify" ? (
                <form onSubmit={sendCode} className="mt-8 grid gap-5">
                  <label className="grid gap-2 text-sm font-semibold">Email address
                    <span className="flex min-h-12 items-center gap-3 rounded-lg border border-[#adb8ba] bg-white px-4 focus-within:border-[#477b77] focus-within:ring-2 focus-within:ring-[#477b77]/20">
                      <Mail aria-hidden className="h-5 w-5 text-slate-500" />
                      <input required type="email" autoComplete="email" maxLength={180} value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 outline-none" placeholder="you@example.com" />
                    </span>
                  </label>
                  <button disabled={busy} className="dashboard-primary-action w-full">{busy ? "Sending code…" : "Verify email to join"}</button>
                  <div className="flex items-center gap-3 text-sm text-slate-500"><span className="h-px flex-1 bg-[#d8d8d2]" />or<span className="h-px flex-1 bg-[#d8d8d2]" /></div>
                  <button type="button" disabled={busy} onClick={continueWithGoogle} className="dashboard-secondary-action w-full">Verify with Google</button>
                </form>
              ) : null}

              {step === "verify" ? (
                <form onSubmit={verifyCode} className="mt-8 grid gap-5">
                  <div className="rounded-lg bg-[#e8f1ed] p-4 text-sm leading-6 text-[#315f57]">We sent a six-digit code to <strong>{email}</strong>.</div>
                  <label className="grid gap-2 text-sm font-semibold">Verification code
                    <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} className="min-h-12 rounded-lg border border-[#adb8ba] bg-white px-4 text-center text-xl tracking-[0.35em] outline-none focus:border-[#477b77] focus:ring-2 focus:ring-[#477b77]/20" />
                  </label>
                  <button disabled={busy || otp.length !== 6} className="dashboard-primary-action w-full">{busy ? "Verifying…" : "Confirm email"}</button>
                  <button type="button" onClick={() => { setOtp(""); setError(null); setStep("identify"); }} className="text-sm font-semibold text-[#315f57]">Use a different email</button>
                </form>
              ) : null}

              {step === "details" ? (
                <form onSubmit={submitDetails} className="mt-8 grid gap-5">
                  <div className="flex gap-3 rounded-lg bg-[#e8f1ed] p-4 text-sm leading-6 text-[#315f57]"><ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0" /><span>Your email is verified and cannot be replaced by this form. Verification does not grant product access.</span></div>
                  <label className="grid gap-2 text-sm font-semibold">Your name
                    <input required minLength={2} maxLength={120} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="min-h-12 rounded-lg border border-[#adb8ba] bg-white px-4 outline-none focus:border-[#477b77] focus:ring-2 focus:ring-[#477b77]/20" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">Phone number <span className="font-normal text-slate-500">Optional, international format</span>
                    <input type="tel" autoComplete="tel" pattern="\+[1-9][0-9]{7,14}" placeholder="+14155550100" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-h-12 rounded-lg border border-[#adb8ba] bg-white px-4 outline-none focus:border-[#477b77] focus:ring-2 focus:ring-[#477b77]/20" />
                  </label>
                  <label className="flex items-start gap-3 text-sm leading-6 text-slate-600"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#315f57]" /><span>Nakshatra may contact me by email, and by phone if provided, about launch access. I can ask to be removed at any time.</span></label>
                  <button disabled={busy} className="dashboard-primary-action w-full">{busy ? "Joining…" : "Join the waitlist"}</button>
                </form>
              ) : null}
            </>
          )}
        </section>

        <div className="mt-6 flex items-start gap-3 px-2 text-sm leading-6 text-slate-600"><LockKeyhole aria-hidden className="mt-1 h-4 w-4 shrink-0" /><p>The waitlist does not grant creator or portfolio access. We will send signup instructions separately when launch access is available.</p></div>
      </div>
    </main>
  );
}
