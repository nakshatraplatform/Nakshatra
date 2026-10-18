"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { z } from "zod/v4";
import { interestHistorySchema } from "@/features/interest/server/interest-dashboard.contract";
import { InterestDetailsPanel } from "./InterestDetailsPanel";
import { interestStatusLabel } from "@/features/interest/presentation";

export function InterestHistoryPanel() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ offset: number; items?: z.infer<typeof interestHistorySchema>; error?: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch(`/api/interest?offset=${offset}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      const parsed = interestHistorySchema.safeParse(body.interests);
      if (!response.ok || !parsed.success) throw new Error("History unavailable");
      if (!controller.signal.aborted) setResult({ offset, items: parsed.data });
    }).catch(() => { if (!controller.signal.aborted) setResult({ offset, error: "Interest history is temporarily unavailable." }); });
    return () => controller.abort();
  }, [open, offset, attempt]);
  const loading = !result || result.offset !== offset;
  return <section className="dashboard-interest-history"><button type="button" className="dashboard-secondary-action" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "Hide interest history" : "View all interest submissions"}</button>{open && <div>
    <h3>Interest history</h3><p>Ending a 15-day sharing period or stopping sharing does not delete the submitted interest. You can reopen details kept in your history; deleted or anonymized details are no longer available. <Link href="/privacy#retention" className="workspace-focus font-semibold text-[color:var(--workspace-teal)] underline underline-offset-4">How long interest details are kept</Link>.</p>
    {loading ? <p role="status">Loading interest history…</p> : result.error ? <p role="alert">{result.error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></p> : <>
      {!result.items?.length && <p>No more submissions.</p>}
      {result.items?.map(item => <article key={item.id}><h4>{item.name || "Viewer"}</h4><p>{new Date(item.submittedAt).toLocaleString()} · {interestStatusLabel(item.status)}</p><InterestDetailsPanel requestId={item.id} /></article>)}
      <div role="group" aria-label="Interest history pages"><button type="button" className="dashboard-secondary-action" disabled={offset===0} onClick={() => setOffset(value => Math.max(0,value-25))}>Previous</button><span>Page {offset / 25 + 1}</span><button type="button" className="dashboard-secondary-action" disabled={(result.items?.length || 0)<25 || offset>=100000} onClick={() => setOffset(value => value+25)}>Next</button></div>
    </>}
  </div>}</section>;
}
