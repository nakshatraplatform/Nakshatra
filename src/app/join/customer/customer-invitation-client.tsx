"use client";

import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";


import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import styles from "../team/team-invitation.module.css";

type Claimed = {
  available: true;
  status: "portfolio_required" | "active";
  workspaceName: string;
  relationshipEndsAt: string;
};
type Stage = "exchanging" | "review" | "claiming" | "sign_in" | "portfolio_required" | "active" | "unavailable";

async function post(url: string, body: object) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function CustomerInvitationClient() {
  const [stage, setStage] = useState<Stage>("exchanging");
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    let active = true;
    async function exchange() {
      try {
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const token = fragment.get("token");
        if (window.location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
        if (token) {
          const response = await post("/api/v1/customer/broker-invitations/exchange", { token });
          if (!response.ok) throw new Error("exchange_failed");
        }
        if (active) setStage("review");
      } catch {
        if (active) setStage("unavailable");
      }
    }
    void exchange();
    return () => { active = false; };
  }, []);

  async function claim() {
    setStage("claiming");
    try {
      const response = await post("/api/v1/customer/broker-invitations/claim", {
        consent: true,
        consentVersion: "broker-representation-v2",
      });
      if (response.status === 401) { setStage("sign_in"); return; }
      const result = await response.json().catch(() => null) as Claimed | null;
      if (!response.ok || !result?.available) { setStage("unavailable"); return; }
      setClaimed(result);
      setStage(result.status);
    } catch {
      setStage("unavailable");
    }
  }

  return <div className={styles.shell}>
    <header><VivIntroBrand href="/" variant="compact-symbol" /><span>Private broker invitation</span><ThemeSwitch /></header>
    <main>
      <section className={styles.card} aria-live="polite">
        <VivIntroBrand variant="stacked" decorative displayWidth={138} />
        <div className={styles.icon}>{stage === "active" ? <ShieldCheck /> : <Building2 />}</div>
        {stage === "exchanging" && <><p className={styles.eyebrow}>Private invitation</p><h1>Checking your invitation…</h1><p>Please wait while VivIntro safely prepares this invitation.</p></>}
        {stage === "review" && <><p className={styles.eyebrow}>You remain the owner</p><h1>Connect your portfolio to this broker</h1><p>Your broker cannot create, edit, publish or unpublish your portfolio. You keep control of your VivIntro account and can end this relationship later.</p><div className={styles.consentSummary}><strong><Check /> What you authorize</strong><ul><li>Review your published Complete Portfolio.</li><li>Share that published portfolio in time-limited broker-mediated introductions.</li><li>Work only within this broker&apos;s private customer relationship for up to one year.</li></ul><p>This standing mandate does not require the broker to ask you for approval before each introduction.</p></div><label className={styles.consent}><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>I understand and authorize this broker relationship.</span></label><button className={styles.button} type="button" onClick={claim} disabled={!consented}>Accept and continue</button></>}
        {stage === "claiming" && <><p className={styles.eyebrow}>Recording your choice</p><h1>Joining securely…</h1><p>Please keep this page open.</p></>}
        {stage === "sign_in" && <><p className={styles.eyebrow}>Your account protects this invitation</p><h1>Sign in to continue</h1><p>Use the VivIntro account with the verified email address that received this invitation.</p><Link className={styles.button} href="/login?next=/join/customer">Sign in securely</Link></>}
        {stage === "portfolio_required" && claimed && <><p className={styles.eyebrow}>Broker joined</p><h1>Complete your one VivIntro portfolio</h1><p>Your relationship with <strong>{claimed.workspaceName}</strong> is recorded. Complete your customer-owned portfolio and VivIntro will activate it for this broker automatically.</p><Link className={styles.button} href="/dashboard">Complete my portfolio</Link></>}
        {stage === "active" && claimed && <><p className={styles.eyebrow}>Broker joined</p><h1>You are connected to {claimed.workspaceName}</h1><p>This agency can now work from the shared layer of your existing portfolio. Your other broker relationships remain private from them.</p><Link className={styles.button} href="/brokers">View my brokers</Link></>}
        {stage === "unavailable" && <><p className={styles.eyebrow}>Invitation unavailable</p><h1>Ask your broker for a new link</h1><p>This invitation may have expired, already been used, or belong to a different verified account. VivIntro does not reveal which condition applies.</p></>}
        <small><LockKeyhole /> Your other broker relationships are never revealed or connected to this broker.</small>
      </section>
    </main>
  </div>;
}
