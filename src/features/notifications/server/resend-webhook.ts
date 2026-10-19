import "server-only";
import { createHash } from "node:crypto";
import { Webhook } from "svix";
import { z } from "zod/v4";

const statuses = {
  "email.sent": "sent", "email.delivered": "delivered", "email.bounced": "bounced",
  "email.complained": "complained", "email.suppressed": "suppressed",
  "email.failed": "failed", "email.delivery_delayed": "delayed",
} as const;
const envelope = z.object({ type: z.string().min(1).max(100) });
// Strip provider fields rather than accepting them as storage/logging arguments.
const deliveryEvent = z.object({ created_at: z.iso.datetime({ offset: true }), data: z.object({
  email_id: z.uuid(), tags: z.object({ vivintro_delivery: z.uuid().optional() }).optional(),
}) });
export class ResendWebhookError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

export function resendWebhookConfigured() {
  return /^whsec_[A-Za-z0-9+/=]{16,512}$/.test(process.env.RESEND_WEBHOOK_SECRET ?? "");
}

export function verifyResendWebhook(raw: Uint8Array, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !resendWebhookConfigured()) {
    throw new ResendWebhookError("RESEND_WEBHOOK_UNAVAILABLE", 503);
  }
  const id = headers.get("svix-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? "";
  const signature = headers.get("svix-signature") ?? "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !/^\d{10}$/.test(timestamp) || signature.length > 2048 || !signature) {
    throw new ResendWebhookError("RESEND_WEBHOOK_UNAUTHORIZED", 401);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw);
    // Svix checks the original body, multiple rotation signatures and freshness.
    new Webhook(secret).verify(text, { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature });
  } catch {
    throw new ResendWebhookError("RESEND_WEBHOOK_UNAUTHORIZED", 401);
  }
  let body: unknown;
  try { body = JSON.parse(text); } catch {
    throw new ResendWebhookError("RESEND_WEBHOOK_INVALID", 400);
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) throw new ResendWebhookError("RESEND_WEBHOOK_INVALID", 400);
  const type = parsed.data.type;
  if (!Object.hasOwn(statuses, type)) return null;
  const event = deliveryEvent.safeParse(body);
  if (!event.success || Date.parse(event.data.created_at) > Date.now() + 300_000) {
    throw new ResendWebhookError("RESEND_WEBHOOK_INVALID", 400);
  }
  return {
    p_event_id: id, p_event_digest: createHash("sha256").update(raw).digest("hex"),
    p_provider_message_id: event.data.data.email_id, p_status: statuses[type as keyof typeof statuses],
    p_occurred_at: event.data.created_at,
    ...(event.data.data.tags?.vivintro_delivery ? { p_delivery_id: event.data.data.tags.vivintro_delivery } : {}),
  };
}
