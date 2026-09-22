"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarClock, Pause, RefreshCw, ShieldOff } from "lucide-react";
import { manageCustomerBrokerConsent } from "@/features/broker-relationships/client/customer-invitation.api";
import type {
  CustomerBrokerConsentAction,
  CustomerBrokerRelationship,
} from "@/features/broker-relationships/server/customer-invitation.contract";
import styles from "./brokers.module.css";

const actionCopy: Record<CustomerBrokerConsentAction, { button: string; confirmation: string }> = {
  pause: {
    button: "Pause broker access",
    confirmation: "Pause this broker? Their access and all current introduction links will stop immediately. You can renew consent later, but old links will stay closed.",
  },
  renew: {
    button: "Renew for one year",
    confirmation: "Renew this broker for one year? They will regain access to your published Broker Standard Profile. Old introduction links will stay closed.",
  },
  terminate: {
    button: "End broker relationship",
    confirmation: "End this broker relationship? Their access and current introduction links will stop immediately. To work together again, you will need a new invitation.",
  },
};

function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value))
    : "No end date";
}

export function CustomerBrokerCard({ relationship }: { relationship: CustomerBrokerRelationship }) {
  const router = useRouter();
  const [pending, setPending] = useState<CustomerBrokerConsentAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isActive = relationship.relationshipStatus === "active";

  async function runAction(action: CustomerBrokerConsentAction) {
    if (!window.confirm(actionCopy[action].confirmation)) return;
    setPending(action);
    setError(null);
    try {
      await manageCustomerBrokerConsent(relationship.relationshipRef, action, crypto.randomUUID());
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This action is temporarily unavailable.");
    } finally {
      setPending(null);
    }
  }

  return <article className={styles.card}>
    <div className={styles.summary}>
      <div className={styles.icon}><Building2 aria-hidden="true" /></div>
      <div><h2>{relationship.workspaceName}</h2><p><span className={styles.status}>{relationship.relationshipStatus}</span></p></div>
      <p className={styles.term}><CalendarClock aria-hidden="true" /> {dateLabel(relationship.startsAt)} – {dateLabel(relationship.endsAt)}</p>
    </div>
    <p className={styles.accessExplanation}>
      {isActive
        ? "This broker can review your published Broker Standard Profile and manage introductions for you. Contact and other protected details are not included."
        : "This broker cannot currently review your Broker Standard Profile or create new introductions for you."}
    </p>
    {(relationship.actions.canPause || relationship.actions.canRenew || relationship.actions.canTerminate) &&
      <div className={styles.actions} aria-label={`Manage ${relationship.workspaceName}`}>
        {relationship.actions.canPause && <button type="button" disabled={pending !== null} onClick={() => runAction("pause")}><Pause aria-hidden="true" /> {pending === "pause" ? "Pausing…" : actionCopy.pause.button}</button>}
        {relationship.actions.canRenew && <button type="button" disabled={pending !== null} onClick={() => runAction("renew")}><RefreshCw aria-hidden="true" /> {pending === "renew" ? "Renewing…" : actionCopy.renew.button}</button>}
        {relationship.actions.canTerminate && <button type="button" className={styles.danger} disabled={pending !== null} onClick={() => runAction("terminate")}><ShieldOff aria-hidden="true" /> {pending === "terminate" ? "Ending…" : actionCopy.terminate.button}</button>}
      </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </article>;
}
