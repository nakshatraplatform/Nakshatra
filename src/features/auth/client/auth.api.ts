import { boundedJsonRequest, JsonRequestInterrupted } from "@/lib/api/bounded-json-request";

export type AuthStartPayload =
  | { method: "google"; redirect: string; email?: string }
  | { method: "password_signup"; email: string; password: string; redirect: string }
  | { method: "password_signin"; email: string; password: string; redirect: string }
  | { method: "email_otp"; email: string; redirect: string }
  | { method: "pilot_access_otp"; email: string }
  | { method: "resend_signup"; email: string; redirect: string }
  | { method: "password_recovery"; email: string; redirect?: string };

type AuthResponse = {
  url?: string;
  sent?: boolean;
  authenticated?: boolean;
  verificationRequired?: boolean;
  verified?: boolean;
  updated?: boolean;
  email?: string;
  redirect?: string;
  error?: string;
  code?: string;
};

async function postAuth(path: string, payload: unknown, signal?: AbortSignal) {
  try {
    const { response, body } = await boundedJsonRequest<AuthResponse>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    return { ok: response.ok, body };
  } catch (error) {
    if (error instanceof JsonRequestInterrupted) return {
      ok: false,
      body: {
        code: error.reason === "timeout" ? "AUTH_REQUEST_TIMEOUT" : "AUTH_REQUEST_CANCELLED",
        error: "We could not confirm the response. The request may have completed. Check your email or sign-in status before trying again.",
      },
    };
    return {
      ok: false,
      body: {
        code: "AUTH_NETWORK_ERROR",
        error: "We could not connect. Check your internet connection and try again.",
      },
    };
  }
}

/** Calls the same-origin auth gateway so every provider receives application rate limiting. */
export function startAuthentication(payload: AuthStartPayload, signal?: AbortSignal) {
  return postAuth("/api/auth/start", payload, signal);
}

/** Exchanges a six-digit email code for an authenticated session. */
export function verifyAuthenticationCode(payload: {
  purpose: "owner_signup" | "viewer_interest" | "pilot_access";
  email: string;
  token: string;
  redirect: string;
}, signal?: AbortSignal) {
  return postAuth("/api/auth/verify", payload, signal);
}

/** Finishes a password-recovery session with a replacement password. */
export function updateRecoveredPassword(password: string) {
  return postAuth("/api/auth/password", { password });
}

/** Leaves the application only for the provider URL returned by the trusted auth gateway. */
export function continueToAuthProvider(url: string) {
  window.location.assign(url);
}
