"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { hardestStepLabels, likedAspectLabels } from "@/features/feedback/onboarding-feedback-options";

type Feedback = { easeRating: number; hardestSteps: string[]; likedAspects: string[]; comment: string | null; submittedAt: string };

function labelsFor(values: string[], labels: Record<string, string>) {
  return values.map((value) => labels[value] ?? value).join(", ");
}

export default function OnboardingFeedbackAdminClient() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/onboarding-feedback", { cache: "no-store" });
      const body = await response.json() as { feedback?: Feedback[]; error?: string };
      if (!response.ok || !Array.isArray(body.feedback)) throw new Error(body.error ?? "Could not load feedback.");
      setItems(body.feedback);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load feedback.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- load synchronizes the authorized API projection.

  const average = items.length ? (items.reduce((sum, item) => sum + item.easeRating, 0) / items.length).toFixed(1) : "—";

  return <main id="main-content" className="pilot-access-shell min-h-screen bg-[light-dark(#f8f6f0,var(--app-dark-canvas))] px-4 py-8 text-[light-dark(#18272e,var(--app-dark-ink))] sm:py-12">
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[light-dark(#d8d8d2,var(--app-dark-border))] pb-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[light-dark(#477b77,var(--app-dark-accent))]">VivIntro operations</p><h1 className="mt-2 font-[family-name:var(--font-portfolio-display)] text-4xl">Creator feedback</h1><p className="mt-2 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">Private responses from people who completed their portfolio details. No public profile data is shown here.</p></div>
        <div className="flex gap-2"><ThemeSwitch /><button type="button" className="dashboard-secondary-action" onClick={() => void load()} disabled={loading}>Refresh</button><Link href="/dashboard" className="dashboard-secondary-action">Dashboard</Link></div>
      </header>
      <div className="mt-6 flex flex-wrap gap-3"><div className="dashboard-glass min-w-40 rounded-xl p-4"><p className="text-sm">Responses shown</p><strong className="text-2xl">{items.length}</strong></div><div className="dashboard-glass min-w-40 rounded-xl p-4"><p className="text-sm">Average ease, 1–5</p><strong className="text-2xl">{average}</strong></div></div>
      {error && <p role="alert" className="mt-5 text-sm text-[light-dark(#8c3027,var(--app-dark-danger))]">{error}</p>}
      {loading ? <p role="status" className="mt-8">Loading feedback…</p> : items.length === 0 ? <p className="mt-8 text-sm">No feedback has been submitted yet.</p> : <div className="mt-6 grid gap-3">{items.map((item, index) => <article key={`${item.submittedAt}-${index}`} className="dashboard-glass rounded-xl p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>Ease {item.easeRating}/5</strong><time dateTime={item.submittedAt}>{new Date(item.submittedAt).toLocaleDateString()}</time></div><p className="mt-2 text-sm"><span className="font-semibold">Hardest:</span> {labelsFor(item.hardestSteps, hardestStepLabels)}</p><p className="mt-1 text-sm"><span className="font-semibold">Liked:</span> {item.likedAspects.length ? labelsFor(item.likedAspects, likedAspectLabels) : "No choices selected"}</p>{item.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.comment}</p>}</article>)}</div>}
    </div>
  </main>;
}
