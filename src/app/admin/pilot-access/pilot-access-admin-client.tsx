"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, ShieldCheck, UserX } from "lucide-react";
import type {
  PilotAdminFilter,
  PilotAdminRequest,
  ReviewPilotAccessCommand,
} from "@/features/pilot-access/server/pilot-access.contract";

type Failure = { error?: string };
const filters: PilotAdminFilter[] = ["pending", "approved", "declined", "revoked", "all"];

export default function PilotAccessAdminClient() {
  const [filter, setFilter] = useState<PilotAdminFilter>("pending");
  const [requests, setRequests] = useState<PilotAdminRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pilot-access?status=${filter}`, { cache: "no-store" });
      const body = await response.json().catch(() => null) as { requests?: PilotAdminRequest[] } & Failure | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not load pilot requests.");
      setRequests(body?.requests ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load pilot requests.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the queue is synchronized from an external authorized API.
    void load();
  }, [load]);

  async function decide(request: PilotAdminRequest, decision: ReviewPilotAccessCommand["decision"]) {
    const label = decision === "approve" ? "grant creator access" : decision === "revoke" ? "remove creator access" : "decline this request";
    if (!window.confirm(`Confirm that you want to ${label} for ${request.verifiedEmail}.`)) return;
    setBusyRef(request.requestRef);
    setError(null);
    try {
      const response = await fetch("/api/admin/pilot-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestRef: request.requestRef,
          decision,
          reviewNote: notes[request.requestRef]?.trim() || null,
          idempotencyKey: `pilot-review:${crypto.randomUUID()}`,
        } satisfies ReviewPilotAccessCommand),
      });
      const body = await response.json().catch(() => null) as Failure | null;
      if (!response.ok) throw new Error(body?.error ?? "The decision could not be saved.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be saved.");
    } finally {
      setBusyRef(null);
    }
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#f8f6f0] px-4 py-8 text-[#18272e] sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 border-b border-[#d8d8d2] pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#477b77]">Nakshatra operations</p>
            <h1 className="mt-2 font-[family-name:var(--font-portfolio-display)] text-4xl font-medium sm:text-5xl">Pilot access review</h1>
            <p className="mt-3 max-w-2xl text-slate-600">Review verified applicants. Approval grants creator capability; decline and revoke never delete account data.</p>
          </div>
          <Link href="/dashboard" className="dashboard-secondary-action">Dashboard</Link>
        </header>

        <nav aria-label="Request status" className="my-7 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => <button key={item} onClick={() => setFilter(item)} aria-current={filter === item ? "page" : undefined} className={filter === item ? "dashboard-primary-action capitalize" : "dashboard-secondary-action capitalize"}>{item}</button>)}
          <button onClick={() => void load()} disabled={loading} aria-label="Refresh requests" className="dashboard-secondary-action ml-auto"><RefreshCw aria-hidden className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </nav>

        {error ? <div role="alert" className="mb-5 border-l-4 border-[#b7483e] bg-[#f8e6e2] p-4 text-sm text-[#7d302b]">{error}</div> : null}
        {loading ? <p role="status" className="py-16 text-center text-slate-600">Loading verified requests…</p> : requests.length === 0 ? (
          <section className="rounded-xl border border-[#d0d3ce] bg-[#fffdf8] px-6 py-16 text-center"><ShieldCheck aria-hidden className="mx-auto h-8 w-8 text-[#477b77]" /><h2 className="mt-4 text-xl font-semibold">No {filter === "all" ? "pilot" : filter} requests</h2><p className="mt-2 text-slate-600">There is nothing requiring action in this view.</p></section>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <article key={request.requestRef} className="rounded-xl border border-[#d0d3ce] bg-[#fffdf8] p-5 shadow-[0_10px_30px_rgb(29_52_58/0.05)] sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{request.displayName}</h2><span className="rounded-full bg-[#e9e2cf] px-2.5 py-1 text-xs font-semibold capitalize text-[#725d2b]">{request.status}</span></div>
                    <p className="mt-2 break-all text-sm text-slate-700">{request.verifiedEmail}</p>
                    {request.phoneE164 ? <p className="mt-1 text-sm text-slate-600">{request.phoneE164}</p> : null}
                    <p className="mt-3 text-xs text-slate-500">Submitted {new Date(request.submittedAt).toLocaleString()}</p>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold">Internal review note <span className="font-normal text-slate-500">Optional · 500 characters</span>
                    <textarea maxLength={500} rows={3} value={notes[request.requestRef] ?? request.reviewNote ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [request.requestRef]: event.target.value }))} className="rounded-lg border border-[#adb8ba] bg-white p-3 font-normal outline-none focus:border-[#477b77] focus:ring-2 focus:ring-[#477b77]/20" />
                  </label>
                  <div className="flex min-w-44 flex-col gap-2">
                    {request.status === "pending" ? <>
                      <button disabled={busyRef === request.requestRef} onClick={() => void decide(request, "approve")} className="dashboard-primary-action"><Check aria-hidden className="h-4 w-4" />Approve</button>
                      <button disabled={busyRef === request.requestRef} onClick={() => void decide(request, "decline")} className="dashboard-danger-action"><UserX aria-hidden className="h-4 w-4" />Decline</button>
                    </> : null}
                    {request.status === "approved" ? <button disabled={busyRef === request.requestRef} onClick={() => void decide(request, "revoke")} className="dashboard-danger-action"><UserX aria-hidden className="h-4 w-4" />Revoke access</button> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
