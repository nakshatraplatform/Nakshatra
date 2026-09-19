"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Copy, Link2, MessageCircleQuestion, Send, XCircle } from "lucide-react";
import type { BrokerIntroductionItem, BrokerPortfolioNotice } from "@/features/broker-introductions/server/broker-introduction.contract";
import { acknowledgePortfolioUpdate, createIntroduction, flagPortfolioUpdate, markIntroductionShared, revokeIntroduction } from "@/features/broker-introductions/client/broker-introduction.api";
import styles from "./brokerdesk-customer-detail.module.css";

type CreatedLink = { introductionRef: string; introductionUrl: string; rowVersion: number };

export function BrokerIntroductionPanel({ workspaceRef, relationshipRef, canCreate, initialIntroductions, initialNotices }: {
  workspaceRef: string;
  relationshipRef: string;
  canCreate: boolean;
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
        recipientLabel: String(form.get("recipientLabel") || ""),
        recipientEmail: String(form.get("recipientEmail") || ""),
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
      <div className={styles.panelTitle}><Send /><div><h2>Broker introductions</h2><p>Create a time-limited Complete Portfolio link. No per-introduction customer approval or other-broker handshake is performed.</p></div></div>
      {canCreate ? <form className={styles.introductionForm} onSubmit={create}>
        <label>Recipient or family label<input name="recipientLabel" required maxLength={120} placeholder="Priya and family" /></label>
        <label>Recipient email <span>(optional, stored only as a hash and masked hint)</span><input name="recipientEmail" type="email" maxLength={254} placeholder="priya@example.com" /></label>
        <button disabled={pending} type="submit"><Link2 /> {pending ? "Working…" : "Create private introduction"}</button>
      </form> : <p className={styles.empty}>A current published portfolio and active introduction mandate are required.</p>}
      {created && <div className={styles.createdLink}><strong>One-time Complete Portfolio pass</strong><code>{created.introductionUrl}</code><button disabled={pending} type="button" onClick={activateAndCopy}><Copy /> Activate and copy</button><small>The first device to claim this link receives Complete Portfolio access. A forwarded or reused link falls back to the Detailed Introduction.</small></div>}
      {message && <p className={styles.notice} role="status">{message}</p>}
      <div className={styles.timeline}>{introductions.length === 0 ? <p className={styles.empty}>No broker introductions yet.</p> : introductions.map((item) => <article className={styles.introductionRow} key={item.introductionRef}>
        <div>{item.response === "accepted" ? <CheckCircle2 /> : item.response === "declined" ? <XCircle /> : <Link2 />}<span><strong>{item.recipientLabel}</strong><small>Version {item.versionNumber} · {item.status} · expires {new Date(item.expiresAt).toLocaleDateString()}</small>{item.responseComment && <em>“{item.responseComment}”</em>}</span></div>
        {!['revoked','expired'].includes(item.status) && <button disabled={pending} type="button" onClick={() => revoke(item)}>Revoke</button>}
      </article>)}</div>
    </section>
  </>;
}
