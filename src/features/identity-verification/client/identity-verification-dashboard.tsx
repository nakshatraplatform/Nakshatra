"use client";

import { useState } from "react";
import { startSelfIdentityVerificationRequest } from "./identity-verification.api";

type PendingAction = "self" | null;

/** Provides explicit consent for a candidate verifying their own portfolio. */
export function IdentityVerificationDashboard({ candidateId }: { candidateId: string }) {
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerUrl, setProviderUrl] = useState<string | null>(null);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);

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

  return (
    <section className="dashboard-glass p-5" aria-labelledby="identity-verification-heading">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="identity-verification-heading">Photo &amp; liveness check</h2>
          <p>Verification is required before this profile can be publicly published.</p>
        </div>
      </div>
      <p className="text-sm text-[light-dark(#475569,var(--app-dark-muted))]">
        Didit compares a live selfie with your current primary portfolio photo and performs a passive-liveness check. This candidate flow does not request an identity document. VivIntro stores the consent, result, and a one-way photo binding—not the selfie evidence.
      </p>
      <label className="mt-4 flex gap-3 text-sm text-[light-dark(#334155,var(--app-dark-ink))]">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I understand and consent to this primary-photo face match and passive-liveness processing.</span>
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="dashboard-primary-action" disabled={!consent || pending !== null} onClick={() => void startSelfVerification()}>
          {pending === "self" ? "Starting photo check…" : "Start photo & liveness check"}
        </button>
      </div>
      <div className="mt-4" aria-live="polite" aria-atomic="true">
        {error ? <p className="dashboard-action-error" role="alert">{error}</p> : null}
        {managementUrl ? <p className="dashboard-action-note">Save your private <a href={managementUrl}>verification-management link</a>.</p> : null}
        {providerUrl ? <a className="dashboard-primary-action mt-3" href={providerUrl}>Continue to Didit verification</a> : null}
      </div>
    </section>
  );
}
