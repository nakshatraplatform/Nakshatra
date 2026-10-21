"use client";

import { LoadingOrb, LoadingStatus } from "@/components/loading/LoadingStatus";
import { useHydrated } from "@/lib/ui/use-hydrated";



import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { activateModalLifecycle } from "@/lib/ui/modal-lifecycle";
import { KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import type { AccountDeletionStatus } from "@/features/account/server/account.contract";
import { emptyAccountProfile, type AccountProfile } from "@/features/account/profile";
import {
  cancelAccountDeletionRequest,
  requestAccountDeletionRequest,
  revokeOtherSessionsRequest,
  startAccountDeletionReauthRequest,
  saveAccountProfileRequest,
} from "@/features/account/client/account.api";

interface Props {
  userEmail: string;
  initialDeletion: AccountDeletionStatus;
  reauthComplete?: boolean;
  initialProfile?: AccountProfile;
  profileManagedByPortfolio?: boolean;
  signInMethods?: string[];
}

type Action = "profile" | "sessions" | "delete" | "cancel" | "reauth" | null;

/** Presents browser-safe account controls while all privileged work remains in authenticated APIs. */
export default function AccountClient({ userEmail, initialDeletion, initialProfile = emptyAccountProfile, profileManagedByPortfolio = false, signInMethods = [], reauthComplete = false }: Props) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [deletion, setDeletion] = useState(initialDeletion);
  const [confirmationOpen, setConfirmationOpen] = useState(reauthComplete);
  const [confirmation, setConfirmation] = useState("");
  const [action, setAction] = useState<Action>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthMethod, setReauthMethod] = useState<"google" | "email" | null>(null);
  function closeConfirmation() {
    if (action !== null) return;
    setConfirmationOpen(false);
    setConfirmation("");
  }
  const dialogRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const closeWithEscape = useEffectEvent(closeConfirmation);
  useEffect(() => {
    if (!confirmationOpen || !dialogRef.current) return;
    const release = activateModalLifecycle(dialogRef.current, closeWithEscape, deleteTriggerRef.current);
    headingRef.current?.focus();
    return release;
  }, [confirmationOpen]);

  function beginAction(next: Exclude<Action, null>) {
    setAction(next);
    setMessage(null);
    setError(null);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action !== null || profileManagedByPortfolio) return;
    beginAction("profile");
    const result = await saveAccountProfileRequest(profile);
    if (!result.ok) setError(result.message);
    else {
      setProfile(result.data);
      setSavedProfile(result.data);
      router.refresh();
      setMessage("Your account names have been saved. Your portfolio has not changed.");
    }
    setAction(null);
  }

  /** Invalidates all Supabase sessions except the current browser session. */
  async function revokeOtherSessions() {
    beginAction("sessions");
    const result = await revokeOtherSessionsRequest();
    if (!result.ok) setError(result.message);
    else setMessage("Other devices have been signed out.");
    setAction(null);
  }

  /** Revokes shared access now while preserving private recovery-window access. */
  async function requestDeletion() {
    if (confirmation !== "DELETE") return;
    beginAction("delete");
    const result = await requestAccountDeletionRequest();
    if (!result.ok) {
      setError(result.message);
      setAction(null);
      return;
    }
    if (result.data.status === "ownership_transfer_required") {
      const count = result.data.organizationCount ?? 1;
      setError(`Transfer ownership of ${count} ${count === 1 ? "organization" : "organizations"} before deleting this account.`);
      setAction(null);
      return;
    }
    setDeletion({
      status: "pending",
      scheduledFor: result.data.scheduledFor ?? new Date().toISOString(),
      requestedAt: new Date().toISOString(),
    });
    setConfirmationOpen(false);
    setConfirmation("");
    setMessage("Account deletion is scheduled. You can continue using your account until processing begins, or cancel during the recovery window.");
    setAction(null);
  }

  /** Starts a fresh provider flow; the proof remains in an HttpOnly server cookie. */
  async function startDeletionReauth() {
    if (!reauthMethod) return;
    beginAction("reauth");
    const result = await startAccountDeletionReauthRequest(reauthMethod);
    if (!result.ok) {
      setError(result.message);
      setAction(null);
      return;
    }
    if (result.data.url) {
      window.location.assign(result.data.url);
      return;
    }
    setMessage(`A secure sign-in link was sent to ${userEmail}. Complete it in this browser to continue.`);
    setAction(null);
  }

  /** Cancels a pending request; previously unpublished portfolios remain private. */
  async function cancelDeletion() {
    beginAction("cancel");
    const result = await cancelAccountDeletionRequest();
    if (!result.ok) setError(result.message);
    else {
      setDeletion(null);
      setMessage("Account deletion has been canceled. Your portfolio remains unpublished.");
    }
    setAction(null);
  }

  const deletionPending = deletion?.status === "pending" || deletion?.status === "failed";
  const deletionProcessing = deletion?.status === "processing";

  return (
    <div className="contents">

      <main id="main-content" tabIndex={-1} className="account-privacy-main">
        <div className="account-privacy-heading">
          <p className="site-eyebrow">Account controls</p>
          <h1>Account settings</h1>
          <p>Signed in as {userEmail}</p>
        </div>

        <div aria-live="polite" aria-atomic="true" hidden={confirmationOpen}>
          {message && !confirmationOpen ? <p className="account-notice is-success">{message}</p> : null}
          {error && !confirmationOpen ? <p className="account-notice is-error">{error}</p> : null}
        </div>

        {action && !confirmationOpen && <LoadingStatus compact className="my-4" title={action === "profile" ? "Saving your account names" : action === "sessions" ? "Signing out other devices" : action === "reauth" ? "Preparing secure sign-in" : action === "cancel" ? "Cancelling scheduled deletion" : "Scheduling account deletion"} />}

        <section className="account-settings-group" aria-labelledby="account-profile-heading">
          <h2 id="account-profile-heading">Your account profile</h2>
          <p>{profileManagedByPortfolio ? "These names follow your saved introduction. Update them in Basics to keep both places consistent." : "These names identify the account holder. Edit your portfolio separately from the dashboard."}</p>
          <form onSubmit={saveProfile} className="account-profile-form">
            <div className="account-profile-fields">
              {(["firstName", "middleName", "lastName"] as const).map((key) => (
                <label key={key} htmlFor={`account-${key}`}>
                  {key === "firstName" ? "First name" : key === "middleName" ? "Middle name (optional)" : "Last name"}
                  <input className="biodata-field" id={`account-${key}`} name={key} autoComplete={key === "firstName" ? "given-name" : key === "middleName" ? "additional-name" : "family-name"} required={key !== "middleName"} readOnly={profileManagedByPortfolio} maxLength={80} value={profile[key]} disabled={!hydrated || action !== null || deletionProcessing} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} />
                </label>
              ))}
            </div>
            {profileManagedByPortfolio ? <Link href="/dashboard?edit=1" className="dashboard-secondary-action">Edit introduction names</Link> : <button className="dashboard-secondary-action" type="submit" disabled={action !== null || deletionProcessing || JSON.stringify(profile) === JSON.stringify(savedProfile)}>
              {action === "profile" ? "Saving…" : "Save names"}
            </button>}
          </form>
          <dl className="account-sign-in-details">
            <div><dt>Email address</dt><dd>{userEmail || "Not available"}</dd></div>
            <div><dt>Linked sign-in methods</dt><dd>{signInMethods.length ? signInMethods.join(", ") : "Not available"}</dd></div>
          </dl>
        </section>

        <section className="account-settings-group" aria-labelledby="data-devices-heading">
          <h2 id="data-devices-heading">Your devices</h2>

          <section className="account-control-row" aria-labelledby="sessions-heading">
            <div>
              <h3 id="sessions-heading">Other signed-in devices</h3>
              <p>End every other active session. This browser stays signed in.</p>
            </div>
            <button className="dashboard-secondary-action" onClick={revokeOtherSessions} disabled={!hydrated || action !== null}>
              {action === "sessions" ? <LoadingOrb size={20} /> : <KeyRound />}
              Sign out others
            </button>
          </section>
        </section>

        <section className="account-settings-group account-settings-danger" aria-labelledby="account-close-heading">
          <h2 id="account-close-heading">Close your account</h2>
          <section className="account-control-row account-danger-zone" aria-labelledby="delete-heading">
            <div>
              <h3 id="delete-heading">Delete account</h3>
              {deletionPending ? (
                <p>
                  The recovery window ends {new Date(deletion.scheduledFor).toLocaleString()}. Deletion processing can begin after that time.
                  Public and approved portfolio access is already disabled.
                </p>
              ) : (
                <p>When you confirm deletion, public and approved access are revoked. A 24-hour recovery window follows; permanent deletion is processed afterward.</p>
              )}
            </div>
            {deletionPending ? (
              <button className="dashboard-secondary-action" onClick={cancelDeletion} disabled={!hydrated || action !== null}>
                {action === "cancel" ? <LoadingOrb size={20} /> : <ShieldCheck />}
                Cancel deletion
              </button>
            ) : deletionProcessing ? (
              <p className="account-notice is-error">Deletion is being processed and can no longer be canceled.</p>
            ) : (
              <button ref={deleteTriggerRef} className="dashboard-danger-action" onClick={() => setConfirmationOpen(true)} disabled={!hydrated || action !== null}>
                <Trash2 />
                Delete account
              </button>
            )}
          </section>
        </section>
      </main>

      {confirmationOpen ? (
        <div className="account-confirm-backdrop" role="presentation">
          <section ref={dialogRef} tabIndex={-1} className="account-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-heading">
            <button className="account-confirm-close" aria-label="Close deletion confirmation" disabled={!hydrated || action !== null} onClick={closeConfirmation}>
              <X />
            </button>
            <p className="site-eyebrow">Permanent action</p>
            <h2 ref={headingRef} tabIndex={-1} id="confirm-delete-heading">Schedule account deletion?</h2>
            {action && <LoadingStatus compact className="my-4" title={action === "reauth" ? "Preparing secure sign-in" : "Scheduling account deletion"} />}
            <p>When you confirm deletion, your public links and approved access stop working. You can cancel during the 24-hour recovery window. After it ends, deletion becomes eligible for processing; removal of your account, stored files and provider data may take longer.</p>
            <div aria-live="polite" aria-atomic="true">
              {error && <p className="account-notice is-error" role="alert">{error}</p>}
              {message && <p className="account-notice is-success">{message}</p>}
            </div>
            <p>First complete a fresh sign-in. Your confirmation is submitted only after that sign-in succeeds.</p>
            <fieldset>
              <legend>Reauthenticate with</legend>
              <label>
                <input
                  type="radio"
                  name="reauth-method"
                  checked={reauthMethod === "google"}
                  onChange={() => setReauthMethod("google")}
                  disabled={!hydrated || action !== null}
                />
                Google
              </label>
              <label>
                <input
                  type="radio"
                  name="reauth-method"
                  checked={reauthMethod === "email"}
                  onChange={() => setReauthMethod("email")}
                  disabled={!hydrated || action !== null}
                />
                Email link to {userEmail}
              </label>
            </fieldset>
            {!reauthComplete ? (
              <button
                className="dashboard-secondary-action"
                onClick={startDeletionReauth}
                disabled={!hydrated || !reauthMethod || action !== null}
              >
                {action === "reauth" ? <LoadingOrb size={20} /> : <KeyRound />}
                Continue to fresh sign-in
              </button>
            ) : (
              <p className="account-notice is-success">Fresh sign-in complete. Type DELETE to schedule deletion.</p>
            )}
            <label htmlFor="delete-confirmation">Type <strong>DELETE</strong> to continue</label>
            <input
              id="delete-confirmation"
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={!hydrated || action !== null}
            />
            <button
              className="dashboard-danger-action"
              onClick={requestDeletion}
              disabled={!hydrated || !reauthComplete || confirmation !== "DELETE" || action !== null}
            >
              {action === "delete" ? <LoadingOrb size={20} /> : <Trash2 />}
              Schedule deletion
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
