import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { interestSubmissionSchema, interestRequestValidationMessage } from "@/features/interest/server/interest.contract";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { anonymousSubjectHash } from "@/features/security/server/rate-limit.service";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readJsonBody, requireSameOrigin, RequestSecurityError, requestSecurityErrorResponse } from "@/lib/api/request-security";

const startSchema = z.object({ action: z.literal("start"), details: z.unknown() }).strict();
const completeSchema = z.object({
  action: z.literal("complete"), challengeId: z.uuid(),
  email: z.email().max(180), code: z.string().regex(/^[0-9]{6}$/),
}).strict();
const requestSchema = z.discriminatedUnion("action", [startSchema, completeSchema]);
const otpSecretSchema = z.string().min(32);
const privateHeaders = { "Cache-Control": "private, no-store" };

function digest(kind: string, value: string) {
  const secret = otpSecretSchema.parse(process.env.GUEST_INTEREST_OTP_SECRET);
  return createHmac("sha256", secret).update(`vivintro-guest-interest:v1:${kind}:${value}`).digest("hex");
}

function failure(status: number, code: string, error: string) {
  return NextResponse.json({ code, error }, { status, headers: privateHeaders });
}

/** Accountless verification: no Auth API, cookies, or user creation on this route. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = requestSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return failure(400, "INVALID_REQUEST", "Check the verification request and try again.");
    const supabase = createServiceRoleClient();
    const networkHash = await anonymousSubjectHash(request);

    if (parsed.data.action === "start") {
      const details = interestSubmissionSchema.safeParse(parsed.data.details);
      if (!details.success || details.data.useExistingProfile) {
        return failure(400, "INTEREST_REQUEST_INVALID", details.success
          ? "Complete the visitor details before continuing."
          : interestRequestValidationMessage(details.error));
      }
      const email = details.data.email.trim().toLowerCase();
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const { data: challengeId, error } = await supabase.rpc("begin_guest_interest_verification", {
        p_details: details.data,
        p_code_digest: digest("code", `${email}:${code}`),
        p_email_subject_hash: digest("address", email),
        p_network_subject_hash: networkHash,
      });
      if (error?.code === "P0429") return failure(429, "RATE_LIMITED", "Too many codes requested. Please wait and try again.");
      if (error) return failure(503, "VERIFICATION_UNAVAILABLE", "We could not start verification. Please try again.");
      if (!challengeId) return failure(404, "PORTFOLIO_UNAVAILABLE", "This introduction is not available.");
      const delivery = await sendResendEmail({
        deliveryId: challengeId,
        to: email,
        subject: "Your VivIntro Show interest code",
        text: `Your six-digit VivIntro Show interest code is ${code}. It expires in 10 minutes. Enter it on the introduction page to send your request. This code does not sign you in or create an account. If you did not request it, you can ignore this email.`,
      });
      if (delivery.status !== "accepted") {
        await supabase.rpc("cancel_guest_interest_verification", { p_id: challengeId });
        return failure(503, "EMAIL_UNAVAILABLE", "We could not send the code. Please try again.");
      }
      return NextResponse.json({ sent: true, challengeId }, { headers: privateHeaders });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { data: result, error } = await supabase.rpc("complete_guest_interest_verification", {
      p_id: parsed.data.challengeId,
      p_code_digest: digest("code", `${email}:${parsed.data.code}`),
      p_network_subject_hash: networkHash,
    });
    if (error) return failure(503, "VERIFICATION_UNAVAILABLE", "We could not verify the code. Please try again.");
    if (result === "submitted") return NextResponse.json({ submitted: true }, { status: 201, headers: privateHeaders });
    if (result === "invalid_code") return failure(400, "INVALID_CODE", "That code is incorrect. Try again.");
    if (result === "expired") return failure(410, "EXPIRED_CODE", "This code has expired. Send a new code.");
    if (result === "existing_request") return failure(409, "INTEREST_REQUEST_EXISTS", "An interest request from this email already exists for this introduction.");
    if (result === "own_portfolio") return failure(409, "OWN_PORTFOLIO_INTEREST", "You cannot show interest in your own introduction.");
    if (result === "unavailable") return failure(404, "PORTFOLIO_UNAVAILABLE", "This introduction is no longer available.");
    if (result === "rate_limited") return failure(429, "RATE_LIMITED", "Too many requests. Please wait and try again.");
    return failure(503, "VERIFICATION_UNAVAILABLE", "We could not complete your request. Please try again.");
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return failure(503, "VERIFICATION_UNAVAILABLE", "Verification is temporarily unavailable. Please try again.");
  }
}
