"use client";

import { useEffect, useState } from "react";
import { hardestStepLabels, hardestStepValues, likedAspectLabels, likedAspectValues } from "@/features/feedback/onboarding-feedback-options";

function selectionSummary(values: string[], labels: Record<string, string>, emptyLabel: string) {
  if (values.length === 0) return emptyLabel;
  if (values.length === 1) return labels[values[0]] ?? emptyLabel;
  return `${values.length} selected`;
}

export function CreatorOnboardingFeedback() {
  const [view, setView] = useState<"loading" | "form" | "thank-you" | "hidden">("loading");
  const [rating, setRating] = useState(0);
  const [hardestSteps, setHardestSteps] = useState<string[]>([]);
  const [likedAspects, setLikedAspects] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/portfolio/onboarding-feedback", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json().catch(() => null) as { feedback: unknown } | null : null)
      .then((body) => {
        if (active) setView(body ? body.feedback ? "hidden" : "form" : "hidden");
      }).catch(() => { if (active) setView("hidden"); });
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
        body: JSON.stringify({ easeRating: rating, hardestSteps, likedAspects, comment }),
      });
      if (response.status === 409) {
        setView("thank-you");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "We could not save your feedback. Please try again.");
      }
      setView("thank-you");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not save your feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggleHardestStep(value: string) {
    setMessage("");
    setHardestSteps((current) => {
      if (current.includes(value)) return current.filter((step) => step !== value);
      return value === "none" ? [value] : [...current.filter((step) => step !== "none"), value];
    });
  }

  function toggleLikedAspect(value: string) {
    setMessage("");
    setLikedAspects((current) => current.includes(value) ? current.filter((aspect) => aspect !== value) : [...current, value]);
  }

  if (view === "loading" || view === "hidden") return null;
  if (view === "thank-you") return <section className="dashboard-glass mt-6 rounded-xl p-5 sm:p-6" aria-live="polite">
    <h2 className="font-[family-name:var(--font-portfolio-display)] text-2xl">Thank you for helping us improve VivIntro.</h2>
    <p className="mt-2 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">Your private response has been received. This survey will not appear again.</p>
  </section>;

  return <section className="dashboard-glass mt-6 rounded-xl p-5 sm:p-6" aria-labelledby="creator-feedback-heading">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[light-dark(#477b77,var(--app-dark-accent))]">Optional feedback</p>
    <h2 id="creator-feedback-heading" className="mt-2 font-[family-name:var(--font-portfolio-display)] text-2xl">How was creating your portfolio?</h2>
    <p className="mt-2 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">One private response helps us improve the next person&apos;s experience. You can send it once, and it never appears on your portfolio.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-5 grid max-w-2xl gap-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">How easy was it overall?</legend>
        <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="cursor-pointer rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] px-3 py-2 text-sm has-[:checked]:border-[color:var(--workspace-teal)] has-[:checked]:bg-[light-dark(#e8f3ef,var(--app-dark-surface-soft))]"><input className="mr-2" type="radio" name="ease" value={value} checked={rating === value} onChange={() => { setRating(value); setMessage(""); }} disabled={busy} required />{value}</label>)}</div>
        <p className="text-xs text-[light-dark(#64748b,var(--app-dark-muted))]">1 = difficult · 5 = easy</p>
      </fieldset>
      <div className="grid gap-2 text-sm">
        <span id="hardest-steps-label" className="font-semibold">Which steps were hardest?</span>
        <details className="group rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-canvas))]">
          <summary aria-labelledby="hardest-steps-label hardest-steps-summary" className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--workspace-teal)] [&::-webkit-details-marker]:hidden"><span id="hardest-steps-summary">{selectionSummary(hardestSteps, hardestStepLabels, "Select one or more")}</span><span aria-hidden="true" className="text-xs group-open:rotate-180">⌄</span></summary>
          <div role="group" aria-labelledby="hardest-steps-label" className="grid gap-1 border-t border-[light-dark(#d8d8d2,var(--app-dark-border))] p-2">{hardestStepValues.map((value) => <label key={value} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1 hover:bg-[light-dark(#edf4f1,var(--app-dark-surface-soft))]"><input type="checkbox" checked={hardestSteps.includes(value)} onChange={() => toggleHardestStep(value)} disabled={busy} />{hardestStepLabels[value]}</label>)}</div>
        </details>
        <p className="text-xs text-[light-dark(#64748b,var(--app-dark-muted))]">Choose all that apply. “Nothing stood out” clears other choices.</p>
      </div>
      <div className="grid gap-2 text-sm">
        <span id="liked-aspects-label" className="font-semibold">What did you like? <span className="font-normal">(optional)</span></span>
        <details className="group rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-canvas))]">
          <summary aria-labelledby="liked-aspects-label liked-aspects-summary" className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--workspace-teal)] [&::-webkit-details-marker]:hidden"><span id="liked-aspects-summary">{selectionSummary(likedAspects, likedAspectLabels, "Select any you liked")}</span><span aria-hidden="true" className="text-xs group-open:rotate-180">⌄</span></summary>
          <div role="group" aria-labelledby="liked-aspects-label" className="grid gap-1 border-t border-[light-dark(#d8d8d2,var(--app-dark-border))] p-2">{likedAspectValues.map((value) => <label key={value} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1 hover:bg-[light-dark(#edf4f1,var(--app-dark-surface-soft))]"><input type="checkbox" checked={likedAspects.includes(value)} onChange={() => toggleLikedAspect(value)} disabled={busy} />{likedAspectLabels[value]}</label>)}</div>
        </details>
      </div>
      <label className="grid gap-2 text-sm font-semibold">What would make it better? <span className="font-normal">(optional)</span>
        <textarea value={comment} onChange={(event) => { setComment(event.target.value); setMessage(""); }} disabled={busy} maxLength={1000} rows={3} className="rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-canvas))] p-3 text-sm font-normal" placeholder="Tell us where you paused or felt unsure." />
      </label>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={busy || rating === 0 || hardestSteps.length === 0} className="dashboard-primary-action">{busy ? "Sending…" : "Send feedback"}</button><span role="status" className="text-sm">{message}</span></div>
    </form>
  </section>;
}
