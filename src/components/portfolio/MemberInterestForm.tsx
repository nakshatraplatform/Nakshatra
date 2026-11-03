"use client";
import { useEffect, useRef, useState } from "react";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { boundedJsonRequest } from "@/lib/api/bounded-json-request";
import { memberInterestContextSchema, type MemberInterestContext } from "@/features/interest/member-interest.contract";
import { interestStatusLabel } from "@/features/interest/presentation";

/** One visible consent action reuses the published profile, never a draft or email lookup. */
export function MemberInterestForm({ token, recipientName, onUnavailable, onSent }: {
  token: string; recipientName: string; onUnavailable: () => void; onSent: (mutual: boolean) => void;
}) {
  const hydrated = useHydrated();
  const [context, setContext] = useState<MemberInterestContext | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void boundedJsonRequest<unknown>(`/api/interest/member?token=${encodeURIComponent(token)}`, { cache: "no-store", signal: controller.signal })
      .then(({ response, body }) => {
        if (controller.signal.aborted) return;
        const parsed = memberInterestContextSchema.safeParse(body);
        if (!response.ok || !parsed.success) throw new Error("Could not load your published profile. Please retry.");
        if (!parsed.data.available) onUnavailable();
        else setContext(parsed.data);
      }).catch(() => { if (!controller.signal.aborted) setError("We could not load your published profile. Please retry."); });
    return () => controller.abort();
  }, [token, attempt, onUnavailable]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || !context || context.alreadySent || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const { response, body } = await boundedJsonRequest<{ submitted?: boolean; mutual?: boolean; error?: string; code?: string }>("/api/interest/member", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioToken: token, revision: context.revision, scope: "full_portfolio", message }),
      });
      if (!response.ok || body?.submitted !== true) {
        if (body?.code === "SHARING_REVIEW_CHANGED" || body?.code === "INTEREST_ALREADY_SENT") { setContext(null); setAttempt(value => value + 1); }
        throw new Error(body?.error || "We could not confirm your interest. Retry safely; access will not be duplicated or extended.");
      }
      onSent(body.mutual === true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not confirm your interest. Please retry."); }
    finally { busy.current = false; setPending(false); }
  }
  return <form className="interest-form" onSubmit={submit}>
    <div className="interest-form-scroll">
      {!context && !error && <p role="status">Loading your published profile…</p>}
      {context && <>
        <p className="font-semibold">Sharing {context.name}’s published profile with {recipientName}</p>
        <p className="interest-verification-help">This shares only your published details, including any private contacts and photos{context.hasHoroscope ? ", including your horoscope" : ""}. Drafts, owner notes and street addresses stay private.</p>
        <p className="interest-verification-help">They can view it for 15 days. You can stop sharing from your dashboard. Information already viewed or saved cannot be recalled.</p>
        {context.alreadySent ? <p role="status">Interest already sent · {interestStatusLabel(context.requestStatus || "new")}.{!context.sharingActive && " Your full profile is not currently shared through this request."}</p>
          : <label className="interest-field"><span>Message (optional)</span><textarea className="w-full" rows={3} maxLength={600} value={message} disabled={pending || !hydrated} onChange={event => setMessage(event.target.value)} /></label>}
      </>}
      {error && <p className="interest-form-error" role="alert">{error}</p>}
      {!context && error && <button type="button" className="interest-secondary-action" disabled={pending} onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry loading profile</button>}
    </div>
    {context && !context.alreadySent && <div className="interest-form-footer"><button type="submit" className="portfolio-button portfolio-button-primary" disabled={!hydrated || pending} aria-busy={pending}>{pending ? "Sending interest…" : `Send interest and share my full profile with ${recipientName}`}</button></div>}
  </form>;
}
