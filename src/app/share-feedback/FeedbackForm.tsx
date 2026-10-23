"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import styles from "./feedback.module.css";

type Feedback = {
  audience: "creator" | "viewer" | "family" | "other";
  experience: string;
  improvement: string;
  creditName: string;
  contactEmail: string;
  contactPermission: boolean;
  website: string;
};

const initial: Feedback = { audience: "creator", experience: "", improvement: "", creditName: "", contactEmail: "", contactPermission: false, website: "" };

export function FeedbackForm() {
  const [form, setForm] = useState<Feedback>(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/landing-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, creditName: form.contactPermission ? form.creditName : "", contactEmail: form.contactPermission ? form.contactEmail : "" }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || "We could not save your feedback. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("We could not connect. Please check your connection and try again.");
    } finally { setBusy(false); }
  }

  return <main id="main-content" className={styles.page}>
    <header className={styles.header}><VivIntroBrand href="/" variant="horizontal" /><ThemeSwitch /></header>
    <div className={styles.shell}>
      <Link href="/#testimonials" className={styles.back}><ArrowLeft aria-hidden="true" /> Back to VivIntro</Link>
      {sent ? <section className={styles.confirmation} role="status"><h1>Thank you for sharing.</h1><p>Your feedback was received privately. Nothing you wrote will appear on VivIntro without a separate review and your approval.</p><Link href="/" className={styles.button}>Return to home</Link></section> : <>
        <div className={styles.intro}><h1>Help make introductions clearer.</h1><p>Whether you created an introduction or received a Vivara link, we would like to hear what worked and what could be better.</p><p className={styles.privacy}>Please do not include phone numbers, addresses, passwords, or anyone else’s private details.</p></div>
        <form className={styles.form} onSubmit={submit}>
          <label>Which best describes you?<select value={form.audience} onChange={event => setForm({ ...form, audience: event.target.value as Feedback["audience"] })}><option value="creator">I created an introduction</option><option value="viewer">I received a Vivara link</option><option value="family">I helped a family member</option><option value="other">Other</option></select></label>
          <label>What was your experience?<textarea required minLength={10} maxLength={800} rows={5} value={form.experience} onChange={event => setForm({ ...form, experience: event.target.value })} aria-describedby="experience-help" /></label>
          <p id="experience-help" className={styles.help}>What felt useful, confusing, or different from sending a PDF?</p>
          <label>What should we improve? <span>(optional)</span><textarea maxLength={800} rows={3} value={form.improvement} onChange={event => setForm({ ...form, improvement: event.target.value })} /></label>
          <div className={styles.permission}><label className={styles.checkbox}><input type="checkbox" checked={form.contactPermission} onChange={event => setForm({ ...form, contactPermission: event.target.checked, contactEmail: event.target.checked ? form.contactEmail : "", creditName: event.target.checked ? form.creditName : "" })} /><span>VivIntro may contact me about using part of my feedback as a testimonial. Nothing will be published without my separate approval.</span></label></div>
          {form.contactPermission && <div className={styles.contact}><label>Your email <input required type="email" autoComplete="email" maxLength={254} value={form.contactEmail} onChange={event => setForm({ ...form, contactEmail: event.target.value })} /></label><label>How should we address you? <span>(optional)</span><input maxLength={80} autoComplete="name" value={form.creditName} onChange={event => setForm({ ...form, creditName: event.target.value })} /></label></div>}
          <div className={styles.honeypot} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} /></label></div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.button} type="submit" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
          <p className={styles.disclosure}>Feedback is stored privately for product research, not added to a Vivara link. Our retention job is set to remove submissions older than 180 days. <Link href="/privacy">Privacy policy</Link></p>
        </form>
      </>}
    </div>
  </main>;
}
