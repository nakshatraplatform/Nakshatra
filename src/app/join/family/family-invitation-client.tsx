"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, LockKeyhole, UsersRound } from "lucide-react";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import styles from "../team/team-invitation.module.css";

type Stage = "exchanging" | "review" | "accepting" | "sign_in" | "active" | "unavailable";

async function post(url: string, body: object) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function FamilyInvitationClient() {
  const [stage, setStage] = useState<Stage>("exchanging");
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    let active = true;
    async function exchange() {
      try {
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const token = fragment.get("token");
        if (window.location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
        const response = await post("/api/v1/family-invitations/exchange", token ? { token } : {});
        if (!response.ok) throw new Error("exchange_failed");
        const result = await response.json().catch(() => null) as { ready?: boolean } | null;
        if (active) setStage(result?.ready === true ? "review" : "unavailable");
      } catch {
        if (active) setStage("unavailable");
      }
    }
    void exchange();
    return () => { active = false; };
  }, []);

  async function accept() {
    setStage("accepting");
    try {
      const response = await post("/api/v1/family-invitations/accept", {
        idempotencyKey: `family-invitation-accept:${crypto.randomUUID()}`,
      });
      if (response.status === 401) { setStage("sign_in"); return; }
      const result = await response.json().catch(() => null) as { available?: boolean } | null;
      setStage(response.ok && result?.available ? "active" : "unavailable");
    } catch {
      setStage("unavailable");
    }
  }

  return <div className={styles.shell}>
    <header><VivIntroBrand href="/" variant="horizontal" /><span>Private family invitation</span><ThemeSwitch /></header>
    <main>
      <section className={styles.card}>
        <p className="sr-only" role="status" aria-atomic="true">{stage}</p>
        <VivIntroBrand variant="stacked" decorative displayWidth={138} />
        <div className={styles.icon}>{stage === "active" ? <Check /> : <UsersRound />}</div>
        {stage === "exchanging" && <><p className={styles.eyebrow}>Private invitation</p><h1>Checking your invitation…</h1><LoadingStatus title="Preparing your family invitation" state="connecting" /></>}
        {stage === "review" && <><p className={styles.eyebrow}>View-only family access</p><h1>Support your family member on VivIntro</h1><p>The candidate invited you to set up view-only family membership.</p><div className={styles.consentSummary}><strong><Check /> What this means</strong><ul><li>VivIntro will notify you when an eligible broker Introduction is available to view.</li><li>Only the candidate can submit Interested or Decline.</li><li>Your access can be removed by the candidate at any time.</li><li>Use the exact Google account that received this invitation.</li></ul></div><label className={styles.consent}><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /><span>I understand this is view-only family access.</span></label><button className={styles.button} type="button" disabled={!understood} onClick={accept}>Accept family access</button></>}
        {stage === "accepting" && <><p className={styles.eyebrow}>Confirming your account</p><h1>Activating access…</h1><LoadingStatus title="Confirming your family access" detail="Please keep this page open." /></>}
        {stage === "sign_in" && <><p className={styles.eyebrow}>Your account protects this invitation</p><h1>Sign in with Google to continue</h1><p>Use the exact Google account that received this invitation.</p><Link className={styles.button} href="/login?redirect=%2Fjoin%2Ffamily&method=google">Sign in securely</Link></>}
        {stage === "active" && <><p className={styles.eyebrow}>Access confirmed</p><h1>You are now a family viewer</h1><p>The candidate remains in control and is the only person who can submit a response. Follow eligible introductions in your family dashboard.</p><Link className={styles.button} href="/family">Open family introductions</Link></>}
        {stage === "unavailable" && <><p className={styles.eyebrow}>Invitation unavailable</p><h1>Ask the candidate for a new invitation</h1><p>This link may have expired, already been used, or belong to a different Google account. VivIntro does not reveal which condition applies.</p></>}
        <small><LockKeyhole /> The URL alone never grants portfolio or Introduction access.</small>
      </section>
    </main>
  </div>;
}
