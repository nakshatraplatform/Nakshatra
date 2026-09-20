"use client";

import { ThemeSwitch } from "@/components/theme/ThemeSwitch";


import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import type { PilotAdminRequest } from "@/features/pilot-access/server/pilot-access.contract";

type Failure = { error?: string };

export default function PilotAccessAdminClient() {
  const [requests, setRequests] = useState<PilotAdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/pilot-access?status=pending", { cache: "no-store" });
      const body = await response.json().catch(() => null) as { requests?: PilotAdminRequest[] } & Failure | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not load the waitlist.");
      setRequests(body?.requests ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the waitlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronized from an authorized API.
    void load();
  }, [load]);

  return (
    <main id="main-content" className="min-h-screen bg-[light-dark(#f8f6f0,var(--app-dark-canvas))] px-4 py-8 text-[light-dark(#18272e,var(--app-dark-ink))] sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 border-b border-[light-dark(#d8d8d2,var(--app-dark-border))] pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[light-dark(#477b77,var(--app-dark-accent))]">VivIntro operations</p>
            <h1 className="mt-2 font-[family-name:var(--font-portfolio-display)] text-4xl font-medium sm:text-5xl">Launch waitlist</h1>
            <p className="mt-3 max-w-2xl text-[light-dark(#475569,var(--app-dark-muted))]">Verified people who asked to hear when signup opens. Waitlist entries never grant portfolio access.</p>
          </div>
          <div className="flex gap-2"><ThemeSwitch />
            <button onClick={() => void load()} disabled={loading} aria-label="Refresh waitlist" className="dashboard-secondary-action"><RefreshCw aria-hidden className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
            <Link href="/dashboard" className="dashboard-secondary-action">Dashboard</Link>
          </div>
        </header>

        {error ? <div role="alert" className="mt-7 border-l-4 border-[light-dark(#b7483e,var(--app-dark-border))] bg-[light-dark(#f8e6e2,var(--app-dark-danger-surface))] p-4 text-sm text-[light-dark(#7d302b,var(--app-dark-danger))]">{error}</div> : null}
        {loading ? <p role="status" className="py-16 text-center text-[light-dark(#475569,var(--app-dark-muted))]">Loading waitlist…</p> : requests.length === 0 ? (
          <section className="mt-7 rounded-xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] px-6 py-16 text-center"><ShieldCheck aria-hidden className="mx-auto h-8 w-8 text-[light-dark(#477b77,var(--app-dark-accent))]" /><h2 className="mt-4 text-xl font-semibold">No waitlist entries yet</h2><p className="mt-2 text-[light-dark(#475569,var(--app-dark-muted))]">New verified submissions will appear here.</p></section>
        ) : (
          <div className="mt-7 grid gap-4">
            {requests.map((request) => (
              <article key={request.requestRef} className="rounded-xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] p-5 shadow-[0_10px_30px_rgb(29_52_58/0.05)] sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div><h2 className="text-lg font-semibold">{request.displayName}</h2><p className="mt-2 break-all text-sm text-[light-dark(#334155,var(--app-dark-ink))]">{request.verifiedEmail}</p>{request.phoneE164 ? <p className="mt-1 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">{request.phoneE164}</p> : null}</div>
                  <p className="text-xs text-[light-dark(#64748b,var(--app-dark-muted))]">Joined {new Date(request.submittedAt).toLocaleString()}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
