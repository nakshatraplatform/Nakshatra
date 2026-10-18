"use client";

import { LoadingStatus } from "@/components/loading/LoadingStatus";

import { VivIntroBrand } from "@/components/brand/VivIntroBrand";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";


import { useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { updateRecoveredPassword } from "@/features/auth/client/auth.api";
import { sanitizeInternalRedirect } from "@/lib/security/redirect";
import {
  isAcceptablePassword,
  PASSWORD_HELP,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/features/auth/password-policy";

export function ResetPasswordForm({ returnTo }: { returnTo?: string } = {}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"password" | "confirmation" | null>(null);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const errorId = useId();
  const helpId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const destination = sanitizeInternalRedirect(returnTo);
  const loginHref = `/login?redirect=${encodeURIComponent(destination)}`;

  function fieldError(field: "password" | "confirmation", message: string) {
    setError(message);
    setErrorField(field);
    (field === "password" ? passwordRef : confirmationRef).current?.focus();
  }

  function clearFieldError() {
    if (!errorField) return;
    setError("");
    setErrorField(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setErrorField(null);
    setRecoveryRequired(false);
    if (password !== confirmation) {
      fieldError("confirmation", "The passwords do not match.");
      return;
    }
    if (!isAcceptablePassword(password)) {
      fieldError("password", PASSWORD_HELP);
      return;
    }
    setPending(true);
    const { ok, body } = await updateRecoveredPassword(password);
    if (!ok || !body?.updated) {
      if (body?.code === "PASSWORD_INVALID") fieldError("password", body.error || PASSWORD_HELP);
      else {
        setRecoveryRequired(["AUTH_SESSION_MISSING", "AUTH_SESSION_INVALID", "AUTH_SESSION_REVOKED"].includes(body?.code ?? ""));
        setError(body?.code === "PASSWORD_UPDATE_FAILED"
          ? "We could not update your password. Please try again."
          : body?.error || "We could not update your password. Please try again.");
      }
      setPending(false);
      return;
    }
    router.replace(destination === "/dashboard" ? "/dashboard?password=updated" : destination);
    router.refresh();
  }

  return (
    <div className="account-shell">
      <header className="account-header">
        <VivIntroBrand href="/" variant="horizontal" priority />
        <div className="app-header-actions"><ThemeSwitch /><Link href={loginHref} className="account-home">Back to sign in</Link></div>
      </header>
      <main id="main-content" tabIndex={-1} className="account-main">
        <section className="account-panel">
          <div className="account-brand-lockup"><VivIntroBrand variant="stacked" decorative displayWidth={142} priority /></div>
          <p className="account-eyebrow">Account security</p>
          <h1 className="account-title">Choose a new password.</h1>
          <p id={helpId} className="account-copy">{PASSWORD_HELP} Do not reuse a password from another account. After saving, you’ll return to where you left off.</p>
          {pending && <LoadingStatus compact title="Saving your new password" className="my-4" />}
          <form className="account-form" onSubmit={submit}>
            <PasswordField
              id="new-password"
              inputRef={passwordRef}
              helpId={helpId}
              errorId={errorField === "password" ? errorId : undefined}
              label="New password"
              value={password}
              show={showPassword}
              onChange={value => { setPassword(value); clearFieldError(); }}
              onToggle={() => setShowPassword((shown) => !shown)}
            />
            <PasswordField
              id="confirm-password"
              inputRef={confirmationRef}
              helpId={helpId}
              errorId={errorField === "confirmation" ? errorId : undefined}
              label="Confirm new password"
              value={confirmation}
              show={showPassword}
              onChange={value => { setConfirmation(value); clearFieldError(); }}
              onToggle={() => setShowPassword((shown) => !shown)}
            />
            {error && <p id={errorId} className="account-error" role="alert">{error}{recoveryRequired && <> <Link href={loginHref}>Return to sign in to request a new recovery email.</Link></>}</p>}
            <button className="auth-primary-btn" type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save new password"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function PasswordField({
  id,
  inputRef,
  helpId,
  errorId,
  label,
  value,
  show,
  onChange,
  onToggle,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  helpId: string;
  errorId?: string;
  label: string;
  value: string;
  show: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <KeyRound aria-hidden="true" />
        <input
          id={id}
          ref={inputRef}
          name={id}
          aria-invalid={Boolean(errorId) || undefined}
          aria-describedby={[helpId, errorId].filter(Boolean).join(" ")}
          className="auth-input"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <button
          type="button"
          className="account-password-toggle"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
