import { createHmac } from "node:crypto";
import { z } from "zod/v4";
import { emailMessageSchema } from "./email-message.schema.mjs";
import { sendResendEmail as dispatch, resendConfigurationReady } from "./resend.runtime.mjs";

const preparation = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), claimToken: z.uuid() }),
  z.object({ status: z.literal("accepted"), providerMessageId: z.uuid() }),
  z.object({ status: z.enum(["suppressed", "conflict", "expired", "busy"]) }),
]);
const failure = (code, retryable = false) => ({ status: "failed", code, retryable });

export function recipientHmacConfigured() {
  const key = process.env.EMAIL_RECIPIENT_HMAC_KEY;
  return Boolean(key && key.length >= 32 && key.length <= 512);
}

/** Shared application guard. The DB holds only keyed digests, never email content. */
export async function sendTrackedEmail(input, client, transport = fetch) {
  const message = emailMessageSchema.safeParse(input);
  if (!message.success) return failure("EMAIL_INPUT_INVALID");
  const key = process.env.EMAIL_RECIPIENT_HMAC_KEY;
  if (!recipientHmacConfigured() || !resendConfigurationReady()) return failure("EMAIL_NOT_CONFIGURED");
  const digest = (purpose, value) => createHmac("sha256", key).update(`${purpose}\n${value}`).digest("hex");
  const normalized = message.data.to.trim().toLowerCase();
  try {
    const result = await client.rpc("prepare_application_email", {
      p_delivery_id: message.data.deliveryId,
      p_recipient_hash: digest("recipient-v1", normalized),
      p_message_digest: digest("message-v1", JSON.stringify({ ...message.data, to: normalized,
        from: process.env.RESEND_FROM_EMAIL, replyTo: process.env.RESEND_REPLY_TO_EMAIL || undefined })),
    });
    const ready = preparation.safeParse(result.data);
    if (result.error || !ready.success) return failure("EMAIL_DELIVERY_GUARD_UNAVAILABLE", true);
    if (ready.data.status === "suppressed") return failure("EMAIL_RECIPIENT_SUPPRESSED");
    if (ready.data.status === "conflict") return failure("EMAIL_IDEMPOTENCY_CONFLICT");
    if (ready.data.status === "expired") return failure("EMAIL_RETRY_WINDOW_EXPIRED");
    if (ready.data.status === "busy") return failure("EMAIL_DELIVERY_GUARD_UNAVAILABLE", true);
    if (ready.data.status === "accepted") return { status: "accepted", providerMessageId: ready.data.providerMessageId };
    const sent = await dispatch({ ...message.data, to: normalized }, transport);
    const finished = await client.rpc("finish_application_email", {
      p_delivery_id: message.data.deliveryId, p_claim_token: ready.data.claimToken,
      p_provider_message_id: sent.status === "accepted" ? sent.providerMessageId : null,
      p_error_code: sent.status === "failed" ? sent.code : null,
      p_retryable: sent.status === "failed" && sent.retryable,
    });
    if (finished.error || finished.data !== true) return failure("EMAIL_DELIVERY_GUARD_UNAVAILABLE", true);
    return sent;
  } catch {
    return failure("EMAIL_DELIVERY_GUARD_UNAVAILABLE", true);
  }
}
