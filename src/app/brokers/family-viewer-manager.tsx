"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Copy, MessageCircle, ShieldOff, Star, UserRoundPlus, UsersRound, X } from "lucide-react";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import {
  createFamilyViewer,
  decideFamilyViewerProposal,
  revokeFamilyViewer,
  setPrimaryFamilyViewer,
} from "@/features/family-viewers/client/family-viewer.api";
import type { CandidateFamilyRoster } from "@/features/family-viewers/server/family-viewer.contract";
import styles from "./brokers.module.css";

type AvailableRoster = Extract<CandidateFamilyRoster, { available: true }>;
type Viewer = AvailableRoster["viewers"][number];

function relationshipLabel(viewer: Viewer) {
  return viewer.relationshipLabel || viewer.relationshipKind;
}

export function FamilyViewerManager({ roster }: { roster: AvailableRoster }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  function finish(messageText: string) {
    setMessage(messageText);
    router.refresh();
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("add"); setMessage(""); setFallbackUrl(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const kind = String(form.get("relationshipKind") || "");
    try {
      const result = await createFamilyViewer({
        email: String(form.get("email") || ""),
        displayName: String(form.get("displayName") || ""),
        relationshipKind: kind,
        relationshipLabel: kind === "other" ? String(form.get("relationshipLabel") || "").trim() || null : null,
        preferredLocale: null,
        idempotencyKey: `family-create:${crypto.randomUUID()}`,
      });
      formElement.reset();
      setFallbackUrl(result.invitationUrl);
      finish(result.emailStatus === "sent"
        ? "Invitation sent. You may also share the same private link in your trusted family WhatsApp chat."
        : "The invitation is ready, but email delivery is unavailable. Copy the private link below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The family representative could not be invited.");
    } finally { setPending(null); }
  }

  async function decide(viewer: Viewer, decision: "approve" | "reject", form?: HTMLFormElement) {
    if (decision === "reject" && !window.confirm("Do not approve this family representative? The broker cannot undo your decision.")) return;
    setPending(viewer.viewerRef); setMessage(""); setFallbackUrl(null);
    try {
      const result = decision === "approve"
        ? await decideFamilyViewerProposal(viewer.viewerRef, {
          decision,
          email: String(new FormData(form).get("email") || ""),
          idempotencyKey: `family-decision:${crypto.randomUUID()}`,
        })
        : await decideFamilyViewerProposal(viewer.viewerRef, {
          decision,
          idempotencyKey: `family-decision:${crypto.randomUUID()}`,
        });
      if (result.invitationUrl) setFallbackUrl(result.invitationUrl);
      finish(decision === "reject"
        ? "The proposal was not approved."
        : result.emailStatus === "sent"
          ? "Approved and invited. You may also share the private link in your trusted family WhatsApp chat."
          : "Approved, but email delivery is unavailable. Copy the private link below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The decision could not be saved.");
    } finally { setPending(null); }
  }

  async function makePrimary(viewer: Viewer) {
    setPending(viewer.viewerRef); setMessage("");
    try { await setPrimaryFamilyViewer(viewer.viewerRef, viewer.rowVersion); finish(`${viewer.displayName} is now your primary family representative.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The primary representative could not be changed."); }
    finally { setPending(null); }
  }

  async function revoke(viewer: Viewer) {
    if (!window.confirm(`Remove ${viewer.displayName}'s family access? This takes effect immediately.`)) return;
    setPending(viewer.viewerRef); setMessage("");
    try { await revokeFamilyViewer(viewer.viewerRef, viewer.rowVersion); finish("Family access removed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Family access could not be removed."); }
    finally { setPending(null); }
  }

  return <section className={styles.familySection} aria-labelledby="family-viewers-title">
    <div className={styles.familyHeading}><div className={styles.icon}><UsersRound /></div><div><p className={styles.eyebrow}>Broker-linked profiles only</p><h2 id="family-viewers-title">Family representatives</h2><p>Up to three people can help review broker introductions. Family Viewer access is view-only.</p></div><span className={styles.status}>{roster.activeCount} of 3 active</span></div>
    <form className={styles.familyForm} onSubmit={add}>
      <label>Name<input name="displayName" required maxLength={120} autoComplete="name" /></label>
      <label>Google email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label>Relationship<select name="relationshipKind" defaultValue="parent"><option value="father">Father</option><option value="mother">Mother</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="guardian">Guardian</option><option value="relative">Relative</option><option value="other">Other</option></select></label>
      <label>Details <span>Only for “Other”</span><input name="relationshipLabel" maxLength={40} /></label>
      <button disabled={pending !== null} type="submit"><UserRoundPlus /> {pending === "add" ? "Inviting…" : "Invite family representative"}</button>
    </form>
    {pending === "add" && <LoadingStatus compact title="Creating the private family invitation" />}
    {message && <p className={styles.familyMessage} role="status">{message}</p>}
    {fallbackUrl && <div className={styles.fallback}><code>{fallbackUrl}</code><div className={styles.fallbackActions}><button type="button" onClick={() => navigator.clipboard.writeText(fallbackUrl)}><Copy /> Copy private link</button><a href={`https://wa.me/?text=${encodeURIComponent(`You have been invited as a family viewer on VivIntro. Open this private link with the same Google email address: ${fallbackUrl}`)}`} target="_blank" rel="noreferrer"><MessageCircle /> Share on WhatsApp</a></div></div>}
    <div className={styles.familyRoster}>{roster.viewers.length === 0 ? <p className={styles.empty}>No family representatives have been added.</p> : roster.viewers.map((viewer) => <article key={viewer.viewerRef}>
      <div className={styles.familyPerson}><strong>{viewer.displayName}{viewer.role === "primary" && <span><Star /> Primary</span>}</strong><small>{relationshipLabel(viewer)} · {viewer.emailHint}</small>{viewer.proposedByWorkspaceName && <small>Suggested by {viewer.proposedByWorkspaceName}</small>}</div>
      <div className={styles.familyState}><span>{viewer.status.replaceAll("_", " ")}</span>{viewer.invitationStatus && <small>Invitation: {viewer.invitationStatus}</small>}</div>
      {viewer.status === "pending_candidate_approval" && <form className={styles.approvalForm} onSubmit={(event) => { event.preventDefault(); void decide(viewer, "approve", event.currentTarget); }}><label>Re-enter the exact email to approve<input name="email" type="email" required maxLength={254} /></label><button disabled={pending !== null} type="submit"><Check /> Approve and invite</button><button disabled={pending !== null} type="button" className={styles.danger} onClick={() => decide(viewer, "reject")}><X /> Do not approve</button></form>}
      {viewer.status !== "pending_candidate_approval" && <div className={styles.familyActions}>{viewer.status === "active" && viewer.role !== "primary" && <button disabled={pending !== null} type="button" onClick={() => makePrimary(viewer)}><Star /> Make primary</button>}<button disabled={pending !== null} type="button" className={styles.danger} onClick={() => revoke(viewer)}><ShieldOff /> Remove</button></div>}
      {pending === viewer.viewerRef && <LoadingStatus compact title="Saving this family access change" />}
    </article>)}</div>
  </section>;
}
