"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { lockPageScroll } from "@/lib/ui/scroll-lock";
import type { CandidateRecovery } from "../candidate-recovery.types";
import styles from "./liveness-completion-dialog.module.css";

export function LivenessEmailFeedback({ status }: { status: CandidateRecovery["emailStatus"] }) {
  const text = status === "accepted"
    ? "Your confirmation email was accepted by our email provider. Inbox delivery may take longer."
    : status === "failed" || status === "skipped"
      ? "Your check is confirmed, but we could not send the confirmation email. You can continue from your dashboard."
      : status === "queued" || status === "processing"
        ? "Your check is confirmed. A confirmation email is queued; you do not need to wait for it to continue."
        : "Your check is confirmed. Email status is unavailable here; you can continue from your dashboard.";
  return <p className="dashboard-action-note" role="status">{text}</p>;
}

/** Native top-layer dialog owns focus trapping; no biometric evidence is rendered. */
export function LivenessCompletionDialog({ emailStatus, returnPage, onDismiss }: {
  emailStatus: CandidateRecovery["emailStatus"]; returnPage: boolean; onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const release = lockPageScroll(document);
    dialog.showModal();
    return () => {
      dialog.close();
      release();
      const target = previous instanceof HTMLElement && previous.isConnected
        ? previous : document.getElementById("liveness-check");
      target?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="liveness-complete-title"
    aria-describedby="liveness-complete-description"
    onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <CheckCircle2 className={styles.check} aria-hidden="true" />
    <p className={styles.eyebrow}>One step complete</p>
    <h2 id="liveness-complete-title">Liveness check complete</h2>
    <p id="liveness-complete-description">Your liveness check is complete.</p>
    <LivenessEmailFeedback status={emailStatus} />
    <p className={styles.note}>You can continue preparing your introduction. This check confirms liveness, not identity or profile details.</p>
    {returnPage
      ? <Link href="/dashboard" className="dashboard-primary-action">Continue to dashboard</Link>
      : <button type="button" className="dashboard-primary-action" onClick={onDismiss}>Continue</button>}
    {returnPage ? <button type="button" className={styles.dismiss} onClick={onDismiss}>Stay on this page</button> : null}
  </dialog>;
}
