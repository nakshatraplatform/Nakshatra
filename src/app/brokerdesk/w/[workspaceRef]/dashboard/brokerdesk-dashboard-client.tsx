"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Link2, MessageCircleQuestion, Users } from "lucide-react";
import type { BrokerdeskDashboard } from "@/features/broker-introductions/server/broker-introduction.contract";
import { acknowledgePortfolioUpdate, markIntroductionResponseReviewed } from "@/features/broker-introductions/client/broker-introduction.api";
import styles from "./brokerdesk-dashboard.module.css";

type AvailableDashboard = Extract<BrokerdeskDashboard, { available: true }>;

export function BrokerdeskDashboardClient({ dashboard }: { dashboard: AvailableDashboard }) {
  const [actions, setActions] = useState(dashboard.actions);
  const [pendingKey, setPendingKey] = useState("");
  const [message, setMessage] = useState("");

  async function complete(index: number) {
    const action = actions[index];
    if (!action) return;
    const key = action.introductionRef || action.noticeRef || String(index);
    setPendingKey(key); setMessage("");
    try {
      if (action.type === "response" && action.introductionRef) {
        await markIntroductionResponseReviewed(dashboard.workspaceRef, action.introductionRef);
      } else if ((action.type === "portfolio_update" || action.type === "clarification") && action.noticeRef) {
        await acknowledgePortfolioUpdate(dashboard.workspaceRef, action.relationshipRef, action.noticeRef);
      } else return;
      setActions((items) => items.filter((_, itemIndex) => itemIndex !== index));
      setMessage("Follow-up marked complete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The follow-up could not be updated.");
    } finally { setPendingKey(""); }
  }

  return <main className={styles.main}>
    <div className={styles.heading}><div><p>Broker workspace</p><h1>{dashboard.workspaceName}</h1><span>Customer and introduction follow-ups, scoped only to your agency and assignments.</span></div><Link className={styles.primary} href={`/brokerdesk/w/${dashboard.workspaceRef}/customers`}>Open customers</Link></div>
    <section className={styles.metrics} aria-label="Workspace summary">
      <article><Users /><span>Active customers</span><strong>{dashboard.metrics.activeCustomers}</strong></article>
      <article><Link2 /><span>Open introductions</span><strong>{dashboard.metrics.openIntroductions}</strong></article>
      <article><CheckCircle2 /><span>Responses to review</span><strong>{dashboard.metrics.responsesAwaitingReview}</strong></article>
      <article><BellRing /><span>Portfolio updates</span><strong>{dashboard.metrics.portfolioUpdates}</strong></article>
    </section>
    <section className={styles.queue}>
      <div><p>Action queue</p><h2>What needs attention</h2></div>
      {message && <p className={styles.message} role="status">{message}</p>}
      {actions.length === 0 ? <div className={styles.empty}><CheckCircle2 /><h3>You are caught up</h3><p>New customer updates and recipient responses will appear here.</p></div> : <div className={styles.actions}>{actions.map((action, index) => {
        const key = action.introductionRef || action.noticeRef || `${action.type}-${index}`;
        const isResponse = action.type === "response";
        const canComplete = action.type !== "expiring";
        return <article key={key}>
          <div className={styles.icon}>{isResponse ? <CheckCircle2 /> : action.type === "expiring" ? <Clock3 /> : <MessageCircleQuestion />}</div>
          <div className={styles.actionBody}>
            <strong>{isResponse ? `${action.recipientLabel} ${action.response === "accepted" ? "accepted" : "declined"}` : action.type === "expiring" ? `Introduction to ${action.recipientLabel} expires soon` : action.type === "clarification" ? "Clarification follow-up" : `Portfolio version ${action.versionNumber} published`}</strong>
            <span>{action.customerName} · {new Date(action.occurredAt).toLocaleString()}</span>
            {action.responseComment && <p>“{action.responseComment}”</p>}
          </div>
          <div className={styles.buttons}><Link href={`/brokerdesk/w/${dashboard.workspaceRef}/customers/${action.relationshipRef}`}>View customer</Link>{canComplete && <button disabled={pendingKey === key} type="button" onClick={() => complete(index)}>{pendingKey === key ? "Saving…" : "Mark complete"}</button>}</div>
        </article>;
      })}</div>}
    </section>
    <p className={styles.privacy}>No other broker, agency, or customer relationship is exposed in this workspace.</p>
  </main>;
}
