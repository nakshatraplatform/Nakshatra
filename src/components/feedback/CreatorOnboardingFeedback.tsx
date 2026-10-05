"use client";

import { useEffect, useState } from "react";

type SavedFeedback = {
  easeRating: number;
  hardestStep: string;
  comment: string | null;
};

const steps = [
  ["none", "Nothing stood out"],
  ["details", "Writing my details"],
  ["photos", "Adding photos"],
  ["verification", "Liveness and IP checks"],
  ["publishing", "Understanding publishing"],
  ["other", "Something else"],
] as const;

export function CreatorOnboardingFeedback() {
  const [saved, setSaved] = useState(false);
  const [rating, setRating] = useState(0);
  const [step, setStep] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/portfolio/onboarding-feedback", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json().catch(() => null) as { feedback: SavedFeedback | null } | null : null)
      .then((body) => {
        if (!active || !body?.feedback) return;
        setRating(body.feedback.easeRating);
        setStep(body.feedback.hardestStep);
        setComment(body.feedback.comment ?? "");
        setSaved(true);
      }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/portfolio/onboarding-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ easeRating: rating, hardestStep: step, comment }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "We could not save your feedback. Please try again.");
      }
      setSaved(true);
      setMessage("Thank you. Your feedback is private and helps us improve onboarding.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not save your feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="dashboard-glass mt-6 rounded-xl p-5 sm:p-6" aria-labelledby="creator-feedback-heading">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[light-dark(#477b77,var(--app-dark-accent))]">Optional feedback</p>
    <h2 id="creator-feedback-heading" className="mt-2 font-[family-name:var(--font-portfolio-display)] text-2xl">How was creating your portfolio?</h2>
    <p className="mt-2 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">Two quick answers help us improve the next person&apos;s experience. This is private and never appears on your portfolio.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-5 grid max-w-2xl gap-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">How easy was it overall?</legend>
        <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="cursor-pointer rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] px-3 py-2 text-sm has-[:checked]:border-[color:var(--workspace-teal)] has-[:checked]:bg-[light-dark(#e8f3ef,var(--app-dark-surface-soft))]"><input className="mr-2" type="radio" name="ease" value={value} checked={rating === value} onChange={() => setRating(value)} required />{value}</label>)}</div>
        <p className="text-xs text-[light-dark(#64748b,var(--app-dark-muted))]">1 = difficult · 5 = easy</p>
      </fieldset>
      <label className="grid gap-2 text-sm font-semibold">Which step was hardest?
        <select required value={step} onChange={(event) => setStep(event.target.value)} className="min-h-11 rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-canvas))] px-3 text-sm font-normal">
          <option value="">Choose one</option>
          {steps.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">What would make it better? <span className="font-normal">(optional)</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} className="rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-canvas))] p-3 text-sm font-normal" placeholder="Tell us where you paused or felt unsure." />
      </label>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={busy || rating === 0 || !step} className="dashboard-primary-action">{busy ? "Saving…" : saved ? "Update feedback" : "Send feedback"}</button><span role="status" className="text-sm">{message}</span></div>
    </form>
  </section>;
}
