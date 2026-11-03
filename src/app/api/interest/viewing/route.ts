import { portfolioSharePathSchema } from "@/features/portfolio/share-path";
import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { guestVerificationDigest, guestViewingRpc, newGuestViewingProof, rememberGuestViewing } from "@/features/access/server/guest-viewing-proof";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { anonymousSubjectHash } from "@/features/security/server/rate-limit.service";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readJsonBody, requireSameOrigin, RequestSecurityError, requestSecurityErrorResponse } from "@/lib/api/request-security";

const shareToken = portfolioSharePathSchema;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), shareToken, email: z.email().max(180) }).strict(),
  z.object({ action: z.literal("complete"), challengeId: z.uuid(), email: z.email().max(180), code: z.string().regex(/^[0-9]{6}$/) }).strict(),
]);
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = schema.safeParse(await readJsonBody(request, 2048));
    if (!parsed.success) return failure(400, "Check the email and verification code.");
    const rpc = guestViewingRpc(createServiceRoleClient());
    const email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.action === "start") {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const result = await rpc("begin_guest_portfolio_access_verification", {
        p_share_token: parsed.data.shareToken, p_email: email,
        p_code_digest: guestVerificationDigest("view-code", `${email}:${code}`),
        p_email_subject_hash: guestVerificationDigest("address", email),
        p_network_subject_hash: await anonymousSubjectHash(request),
      });
      if (result.error?.code === "P0429") return failure(429, "Too many codes requested. Please wait and try again.");
      const started = z.object({ challengeId: z.uuid(), eligible: z.boolean() }).safeParse(result.data);
      if (result.error || !started.success) return failure(503, "We could not start verification. Please try again.");
      if (started.data.eligible) {
        const delivery = await sendResendEmail({ deliveryId: started.data.challengeId, to: email,
          subject: "Your VivIntro portfolio viewing code",
          text: `Your portfolio viewing code is ${code}. It expires in 10 minutes. Enter it on the VivIntro page to view the portfolio shared with this email. This code creates no account or VivIntro sign-in. If you did not request it, ignore this email.` });
        if (delivery.status !== "accepted") return failure(503, "We could not send the code. Please try again.");
      }
      return NextResponse.json({ sent: true, challengeId: started.data.challengeId }, { headers });
    }
    const proof = newGuestViewingProof();
    const completed = await rpc("complete_guest_portfolio_access_verification", {
      p_id: parsed.data.challengeId, p_code_digest: guestVerificationDigest("view-code", `${email}:${parsed.data.code}`), p_proof_hash: proof.hash,
    });
    const result = z.object({ status: z.string(), shareToken: shareToken.optional() }).safeParse(completed.data);
    if (completed.error || !result.success) return failure(503, "We could not verify the code. Please try again.");
    if (result.data.status === "invalid_code") return failure(400, "That code is incorrect. Try again.");
    if (result.data.status !== "verified" || !result.data.shareToken) return failure(410, "This code or approval has expired. Request a new code if access is still active.");
    const response = NextResponse.json({ verified: true, path: `/p/${encodeURIComponent(result.data.shareToken)}` }, { headers });
    rememberGuestViewing(response, result.data.shareToken, proof.value);
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return failure(503, "Portfolio verification is temporarily unavailable. Please try again.");
  }
}
