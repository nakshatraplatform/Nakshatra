import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const guestViewingLifetime = 15 * 24 * 60 * 60;
const proofPattern = /^[A-Za-z0-9_-]{43}$/;

export function guestVerificationConfigured() {
  const value = process.env.GUEST_INTEREST_OTP_SECRET;
  return Boolean(value && value.length >= 32 && value.length <= 512);
}

export function guestVerificationDigest(purpose: string, value: string) {
  if (!guestVerificationConfigured()) throw new Error("GUEST_VERIFICATION_NOT_CONFIGURED");
  return createHmac("sha256", process.env.GUEST_INTEREST_OTP_SECRET!)
    .update(`vivintro-guest-interest:v1:${purpose}:${value}`).digest("hex");
}

export function guestViewingCookieName(token: string) {
  return `vivintro_view_${createHash("sha256").update(token).digest("hex").slice(0, 24)}`;
}

export function hashGuestViewingProof(value: string | undefined) {
  return value && proofPattern.test(value) ? createHash("sha256").update(value).digest("hex") : null;
}

export function newGuestViewingProof() {
  const value = randomBytes(32).toString("base64url");
  return { value, hash: hashGuestViewingProof(value)! };
}

/** Cookie authority is restricted again by request, recipient and live grant in SQL. */
export function rememberGuestViewing(response: NextResponse, token: string, value: string) {
  response.cookies.set(guestViewingCookieName(token), value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: `/p/${encodeURIComponent(token)}`, maxAge: guestViewingLifetime, priority: "high",
  });
}

type Arguments = {
  complete_guest_interest_and_remember: { p_id: string; p_code_digest: string; p_network_subject_hash: string; p_proof_hash: string };
  begin_guest_portfolio_access_verification: { p_share_token: string; p_email: string; p_code_digest: string; p_email_subject_hash: string; p_network_subject_hash: string };
  complete_guest_portfolio_access_verification: { p_id: string; p_code_digest: string; p_proof_hash: string };
  resolve_guest_approved_portfolio: { p_share_token: string; p_proof_hash: string; p_horoscope?: boolean };
  guest_portfolio_delivery_health: Record<string, never>;
};

/** Database prerequisite is deployed separately; keep this adapter until type generation includes it. */
export function guestViewingRpc(client: SupabaseClient) {
  return client.rpc.bind(client) as unknown as <Name extends keyof Arguments>(
    name: Name, args: Arguments[Name],
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
}
