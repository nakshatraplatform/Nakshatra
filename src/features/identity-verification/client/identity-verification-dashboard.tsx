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
          <h2 id="identity-verification-heading">Liveness check</h2>
          <p>Verification is required before this profile can be publicly published.</p>
        </div>
      </div>
      <p className="text-sm text-[light-dark(#475569,var(--app-dark-muted))]">
        Didit checks that a live person is present and assesses IP and device risk. No ID document or portfolio-photo comparison is required. VivIntro stores your consent and check results, not camera evidence or IP reports. This does not verify your identity or profile details.
      </p>
      <label className="mt-4 flex gap-3 text-sm text-[light-dark(#334155,var(--app-dark-ink))]">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I consent to Didit processing my live camera capture and IP/device information for liveness and IP checks.</span>
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="dashboard-primary-action" disabled={!consent || pending !== null} onClick={() => void startSelfVerification()}>
          {pending === "self" ? "Starting liveness check…" : "Start liveness check"}
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
