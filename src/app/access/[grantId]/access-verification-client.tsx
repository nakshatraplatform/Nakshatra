"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { continueToAuthProvider, startAuthentication, verifyAuthenticationCode } from "@/features/auth/client/auth.api";

export function AccessVerificationClient({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const redirect = `/access/${encodeURIComponent(grantId)}`;

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await startAuthentication({ method: "email_otp", email, redirect });
    setPending(false);
    if (!result.ok || !result.body?.sent) return setError(result.body?.error || "We could not send a code. Please try again.");
    setOtp("");
    setStep("verify");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await verifyAuthenticationCode({ purpose: "viewer_interest", email, token: otp, redirect });
    if (!result.ok || !result.body?.verified) {
      setPending(false);
      setOtp("");
      return setError(result.body?.error || "That code is incorrect or has expired.");
    }
    router.replace(redirect);
    router.refresh();
  }

  async function continueWithGoogle() {
    setPending(true);
    setError("");
    const result = await startAuthentication({ method: "google", redirect });
    if (!result.ok || !result.body?.url) {
      setPending(false);
      return setError(result.body?.error || "We could not connect to Google. Please try again.");
    }
    continueToAuthProvider(result.body.url);
  }

  return (
    <div className="mt-7 grid gap-4">
      {step === "start" ? (
        <>
          <form className="grid gap-3" onSubmit={sendCode}>
            <label className="grid gap-2 text-left text-sm font-semibold">
              Verified email address
              <input className="min-h-12 rounded-lg border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface)] px-4 font-normal" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button className="dashboard-primary-action min-h-12" disabled={pending}>{pending ? "Sending…" : "Send verification code"}</button>
          </form>
          <div className="flex items-center gap-3 text-sm text-[color:var(--workspace-ink-muted)]"><span className="h-px flex-1 bg-[color:var(--workspace-border)]" />or<span className="h-px flex-1 bg-[color:var(--workspace-border)]" /></div>
          <button type="button" className="dashboard-secondary-action min-h-12" disabled={pending} onClick={() => void continueWithGoogle()}>Continue with Google</button>
        </>
      ) : (
        <form className="grid gap-3" onSubmit={verifyCode}>
          <p className="text-sm text-[color:var(--workspace-ink-muted)]">Enter the six-digit code sent to <strong className="text-[color:var(--workspace-ink)]">{email}</strong>.</p>
          <label className="grid gap-2 text-left text-sm font-semibold">
            Six-digit code
            <input className="min-h-14 rounded-lg border border-[color:var(--workspace-border)] bg-[color:var(--workspace-surface)] px-4 text-center font-mono text-xl font-bold tracking-[0.35em]" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} />
          </label>
          <button className="dashboard-primary-action min-h-12" disabled={pending || otp.length !== 6}>{pending ? "Verifying…" : "Verify and view portfolio"}</button>
          <button type="button" className="dashboard-secondary-action min-h-11" disabled={pending} onClick={() => { setStep("start"); setError(""); }}>Use another email</button>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg bg-[light-dark(#f8e8e4,var(--app-dark-danger-surface))] p-3 text-sm text-[light-dark(#8e342e,var(--app-dark-danger))]">{error}</p>}
    </div>
  );
}
