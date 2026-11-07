"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, MessageCircle, CheckCircle2, BellRing, RefreshCw } from "lucide-react";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { getIntroductionAction, markIntroductionShared, recordShareAction } from "@/features/broker-introductions/client/broker-introduction.api";
import type { IntroductionAction, IntroductionShareCommand } from "@/features/broker-introductions/server/introduction-workspace.contract";
import { createCanonicalAppUrl } from "@/lib/security/redirect";
import styles from "../introductions.module.css";

const shareLabels = { not_started: "Not recorded yet", initiated: "Sharing started", broker_confirmed: "Broker confirmed sharing" };
const eventLabels: Record<IntroductionAction["timeline"][number]["type"], string> = {
  created: "Introduction created", shared: "Private link activated", claimed: "Recipient access verified",
  response_submitted: "Candidate response received", complete_access_confirmed: "Complete access consent recorded",
  mutual_access_granted: "Both interested — Complete access granted", revoked: "Introduction closed", expired: "Introduction expired",
  share_initiated: "Sharing started", share_confirmed: "Broker confirmed sharing", reminder_initiated: "Reminder started",
};
const dateLabel = (date: string) => new Date(date).toLocaleString();

export function IntroductionActionWorkspace({ workspaceRef, initial }: { workspaceRef: string; initial: IntroductionAction }) {
  const [data, setData] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);

  async function refresh() {
    setPending(true); setMessage("");
    try { setData(await getIntroductionAction(workspaceRef, data.introductionRef)); setNeedsRefresh(false); }
    catch (error) { setNeedsRefresh(true); setMessage(error instanceof Error ? error.message : "Refresh the page and try again."); }
    finally { setPending(false); }
  }

  async function share(side: IntroductionAction["sides"][number], action: IntroductionShareCommand["action"], delivery: "copy" | "whatsapp" | "manual") {
    // Open during the user gesture. No recipient data is sent to WhatsApp before the guarded command succeeds.
    const popup = delivery === "whatsapp" ? window.open("about:blank", "_blank") : null;
    if (delivery === "whatsapp" && !popup) { setMessage("Allow this WhatsApp window, or use Copy link instead."); return; }
    if (popup) popup.opener = null;
    setPending(true); setMessage("");
    let recorded = false;
    try {
      if (data.status === "created") {
        await markIntroductionShared(workspaceRef, data.introductionRef, data.rowVersion);
      }
      const result = await recordShareAction(workspaceRef, data.introductionRef, {
        side: side.side, action, expectedVersion: side.rowVersion,
        idempotencyKey: `introduction-share:${crypto.randomUUID()}`,
      });
      recorded = true;
      setData(current => ({ ...current, sides: current.sides.map(item => item.side === side.side ? { ...item, shareState: result.shareState, rowVersion: result.rowVersion } : item) }));
      const url = createCanonicalAppUrl(`/introductions/${data.introductionRef}`, window.location.href);
      if (delivery === "copy") await navigator.clipboard.writeText(url);
      if (popup) popup.location.replace(`https://wa.me/?text=${encodeURIComponent(`${action === "remind" ? "A reminder to review" : "Please review"} your private VivIntro Introduction. Sign in with your own account to open it.\n${url}`)}`);
      const success = delivery === "manual" ? "Your sharing confirmation was recorded."
        : delivery === "copy" ? "Link copied. Send it in this family's trusted conversation."
          : action === "remind" ? "WhatsApp opened for your reminder. Send the message there." : "WhatsApp opened. Choose the correct family conversation and send the message.";
      try { setData(await getIntroductionAction(workspaceRef, data.introductionRef)); setNeedsRefresh(false); setMessage(success); }
      catch { setNeedsRefresh(true); setMessage(`${success} Refresh to see the latest progress.`); }
    } catch (error) {
      popup?.close(); setNeedsRefresh(true);
      setMessage(recorded ? "The attempt was recorded, but the link could not be copied or opened. Refresh, then try again."
        : error instanceof Error ? error.message : "The action could not be completed. Refresh and try again.");
    } finally { setPending(false); }
  }

  return <>
    <h1>{data.sides.map(side => side.name).join(" & ")}</h1>
    <p>Share separately with each family. Only the candidates can choose Interested or Decline.</p>
    <p>Response period ends {dateLabel(data.expiresAt)}. Opening WhatsApp or copying a link does not confirm delivery or that it was read.</p>
    <div className={styles.buttons}><button type="button" onClick={refresh} disabled={pending}><RefreshCw /> Refresh progress</button></div>
    {message && <p className={styles.notice} role="status">{message}</p>}
    {pending && <LoadingStatus compact title="Updating Introduction actions" />}
    <div className={styles.sides}>{data.sides.map(side => <section className={styles.card} key={side.side} aria-label={`${side.name} sharing actions`}>
      <div className={styles.cardHeading}><h2>{side.name}</h2><span className={styles.badge}>{side.response === "accepted" ? "Interested" : side.response === "declined" ? "Declined" : "Awaiting response"}</span></div>
      <dl className={styles.details}>
        <div><dt>Sharing</dt><dd>{shareLabels[side.shareState]}</dd></div>
        {side.initiatedAt && <div><dt>First sharing attempt</dt><dd>{dateLabel(side.initiatedAt)}</dd></div>}
        {side.confirmedAt && <div><dt>Broker confirmed on</dt><dd>{dateLabel(side.confirmedAt)}</dd></div>}
        <div><dt>Reminders started</dt><dd>{side.reminderCount}{side.lastRemindedAt ? ` · Latest ${dateLabel(side.lastRemindedAt)}` : ""}</dd></div>
      </dl>
      {side.canShare && (data.status !== "created" || data.canActivate) ? <div className={styles.buttons}>
        <button disabled={pending || needsRefresh} type="button" onClick={() => share(side, "initiate", "whatsapp")}><MessageCircle /> Share on WhatsApp</button>
        <button disabled={pending || needsRefresh} type="button" onClick={() => share(side, "initiate", "copy")}><Copy /> Copy link</button>
        <button disabled={pending || needsRefresh || side.shareState === "broker_confirmed"} type="button" onClick={() => share(side, "confirm", "manual")}><CheckCircle2 /> I shared with this family</button>
        <button disabled={pending || needsRefresh || !side.canRemind} type="button" onClick={() => share(side, "remind", "whatsapp")}><BellRing /> Remind on WhatsApp</button>
      </div> : <p>{side.canShare && data.status === "created" && !data.canActivate
        ? "Ask an authorized sender in your team to activate this Introduction first."
        : "Sharing is unavailable. Check the customer mandates and your workspace permissions."}</p>}
      <Link className={styles.actionLink} href={`/brokerdesk/w/${workspaceRef}/customers/${side.relationshipRef}`}>Open customer</Link>
    </section>)}</div>
    <p>Reminders are available for an unanswered side after a sharing attempt, at most once every 24 hours. Complete Portfolio access stays private to authorized participants.</p>
    <section className={styles.card}><h2>Introduction history</h2><p>Latest 100 events from this workspace. Sharing confirmations are recorded by the broker.</p>
      {data.timeline.length === 0 ? <p>No activity recorded yet.</p> : <ol className={styles.timeline}>{data.timeline.map((event, index) => <li key={`${event.occurredAt}:${index}`}>
        {eventLabels[event.type]}{event.side ? ` · ${data.sides.find(side => side.side === event.side)?.name}` : ""}
        <time dateTime={event.occurredAt}>{dateLabel(event.occurredAt)}</time>
      </li>)}</ol>}
    </section>
  </>;
}
