"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, UserRoundPlus, UsersRound } from "lucide-react";
import { LoadingStatus } from "@/components/loading/LoadingStatus";
import { proposeFamilyViewer } from "@/features/family-viewers/client/family-viewer.api";
import type { BrokerdeskFamilySetup } from "@/features/family-viewers/server/family-viewer.contract";
import styles from "./brokerdesk-customer-detail.module.css";

type AvailableSetup = Extract<BrokerdeskFamilySetup, { available: true }>;

export function FamilyViewerPanel({ workspaceRef, relationshipRef, setup }: {
  workspaceRef: string;
  relationshipRef: string;
  setup: AvailableSetup;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const relationshipKind = String(form.get("relationshipKind") || "");
    const relationshipLabel = String(form.get("relationshipLabel") || "").trim();
    try {
      await proposeFamilyViewer(workspaceRef, relationshipRef, {
        email: String(form.get("email") || ""),
        displayName: String(form.get("displayName") || ""),
        relationshipKind,
        relationshipLabel: relationshipKind === "other" ? relationshipLabel || null : null,
        preferredLocale: null,
        idempotencyKey: `family-proposal:${crypto.randomUUID()}`,
      });
      formElement.reset();
      setMessage("Request received. The customer manages family invitations and must approve access.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The family contact proposal could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return <section className={styles.panel}>
    <div className={styles.panelTitle}>
      <UsersRound />
      <div>
        <h2>Family representatives</h2>
        <p>{setup.activeViewerCount} of {setup.maximumActiveViewers} active. The customer owns one family list across all brokers.</p>
      </div>
    </div>
    <div className={styles.familyGuardrail}>
      <CheckCircle2 />
      <span>You can suggest a family representative. Only the customer can confirm the exact email and approve access.</span>
    </div>
    {setup.canPropose && <form className={styles.familyForm} onSubmit={submit}>
      <label>Family member name
        <input name="displayName" required minLength={1} maxLength={120} autoComplete="name" />
      </label>
      <label>Email used for Google sign-in
        <input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <label>Relationship
        <select name="relationshipKind" required defaultValue="parent">
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="parent">Parent</option>
          <option value="sibling">Sibling</option>
          <option value="guardian">Guardian</option>
          <option value="relative">Relative</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Relationship details <span>Only required for “Other”</span>
        <input name="relationshipLabel" maxLength={40} />
      </label>
      <button disabled={pending} type="submit"><UserRoundPlus /> {pending ? "Saving…" : "Suggest family representative"}</button>
    </form>}
    {pending && <LoadingStatus compact title="Recording the family representative request" />}
    {message && <p className={styles.notice} role="status">{message}</p>}
    <div className={styles.familyList}>
      <p className={styles.empty}>The customer manages their private family list. Proposal details are not displayed here.</p>
    </div>
  </section>;
}
