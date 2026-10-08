import { z } from "zod/v4";
import { sendResendEmail } from "../src/features/notifications/server/resend.runtime.mjs";

const claimSchema = z.object({ delivery_id: z.uuid(), claim_token: z.uuid(), recipient_email: z.email().max(254) });

/** Only private, database-authorized jobs enter this isolated worker. Never logs addresses. */
export async function processCandidateLivenessEmails(supabase, { send = sendResendEmail, limit = 5 } = {}) {
  const batchLimit = Math.min(Math.max(Number.isInteger(limit) ? limit : 5, 1), 10);
  const { data, error } = await supabase.rpc("claim_candidate_liveness_emails", { p_limit: batchLimit });
  const claims = z.array(claimSchema).max(batchLimit).safeParse(data);
  if (error || !claims.success) throw new Error("LIVENESS_EMAIL_CLAIM_FAILED");
  let accepted = 0;
  let failed = 0;
  for (const claim of claims.data) {
    let result;
    try {
      result = await send({ deliveryId: claim.delivery_id, to: claim.recipient_email,
        subject: "Your VivIntro liveness check is complete",
        text: "Your liveness check has been confirmed. Sign in at https://www.vivintro.com/dashboard to review your portfolio and any remaining publication steps. This confirms liveness only, not your identity or profile details. If your status has since changed, the dashboard shows the current result.",
      });
    } catch {
      result = { status: "failed", code: "EMAIL_PROVIDER_UNAVAILABLE", retryable: true };
    }
    const success = result.status === "accepted";
    const completion = await supabase.rpc("complete_candidate_liveness_email", {
      p_delivery_id: claim.delivery_id, p_claim_token: claim.claim_token,
      p_provider_message_id: success ? result.providerMessageId : null,
      p_error_code: success ? null : result.code, p_retryable: success ? false : result.retryable,
    });
    if (completion.error || completion.data !== true) throw new Error("LIVENESS_EMAIL_COMPLETION_FAILED");
    if (success) accepted++; else failed++;
  }
  return { accepted, failed };
}
