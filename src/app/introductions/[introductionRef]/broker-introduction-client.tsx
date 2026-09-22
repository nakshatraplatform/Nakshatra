"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BiodataTemplate } from "@/components/templates";
import type { PortfolioPhoto } from "@/features/media/portfolio-photo";
import type { PortfolioHoroscopeAttachment } from "@/types/portfolio";
import type { ResolvedBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.contract";
import styles from "./broker-introduction.module.css";

type AvailableIntroduction = Extract<ResolvedBrokerIntroduction, { available: true }>;

export function BrokerIntroductionClient({ introductionRef }: { introductionRef: string }) {
  const [introduction, setIntroduction] = useState<AvailableIntroduction | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "unavailable">("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!introductionRef) { setState("unavailable"); return; }
      const response = await fetch(`/api/v1/introductions/${encodeURIComponent(introductionRef)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as ResolvedBrokerIntroduction | null;
      if (!active) return;
      if (response.status === 401) { setState("signed-out"); return; }
      if (!response.ok || !result?.available) { setState("unavailable"); return; }
      setIntroduction(result); setState("ready");
    }
    void load();
    return () => { active = false; };
  }, [introductionRef]);

  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const responseValue = String(form.get("response"));
    const response = await fetch(`/api/v1/introductions/${encodeURIComponent(introductionRef)}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response: responseValue,
        comment: String(form.get("comment") || ""),
        confirmCompleteAccess: form.get("confirmCompleteAccess") === "on",
      }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as {
      available?: boolean;
      response?: "accepted" | "declined";
      completeAccessConfirmed?: boolean;
    } | null;
    if (!response?.ok || !result?.available || !result.response) {
      setError("Your response could not be recorded. The link may have expired or already been answered.");
    } else {
      const refreshedResponse = await fetch(`/api/v1/introductions/${encodeURIComponent(introductionRef)}`, { cache: "no-store" }).catch(() => null);
      const refreshed = await refreshedResponse?.json().catch(() => null) as ResolvedBrokerIntroduction | null;
      if (refreshedResponse?.ok && refreshed?.available) {
        setIntroduction(refreshed);
      } else {
        setIntroduction((current) => current ? {
          ...current,
          response: result.response!,
          respondedAt: current.respondedAt ?? new Date().toISOString(),
          completeAccessConfirmed: result.completeAccessConfirmed ?? current.completeAccessConfirmed,
        } : current);
      }
    }
    setPending(false);
  }

  if (state === "loading") return <main className={styles.state}><h1>Opening this introduction…</h1><p>We are checking that you are one of the two customers in this introduction.</p></main>;
  if (state === "signed-out") return <main className={styles.state}><h1>Sign in to view this introduction</h1><p>Broker introductions are visible only to the two customers selected by the broker. The URL alone never grants access.</p><a href={`/login?redirect=${encodeURIComponent(`/introductions/${introductionRef}`)}`}>Sign in to VivIntro</a></main>;
  if (state === "unavailable" || !introduction) return <main className={styles.state}><h1>This introduction is unavailable</h1><p>It may have expired or been withdrawn. Ask the broker who shared it for a current link.</p></main>;

  const photos: PortfolioPhoto[] = introduction.media.map((item) => ({
    id: item.key,
    src: item.accessPath,
    alt: item.altText || "Portfolio photo",
    mediaType: item.mediaType,
    width: item.width,
    height: item.height,
    aspectRatio: item.aspectRatio,
    orientation: item.orientation || "unknown",
    presentation: item.presentation,
  }));
  const horoscope: PortfolioHoroscopeAttachment | undefined = introduction.horoscope ? {
    href: introduction.horoscope.accessPath,
    formatLabel: introduction.horoscope.fileExtension.toUpperCase(),
    languageLabel: introduction.horoscope.languageLabel,
    pageCount: introduction.horoscope.pageCount,
  } : undefined;
  const needsLegacyConsentConfirmation = introduction.response === "accepted"
    && !introduction.completeAccessConfirmed;

  return <div className={styles.shell}>
    <aside className={styles.banner}>
      <strong>{introduction.disclosureLevel === "complete" ? "Complete Portfolio · mutual interest confirmed" : "Broker Standard Profile · trusted broker introduction"}</strong>
      <span>{introduction.disclosureLevel === "complete"
        ? `Both customers chose Interested. Protected Contact is available until ${new Date(introduction.expiresAt).toLocaleDateString()}. Version ${introduction.versionNumber} remains fixed.`
        : `Shared through your broker with contact, financial and other protected details kept private. Version ${introduction.versionNumber} remains fixed for this introduction.`}</span>
    </aside>
    <BiodataTemplate
      templateId={introduction.templateId}
      data={introduction.data}
      sunSign={introduction.sunSign}
      accessMode="approved"
      accessExpiresAt={introduction.expiresAt}
      photos={photos}
      horoscopeAttachment={horoscope}
      interestAction={<section className={styles.response}>
        <h2>Your response</h2>
        {needsLegacyConsentConfirmation ? <form onSubmit={respond}>
          <p>Your earlier Interested response was recorded before this disclosure rule existed. Confirm the updated meaning before Complete Portfolio access can begin.</p>
          <input type="hidden" name="response" value="accepted" />
          <input type="hidden" name="comment" value={introduction.responseComment ?? ""} />
          <label><input required type="checkbox" name="confirmCompleteAccess" /> I understand that if the other customer also chooses Interested, we will each see the other customer’s Complete Portfolio, including Protected Contact, for 30 days.</label>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button disabled={pending} type="submit">{pending ? "Recording…" : "Confirm Interested terms"}</button>
        </form> : introduction.response ? <p className={styles.recorded}>Response recorded: <strong>{introduction.response}</strong>. {introduction.disclosureLevel === "complete" ? "Both customers are interested, so the Complete Portfolio and Protected Contact are now available for 30 days." : "Protected Contact remains hidden unless the other customer also chooses Interested."}</p> : <form onSubmit={respond}>
          <p>Choose one response. Your broker can see it. Protected Contact remains hidden unless both customers choose Interested.</p>
          <label><input required type="radio" name="response" value="accepted" onChange={() => setSelectedResponse("accepted")} /> Interested in continuing</label>
          <label><input required type="radio" name="response" value="declined" onChange={() => setSelectedResponse("declined")} /> Decline respectfully</label>
          {selectedResponse === "accepted" && <label><input required type="checkbox" name="confirmCompleteAccess" /> I understand that if the other customer also chooses Interested, we will each see the other customer’s Complete Portfolio, including Protected Contact, for 30 days.</label>}
          <label>Optional note<textarea name="comment" maxLength={1000} rows={4} /></label>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button disabled={pending} type="submit">{pending ? "Recording…" : "Submit response"}</button>
        </form>}
      </section>}
    />
  </div>;
}
