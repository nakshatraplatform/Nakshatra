"use client";

import { useEffect, useState } from "react";
import { interestDetailsSchema, type InterestDetails } from "@/features/interest/server/interest-dashboard.contract";

function timestamp(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded"; }
function text(value: unknown) { return typeof value === "string" ? value : "Not provided"; }
function location(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Not provided";
  const record = value as Record<string, unknown>;
  return [record.city, record.state, record.country].filter(item => typeof item === "string" && item.trim()).join(", ") || (typeof record.location === "string" && record.location.trim() ? record.location : "Not provided");
}

export function InterestDetailsPanel({ requestId }: { requestId: string }) {
  const [expanded, setExpanded] = useState(false);
  return <section><button type="button" className="dashboard-secondary-action" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide interest details" : "View Interest Details"}</button>{expanded && <SubmittedInterestDetails requestId={requestId} />}</section>;
}

function SubmittedInterestDetails({ requestId }: { requestId: string }) {
  const [result, setResult] = useState<{ id: string; details?: InterestDetails; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/interest/${encodeURIComponent(requestId)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const body = await response.json();
      const parsed = interestDetailsSchema.safeParse(body.details);
      if (!controller.signal.aborted) setResult(response.ok && parsed.success ? { id: requestId, details: parsed.data } : { id: requestId, error: "We could not load the submitted details. Try again." });
    }).catch(() => { if (!controller.signal.aborted) setResult({ id: requestId, error: "We could not load the submitted details. Try again." }); });
    return () => controller.abort();
  }, [requestId, attempt]);
  if (!result || result.id !== requestId) return <p role="status">Loading interest details…</p>;
  if (!result.details) return <p role="alert">{result.error} <button type="button" className="dashboard-secondary-action" onClick={() => setAttempt(value => value + 1)}>Retry</button></p>;
  const details = result.details;
  const metadata = details.metadata || {};
  const candidate = metadata.candidate && typeof metadata.candidate === "object" && !Array.isArray(metadata.candidate) ? metadata.candidate as Record<string, unknown> : null;
  return <section className="dashboard-record-detail" aria-label="View Interest Details">
    <h3>Submitted interest details</h3>
    <dl className="dashboard-detail-grid">
      {[ ["Name", details.name], ["Email", details.email], ["Phone", details.phone], ["Contacting for", metadata.profile_for], ["Location", location(metadata.location_details || metadata)], ["Submitted at", timestamp(details.submittedAt)], ["Email verified at", timestamp(details.verifiedAt)], ["Access granted at", timestamp(details.accessGrantedAt)], ["Current access status", details.accessStatus.replaceAll("_", " ")], ["Request status", details.requestStatus], ["Profession", metadata.profession], ["Core values", metadata.coreValues] ].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{text(value)}</dd></div>)}
    </dl>
    {candidate && <section><h3>Candidate details</h3><dl className="dashboard-detail-grid">{[["Name",candidate.name],["Email",candidate.email],["Phone",candidate.phone],["Viewer’s relationship to candidate",candidate.relationship],["Location",location(candidate.location)]].map(([label,value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{text(value)}</dd></div>)}</dl></section>}
    <section><h3>Family context</h3><p>{details.familyContext || "Not provided"}</p></section>
    <section><h3>Message</h3><p>{details.message || "Not provided"}</p></section>
    {details.history.length > 0 && <section><h3>Access history</h3><ol className="dashboard-detail-history">{details.history.map(event => <li key={event.id}><span>{event.eventType.replaceAll("_", " ")}</span><time dateTime={event.createdAt}>{timestamp(event.createdAt)}</time></li>)}</ol></section>}
  </section>;
}
