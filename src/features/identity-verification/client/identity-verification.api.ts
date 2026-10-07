import { candidateVerificationConsentVersion } from "@/features/identity-verification/identity-verification.types";
import type { CandidateRecovery } from "../candidate-recovery.types";
export type IdentityVerificationApiFailure = { ok: false; code: string; message: string; status: number; managementUrl?: string; retryAfter?: number; retryScope?: "creation" | "interaction" };
export type IdentityVerificationApiResult<T> = { ok: true; data: T } | IdentityVerificationApiFailure;
export type HostedIdentityVerification = { url: string; managementUrl: string };

/** Same-tab handoff after server attachment/authorization; fallback link remains visible. */
export function navigateToDiditVerification(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://verify.didit.me" || url.username || url.password) return;
    window.location.assign(url.href);
  } catch { /* Leave the explicit fallback link available if navigation is blocked. */ }
}

export async function identityVerificationRequest<T>(url: string, init: RequestInit): Promise<IdentityVerificationApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as (T & { code?: string; error?: string; managementUrl?: string }) | null;
    if (!response.ok) {
      const header = response.headers.get("Retry-After");
      const duration = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 0;
      const retryAfter = Number.isFinite(duration) && duration > 0 ? Math.min(86400, duration) : undefined;
      const reference = response.headers.get("X-Request-Id");
      const supportReference = reference && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference) ? ` Reference: ${reference}.` : "";
      return {
        ok: false,
        code: body?.code || "IDENTITY_VERIFICATION_REQUEST_FAILED",
        message: (body?.error || "We could not complete identity verification.") + supportReference,
        status: response.status,
        ...(body?.managementUrl ? { managementUrl: body.managementUrl } : {}),
        ...(retryAfter ? { retryAfter } : {}),
        ...(retryAfter ? { retryScope: response.headers.get("X-RateLimit-Scope") === "creation" ? "creation" as const : "interaction" as const } : {}),
      };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, code: "NETWORK_UNAVAILABLE", message: "VivIntro is temporarily unreachable.", status: 0 };
  }
}

export function getCurrentCandidateVerificationRequest(candidateId: string, signal?: AbortSignal) {
  return identityVerificationRequest<CandidateRecovery>(`/api/identity-verification/current?candidateId=${encodeURIComponent(candidateId)}`, { method: "GET", cache: "no-store", signal });
}
export function resumeCandidateVerificationRequest(candidateId: string, attemptId: string) {
  return identityVerificationRequest<{ url?: string; awaitingResult?: true }>("/api/identity-verification/resume", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId, attemptId }),
  });
}
export function cancelCandidateVerificationRequest(candidateId: string, attemptId: string) {
  return identityVerificationRequest<CandidateRecovery>("/api/identity-verification/cancel", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId, attemptId }),
  });
}

export type IdentityVerificationLink =
  | { kind: "invitation"; status: "ready" }
  | { kind: "management"; status: string; canRetry: boolean; canWithdraw: boolean };

export function getIdentityVerificationLinkRequest(token: string) {
  return identityVerificationRequest<{ link: IdentityVerificationLink }>("/api/identity-verification/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function startInvitationIdentityVerificationRequest(token: string) {
  return identityVerificationRequest<HostedIdentityVerification>("/api/identity-verification/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorization: "invitation", token, consent: true, consentVersion: candidateVerificationConsentVersion }),
  });
}

/** Begins the authenticated primary-owner verification path after the dashboard consent notice. */
export function startSelfIdentityVerificationRequest(candidateId: string) {
  return identityVerificationRequest<HostedIdentityVerification & { attemptId: string }>("/api/identity-verification/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorization: "self", candidateId, consent: true, consentVersion: candidateVerificationConsentVersion }),
  });
}

/** Creates an opaque invitation for an accountless candidate; authorization is rechecked by the server. */
export function createIdentityVerificationInvitationRequest(candidateId: string) {
  return identityVerificationRequest<{ invitationUrl: string; expiresAt: string }>("/api/identity-verification/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId }),
  });
}

export function retryIdentityVerificationRequest(token: string) {
  return identityVerificationRequest<HostedIdentityVerification>("/api/identity-verification/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, consent: true, consentVersion: candidateVerificationConsentVersion }),
  });
}

export function withdrawIdentityVerificationConsentRequest(token: string) {
  return identityVerificationRequest<{ withdrawn: true }>("/api/identity-verification/status", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}
