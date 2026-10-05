"use client";

import { ThemeSwitch } from "@/components/theme/ThemeSwitch";


import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import type { PilotAdminRequest } from "@/features/pilot-access/server/pilot-access.contract";

type Failure = { error?: string };
type CreatorInvite = { email: string; invited_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };

export default function PilotAccessAdminClient() {
  const [requests, setRequests] = useState<PilotAdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<CreatorInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [manualLink, setManualLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, inviteResponse] = await Promise.all([
        fetch("/api/admin/pilot-access?status=pending", { cache: "no-store" }),
        fetch("/api/admin/creator-invitations", { cache: "no-store" }),
      ]);
      const body = await response.json().catch(() => null) as { requests?: PilotAdminRequest[] } & Failure | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not load the waitlist.");
      const inviteBody = await inviteResponse.json().catch(() => null) as { invitations?: CreatorInvite[] } & Failure | null;
      if (!inviteResponse.ok) throw new Error(inviteBody?.error ?? "Could not load invitations.");
      setRequests(body?.requests ?? []);
      setInvites(inviteBody?.invitations ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the waitlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronized from an authorized API.
    void load();
  }, [load]);

  async function manageInvite(email: string, action: "grant" | "revoke") {
    setInviteBusy(true);
    setInviteMessage("");
    setManualLink("");
    try {
      const response = await fetch("/api/admin/creator-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      const body = await response.json().catch(() => null) as { delivery?: string; invitationUrl?: string; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not update this invitation.");
      setInviteMessage(action === "revoke"
        ? `Invitation and creator access for ${email} were revoked.`
        : body?.delivery === "accepted"
          ? `Invitation created for ${email}. The email provider accepted it for delivery; access starts only after this person verifies and accepts.`
          : body?.error ?? `Invitation created for ${email}; email delivery needs attention.`);
      setManualLink(body?.invitationUrl ?? "");
      setInviteEmail("");
      await load();
    } catch (caught) {
      setInviteMessage(caught instanceof Error ? caught.message : "Could not update this invitation.");
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <main id="main-content" className="pilot-access-shell min-h-screen bg-[light-dark(#f8f6f0,var(--app-dark-canvas))] px-4 py-8 text-[light-dark(#18272e,var(--app-dark-ink))] sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-5 border-b border-[light-dark(#d8d8d2,var(--app-dark-border))] pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[light-dark(#477b77,var(--app-dark-accent))]">VivIntro operations</p>
            <h1 className="mt-2 font-[family-name:var(--font-portfolio-display)] text-4xl font-medium sm:text-5xl">Pilot access</h1>
            <p className="mt-3 max-w-2xl text-[light-dark(#475569,var(--app-dark-muted))]">Invite creators by email and review the launch waitlist. Waitlist entries do not grant access.</p>
          </div>
          <div className="flex gap-2"><ThemeSwitch />
            <button onClick={() => void load()} disabled={loading} aria-label="Refresh waitlist" className="dashboard-secondary-action"><RefreshCw aria-hidden className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
            <Link href="/dashboard" className="dashboard-secondary-action">Dashboard</Link>
          </div>
        </header>

        <section className="mt-7 rounded-xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] p-5 sm:p-6" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="text-xl font-semibold">Invite a portfolio creator</h2>
          <p className="mt-2 max-w-2xl text-sm text-[light-dark(#475569,var(--app-dark-muted))]">Enter the exact address they will use with Google or email and password. Their seven-day, single-use link creates access only after they verify that email. Their portfolio starts as a private draft; standard publishing still requires liveness and IP checks.</p>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); void manageInvite(inviteEmail.trim().toLowerCase(), "grant"); }}>
            <label className="flex-1 text-sm font-medium" htmlFor="creator-invite-email">Email address
              <input id="creator-invite-email" type="email" autoComplete="off" required maxLength={180} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="person@gmail.com" className="mt-2 block min-h-11 w-full rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] bg-[light-dark(#fff,var(--app-dark-canvas))] px-3" />
            </label>
            <button type="submit" className="dashboard-primary-action min-h-11 justify-center" disabled={inviteBusy}>{inviteBusy ? "Working…" : "Add and email invitation"}</button>
          </form>
          {inviteMessage ? <p role="status" className="mt-3 text-sm">{inviteMessage}</p> : null}
          {manualLink ? <label className="mt-3 block text-sm">Private invitation link to share securely
            <input className="mt-2 block w-full rounded-lg border border-[light-dark(#b8c4c4,var(--app-dark-border))] p-2 text-xs" readOnly value={manualLink} onFocus={(event) => event.target.select()} />
          </label> : null}
          <p className="mt-3 text-xs text-[light-dark(#475569,var(--app-dark-muted))]">Email acceptance is not delivery confirmation. If it does not arrive, choose Reinvite to send a new link; the older unaccepted link stops working.</p>
        </section>

        <section className="mt-7" aria-labelledby="invites-heading">
          <h2 id="invites-heading" className="text-xl font-semibold">Creator invitations</h2>
          {invites.length === 0 ? <p className="mt-3 text-sm">No creator invitations recorded yet.</p> : <div className="mt-3 grid gap-3">
            {invites.map((invite) => <article key={`${invite.email}-${invite.invited_at}`} className="flex flex-col gap-3 rounded-xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="break-all font-medium">{invite.email}</p><p className="mt-1 text-xs text-[light-dark(#475569,var(--app-dark-muted))]">{invite.revoked_at ? "Revoked" : invite.accepted_at ? "Accepted · creator access active" : new Date(invite.expires_at) <= new Date() ? "Expired" : "Awaiting acceptance"} · Added {new Date(invite.invited_at).toLocaleDateString()}</p></div>
              <button type="button" className="dashboard-secondary-action min-h-11 justify-center" disabled={inviteBusy} onClick={() => void manageInvite(invite.email, invite.revoked_at || (!invite.accepted_at && new Date(invite.expires_at) <= new Date()) ? "grant" : "revoke")}>{invite.revoked_at || (!invite.accepted_at && new Date(invite.expires_at) <= new Date()) ? "Reinvite" : "Revoke"}</button>
            </article>)}
          </div>}
        </section>

        {error ? <div role="alert" className="mt-7 border-l-4 border-[light-dark(#b7483e,var(--app-dark-border))] bg-[light-dark(#f8e6e2,var(--app-dark-danger-surface))] p-4 text-sm text-[light-dark(#7d302b,var(--app-dark-danger))]">{error}</div> : null}
        <h2 className="mt-9 text-xl font-semibold">Launch waitlist</h2>
        {loading ? <p role="status" className="py-16 text-center text-[light-dark(#475569,var(--app-dark-muted))]">Loading waitlist…</p> : requests.length === 0 ? (
          <section className="mt-7 rounded-xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] px-6 py-16 text-center"><ShieldCheck aria-hidden className="mx-auto h-8 w-8 text-[light-dark(#477b77,var(--app-dark-accent))]" /><h2 className="mt-4 text-xl font-semibold">No waitlist entries yet</h2><p className="mt-2 text-[light-dark(#475569,var(--app-dark-muted))]">New verified submissions will appear here.</p></section>
        ) : (
          <div className="mt-7 grid gap-4">
            {requests.map((request) => (
              <article key={request.requestRef} className="rounded-xl border border-[light-dark(#d0d3ce,var(--app-dark-border))] bg-[light-dark(#fffdf8,var(--app-dark-surface))] p-5 shadow-[0_10px_30px_rgb(29_52_58/0.05)] sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div><h2 className="text-lg font-semibold">{request.displayName}</h2><p className="mt-2 break-all text-sm text-[light-dark(#334155,var(--app-dark-ink))]">{request.verifiedEmail}</p>{request.phoneE164 ? <p className="mt-1 text-sm text-[light-dark(#475569,var(--app-dark-muted))]">{request.phoneE164}</p> : null}</div>
                  <p className="text-xs text-[light-dark(#64748b,var(--app-dark-muted))]">Joined {new Date(request.submittedAt).toLocaleString()}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
