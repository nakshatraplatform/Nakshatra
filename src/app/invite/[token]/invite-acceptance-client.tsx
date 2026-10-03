"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InviteAcceptanceClient({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pilot-invitations/accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => null) as { redirect?: string; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "We could not activate this invitation.");
      router.replace(body?.redirect ?? "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not activate this invitation.");
      setBusy(false);
    }
  }

  async function switchAccount() {
    setBusy(true);
    await createClient().auth.signOut({ scope: "local" });
    router.replace(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
    router.refresh();
  }

  return <div className="mt-4">
    <p className="text-sm leading-6">You are signed in. Activate your pilot access with this account. We will verify that its email exactly matches the invited address before creating your private draft.</p>
    {error ? <p role="alert" className="mt-4 rounded-lg bg-[light-dark(#f8e6e2,var(--app-dark-danger-surface))] p-3 text-sm">{error}</p> : null}
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <button type="button" className="dashboard-primary-action min-h-11 justify-center" disabled={busy} onClick={() => void accept()}>{busy ? "Checking…" : "Activate pilot access"}</button>
      <button type="button" className="dashboard-secondary-action min-h-11 justify-center" disabled={busy} onClick={() => void switchAccount()}>Use a different account</button>
    </div>
  </div>;
}
