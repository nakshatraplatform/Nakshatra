"use client";

import { useState, type FormEvent } from "react";
import {
  introductionFamilyUpdateCommandSchema,
  type IntroductionFamilyUpdateCommand,
} from "@/features/broker-introductions/server/introduction-workspace.contract";
import styles from "../introductions.module.css";

export const familyUpdateLabels = {
  accepted: "Interested", declined: "Declined", needs_time: "Needs time",
  callback_requested: "Requested a callback", no_response: "No response", other: "Other feedback",
};
export const familySourceLabels = {
  candidate: "Candidate", authorized_parent: "Parent authorized by candidate", family: "Family member",
};
export const familyChannelLabels = {
  phone: "Phone", whatsapp: "WhatsApp", in_person: "In person", other: "Other",
};

export function FamilyUpdateForm({ side, version, disabled, onRecord }: {
  side: IntroductionFamilyUpdateCommand["side"];
  version: number;
  disabled: boolean;
  onRecord: (command: IntroductionFamilyUpdateCommand) => Promise<boolean>;
}) {
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [attested, setAttested] = useState(false);
  const decision = status === "accepted" || status === "declined";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = introductionFamilyUpdateCommandSchema.safeParse({
      side, status, reportedBy: source, channel: data.get("channel"), comment: data.get("comment"),
      consentAttested: decision && attested, expectedVersion: version,
      ...(status === "accepted" && attested ? { confirmFamilyAccess: true } : {}),
      idempotencyKey: `introduction-response:${crypto.randomUUID()}`,
    });
    if (!parsed.success || !(await onRecord(parsed.data))) return;
    form.reset();
    setStatus("");
    setSource("");
    setAttested(false);
  }

  return <details className={styles.responseForm}>
    <summary>Record a response or family update</summary>
    <form onSubmit={submit}>
      <fieldset disabled={disabled}>
        <label>Response
          <select required value={status} onChange={event => { setStatus(event.target.value); setSource(""); setAttested(false); }}>
            <option value="">Select a response</option>
            {Object.entries(familyUpdateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Who responded?
          <select required value={source} onChange={event => { setSource(event.target.value); setAttested(false); }}>
            <option value="">Select a person</option>
            {Object.entries(familySourceLabels).filter(([value]) => !decision || value !== "family").map(([value, label]) =>
              <option key={value} value={value}>{label}</option>
            )}
          </select>
        </label>
        <label>How did they respond?
          <select required name="channel" defaultValue="">
            <option value="">Select a channel</option>
            {Object.entries(familyChannelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Private broker note (optional)
          <textarea name="comment" maxLength={1000} rows={2} />
        </label>
        {decision && <label className={styles.attestation}>
          <input type="checkbox" required checked={attested} onChange={event => setAttested(event.target.checked)} />
          <span>I received this decision from the candidate or a parent the candidate authorized to make it.
            {status === "accepted" && " They explicitly agreed that if both sides confirm interest, the other candidate and their eligible Family Viewers can see their Complete Portfolio and Protected Contact for 30 days."}
          </span>
        </label>}
        <div className={styles.buttons}><button type="submit">Save response</button></div>
      </fieldset>
    </form>
  </details>;
}
