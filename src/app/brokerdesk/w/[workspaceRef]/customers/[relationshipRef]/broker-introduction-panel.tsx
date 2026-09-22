"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Copy, Link2, MessageCircleQuestion, Send, XCircle } from "lucide-react";
import type { BrokerIntroductionItem, BrokerPortfolioNotice, EligibleBrokerIntroductionRecipient } from "@/features/broker-introductions/server/broker-introduction.contract";
import { acknowledgePortfolioUpdate, createIntroduction, flagPortfolioUpdate, markIntroductionShared, revokeIntroduction } from "@/features/broker-introductions/client/broker-introduction.api";
import styles from "./brokerdesk-customer-detail.module.css";

type CreatedLink = { introductionRef: string; introductionUrl: string; rowVersion: number };

export function BrokerIntroductionPanel({ workspaceRef, relationshipRef, canCreate, eligibleRecipients, initialIntroductions, initialNotices }: {
  workspaceRef: string;
  relationshipRef: string;
  canCreate: boolean;
  eligibleRecipients: EligibleBrokerIntroductionRecipient[];
  initialIntroductions: BrokerIntroductionItem[];
  initialNotices: BrokerPortfolioNotice[];
}) {
  const [introductions, setIntroductions] = useState(initialIntroductions);
  const [notices, setNotices] = useState(initialNotices);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await createIntroduction(workspaceRef, {
        relationshipRef,
        recipientRelationshipRef: String(form.get("recipientRelationshipRef") || ""),
        idempotencyKey: `broker-introduction:${crypto.randomUUID()}`,
      });
      setCreated({ introductionRef: result.introductionRef, introductionUrl: result.introductionUrl, rowVersion: result.rowVersion });
      setIntroductions((items) => [{
        introductionRef: result.introductionRef,
        recipientLabel: result.recipientLabel,
        recipientEmailHint: result.recipientEmailHint,
        status: "created",
        response: null,
        responseComment: null,
        respondedAt: null,
        sourceResponse: null,
        sourceResponseComment: null,
        sourceRespondedAt: null,
        recipientResponse: null,
        recipientResponseComment: null,
        recipientRespondedAt: null,
        mutualInterestConfirmedAt: null,
        completeAccessExpiresAt: null,
        expiresAt: result.expiresAt,
        versionNumber: result.versionNumber,
        rowVersion: result.rowVersion,
        createdAt: new Date().toISOString(),
      }, ...items]);
      event.currentTarget.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The introduction could not be created."); }
    finally { setPending(false); }
  }

  async function activateAndCopy() {
    if (!created) return;
    setPending(true); setMessage("");
    try {
      const transition = await markIntroductionShared(workspaceRef, created.introductionRef, created.rowVersion);
      await navigator.clipboard.writeText(created.introductionUrl);
      setCreated({ ...created, rowVersion: transition.rowVersion });
      setIntroductions((items) => items.map((item) => item.introductionRef === created.introductionRef
        ? { ...item, status: "shared", rowVersion: transition.rowVersion }
        : item));
      setMessage("Private introduction link activated and copied. Send it through your trusted WhatsApp conversation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The private link could not be activated."); }
    finally { setPending(false); }
  }

  async function revoke(item: BrokerIntroductionItem) {
    setPending(true); setMessage("");
    try {
      const transition = await revokeIntroduction(workspaceRef, item.introductionRef, item.rowVersion);
      setIntroductions((items) => items.map((candidate) => candidate.introductionRef === item.introductionRef
        ? { ...candidate, status: "revoked", rowVersion: transition.rowVersion }
        : candidate));
      if (created?.introductionRef === item.introductionRef) setCreated(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The introduction could not be revoked."); }
    finally { setPending(false); }
  }

  async function flag(notice: BrokerPortfolioNotice) {
    setPending(true); setMessage("");
    try {
      await flagPortfolioUpdate(workspaceRef, relationshipRef, notice.noticeRef);
      setNotices((items) => items.map((item) => item.noticeRef === notice.noticeRef ? { ...item, status: "clarification" } : item));
      setMessage("Flagged for clarification. Contact the customer directly by phone or WhatsApp.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The update could not be flagged."); }
    finally { setPending(false); }
  }

  async function acknowledge(notice: BrokerPortfolioNotice) {
    setPending(true); setMessage("");
    try {
      await acknowledgePortfolioUpdate(workspaceRef, relationshipRef, notice.noticeRef);
      setNotices((items) => items.map((item) => item.noticeRef === notice.noticeRef ? { ...item, status: "acknowledged" } : item));
      setMessage("Portfolio update acknowledged.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The update could not be acknowledged."); }
    finally { setPending(false); }
  }

  return <>
    {notices.length > 0 && <section className={styles.panel}>
      <div className={styles.panelTitle}><AlertTriangle /><div><h2>Portfolio updates</h2><p>Each notice belongs only to this broker relationship. Updates do not alter introductions already shared.</p></div></div>
      <div className={styles.timeline}>{notices.map((notice) => <article className={styles.introductionRow} key={notice.noticeRef}>
        <div><strong>Published version {notice.versionNumber}</strong><span>{new Date(notice.publishedAt).toLocaleDateString()} · {notice.status}</span></div>
        {notice.status !== "acknowledged" && <div><button disabled={pending} type="button" onClick={() => acknowledge(notice)}><CheckCircle2 /> Acknowledge</button>{notice.status === "unread" && <button disabled={pending} type="button" onClick={() => flag(notice)}><MessageCircleQuestion /> Flag for clarification</button>}</div>}
      </article>)}</div>
    </section>}
    <section className={styles.panel}>
      <div className={styles.panelTitle}><Send /><div><h2>Broker introductions</h2><p>Choose another ready customer in this workspace. Both portfolios must be published and identity-verified.</p></div></div>
      {canCreate && eligibleRecipients.length > 0 ? <form className={styles.introductionForm} onSubmit={create}>
        <label>Introduce this customer to
          <select className="min-h-11 rounded-lg border border-[light-dark(#d6cec0,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-surface-soft))] px-3 text-inherit" name="recipientRelationshipRef" required defaultValue="">
            <option value="" disabled>Select an eligible customer</option>
            {eligibleRecipients.map((recipient) => <option key={recipient.relationshipRef} value={recipient.relationshipRef}>
              {[recipient.displayName, recipient.gender, recipient.location].filter(Boolean).join(" · ")}
            </option>)}
          </select>
        </label>
        <button disabled={pending} type="submit"><Link2 /> {pending ? "Working…" : "Create private introduction"}</button>
      </form> : <p className={styles.empty}>{canCreate ? "No other active, published and identity-verified customer is available yet." : "This customer needs an active mandate, a published portfolio and completed identity verification before introductions can be created."}</p>}
      {created && <div className={styles.createdLink}><strong>Customer-only introduction link</strong><code>{created.introductionUrl}</code><button disabled={pending} type="button" onClick={activateAndCopy}><Copy /> Activate and copy</button><small>Only the selected customer can open this link after signing in to VivIntro. Forwarding the URL does not grant anyone else access.</small></div>}
      {message && <p className={styles.notice} role="status">{message}</p>}
      <div className={styles.timeline}>{introductions.length === 0 ? <p className={styles.empty}>No broker introductions yet.</p> : introductions.map((item) => <article className={styles.introductionRow} key={item.introductionRef}>
        <div>{item.sourceResponse === "accepted" && item.recipientResponse === "accepted" ? <CheckCircle2 /> : item.sourceResponse === "declined" || item.recipientResponse === "declined" ? <XCircle /> : <Link2 />}<span><strong>{item.recipientLabel}</strong><small>Selected customer: {item.sourceResponse ?? "waiting"} · {item.recipientLabel}: {item.recipientResponse ?? "waiting"}</small><small>Version {item.versionNumber} · {item.status} · respond by {new Date(item.expiresAt).toLocaleDateString()}</small>{item.completeAccessExpiresAt && <small>Mutual-interest Complete access until {new Date(item.completeAccessExpiresAt).toLocaleDateString()}</small>}{item.recipientResponseComment && <em>“{item.recipientResponseComment}”</em>}</span></div>
        {!['revoked','expired'].includes(item.status) && <button disabled={pending} type="button" onClick={() => revoke(item)}>Revoke</button>}
      </article>)}</div>
    </section>
  </>;
}
