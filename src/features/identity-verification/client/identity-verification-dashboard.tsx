"use client";

import { useState } from "react";
import {
  createIdentityVerificationInvitationRequest,
  startSelfIdentityVerificationRequest,
} from "./identity-verification.api";

type PendingAction = "self" | "invitation" | null;

/** Provides explicit self-consent and delegated-invitation actions without exposing candidate details. */
export function IdentityVerificationDashboard({ candidateId }: { candidateId: string }) {
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerUrl, setProviderUrl] = useState<string | null>(null);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  async function startSelfVerification() {
    setPending("self");
    setError(null);
    const result = await startSelfIdentityVerificationRequest(candidateId);
    if (!result.ok) {
      setError(result.message);
      if (result.managementUrl) setManagementUrl(result.managementUrl);
    } else {
      setProviderUrl(result.data.url);
      setManagementUrl(result.data.managementUrl);
    }
    setPending(null);
  }

  async function createInvitation() {
    setPending("invitation");
    setError(null);
    const result = await createIdentityVerificationInvitationRequest(candidateId);
    if (!result.ok) setError(result.message);
    else setInvitationUrl(result.data.invitationUrl);
    setPending(null);
  }

  return (
    <section className="dashboard-glass p-5" aria-labelledby="identity-verification-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="identity-verification-heading">Photo &amp; liveness check</h2>
          <p>Confirm that you match your portfolio&apos;s primary photo.</p>
        </div>
      </div>
      <p className="dashboard-verification-copy">
        Didit compares a live selfie with your main portfolio photo and checks liveness. No identity document is requested.
      </p>
      <p className="dashboard-verification-copy">
        VivIntro saves your consent, the result, and a one-way record linked to your photo. It does not save your selfie.
      </p>
      <label className="mt-4 flex gap-3 text-sm text-[light-dark(#334155,var(--app-dark-ink))]">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I understand and consent to this primary-photo face match and passive-liveness processing.</span>
      </label>
      <div className="dashboard-verification-actions mt-4 flex flex-wrap gap-3">
        <button type="button" className="dashboard-primary-action" disabled={!consent || pending !== null} onClick={() => void startSelfVerification()}>
          {pending === "self" ? "Starting photo check…" : "Start photo & liveness check"}
        </button>
        <button type="button" className="dashboard-secondary-action" disabled={pending !== null} onClick={() => void createInvitation()}>
          {pending === "invitation" ? "Creating invitation…" : "Create candidate invitation"}
        </button>
      </div>
      <div className="mt-4" aria-live="polite" aria-atomic="true">
        {error ? <p className="dashboard-action-error" role="alert">{error}</p> : null}
        {invitationUrl ? <p className="dashboard-action-note">Share this private invitation only with the candidate: <a href={invitationUrl}>{invitationUrl}</a></p> : null}
        {managementUrl ? <p className="dashboard-action-note">Save your private <a href={managementUrl}>verification-management link</a>.</p> : null}
        {providerUrl ? <a className="dashboard-primary-action mt-3" href={providerUrl}>Continue to Didit verification</a> : null}
      </div>
    </section>
  );
}
