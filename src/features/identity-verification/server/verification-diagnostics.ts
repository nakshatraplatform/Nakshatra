import "server-only";
import { randomUUID } from "node:crypto";

const safeCodes = new Set([
  "IDENTITY_VERIFICATION_PROVIDER_CREDENTIALS", "IDENTITY_VERIFICATION_PROVIDER_CREDITS",
  "IDENTITY_VERIFICATION_PROVIDER_RATE_LIMITED", "IDENTITY_VERIFICATION_PROVIDER_TIMEOUT",
  "IDENTITY_VERIFICATION_PROVIDER_REJECTED", "IDENTITY_VERIFICATION_PROVIDER_SESSION_MISSING",
  "IDENTITY_VERIFICATION_PROVIDER_CORRELATION_INVALID", "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID",
  "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE", "IDENTITY_VERIFICATION_PROVIDER_CLEANUP_FAILED",
  "IDENTITY_VERIFICATION_CONFIGURATION_INVALID", "IDENTITY_VERIFICATION_STATE_CONFLICT",
  "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE", "IDENTITY_VERIFICATION_START_FAILED",
  "RATE_LIMIT_UNAVAILABLE", "RATE_LIMIT_EXCEEDED",
]);

/** Correlates our safe error classes, never provider bodies or subject IDs. */
export async function verificationResponse(
  operation: "start" | "current" | "resume" | "cancel",
  handler: () => Promise<Response>,
) {
  const reference = randomUUID();
  let response: Response;
  try { response = await handler(); }
  catch {
    response = Response.json({ code: "IDENTITY_VERIFICATION_REQUEST_FAILED", error: "This action is temporarily unavailable. Please try again." }, { status: 503 });
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Request-Id", reference);
  if (response.status >= 400) {
    const body = await response.clone().json().catch(() => null);
    const code = safeCodes.has(body?.code) ? body.code : "IDENTITY_VERIFICATION_REQUEST_FAILED";
    console.warn("identity_verification_request_failed", { operation, code, status: response.status, reference });
  }
  return response;
}
