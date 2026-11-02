"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { boundedJsonRequest } from "@/lib/api/bounded-json-request";

export function GuestPortfolioVerification({ token }: { token: string }) {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const busy = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const { response, body } = await boundedJsonRequest<{ challengeId?: string; verified?: boolean; path?: string; error?: string }>("/api/interest/viewing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challenge ? { action: "complete", challengeId: challenge, email, code }
          : { action: "start", shareToken: token, email }),
      });
      if (!response.ok) throw new Error(body?.error || "We could not verify this email. Please try again.");
      if (!challenge && body?.challengeId) { setChallenge(body.challengeId); setResendAt(Date.now() + 60_000); setCode(""); }
      else if (body?.verified && body.path === `/p/${encodeURIComponent(token)}`) window.location.assign(body.path);
      else throw new Error("We could not confirm access. Please try again.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification is temporarily unavailable.");
      setCode("");
    } finally { busy.current = false; setPending(false); }
  }

  return <section className="w-full max-w-lg rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-6 sm:p-9">
    <div className="mb-7 flex justify-center"><VivIntroBrand variant="stacked" displayWidth={132} /></div>
    <h1 className="text-2xl font-semibold">View the portfolio shared with you</h1>
    <p className="mt-3 leading-7 text-[var(--workspace-muted)]">Verify the email the owner approved. This remembers viewing on this browser only; it creates no account or VivIntro sign-in.</p>
    <form className="mt-6" onSubmit={submit}>
      <fieldset className="space-y-5" disabled={!hydrated} aria-busy={!hydrated}>
      {!hydrated && <p role="status">Preparing secure form…</p>}
      <label className="block"><span className="mb-2 block font-semibold">Approved email address</span><input className="w-full rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-canvas)] p-3" type="email" autoComplete="email" maxLength={180} required value={email} disabled={pending || Boolean(challenge)} onChange={event => setEmail(event.target.value)} /></label>
      {challenge && <><p className="text-sm leading-6">If this email has current approval, we sent a six-digit code. It expires in 10 minutes. Check your inbox and spam folder.</p><label className="block"><span className="mb-2 block font-semibold">Six-digit viewing code</span><input className="w-full rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-canvas)] p-3" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required autoFocus /></label></>}
      {error && <p role="alert" className="interest-form-error">{error}</p>}
      <button className="dashboard-primary-action w-full" type="submit" disabled={pending || Boolean(challenge && code.length !== 6)}>{pending ? "Please wait…" : challenge ? "Verify and view portfolio" : "Send viewing code"}</button>
      {challenge && <button className="dashboard-secondary-action w-full" type="button" disabled={pending} onClick={() => {
        if (Date.now() < resendAt) { setError("Please wait one minute before requesting another code."); return; }
        setChallenge(null); setCode(""); setError("");
      }}>Use another email or request a new code</button>}
      </fieldset>
    </form>
    <p className="mt-6 text-sm leading-6 text-[var(--workspace-muted)]">Approval lasts up to 15 days and may end earlier if the owner stops sharing.</p>
    <Link className="mt-5 inline-block underline underline-offset-4" href={`/p/${encodeURIComponent(token)}`}>Back to public introduction</Link>
  </section>;
}
