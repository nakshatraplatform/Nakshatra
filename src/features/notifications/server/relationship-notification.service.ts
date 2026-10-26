import "server-only";
import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import type { Database, Json } from "@/types/database.generated";
import { portfolioDraftSchema } from "@/types/portfolio";
import { sendResendEmail } from "./resend.provider";

const relationshipType = z.enum([
  "vivara_published", "interest_received",
  "new_introduction", "full_view_approved", "introduction_declined",
  "full_view_renewed", "full_view_revoked", "full_view_expiring",
  "full_view_access_expiring",
  "broker_introduction_ready", "broker_introduction_response",
  "broker_mutual_interest", "broker_introduction_revoked",
  "broker_introduction_expired", "broker_complete_access_expired",
]);
const brokerNotificationType = z.enum([
  "broker_introduction_ready", "broker_introduction_response",
  "broker_mutual_interest", "broker_introduction_revoked",
  "broker_introduction_expired", "broker_complete_access_expired",
]);
const introductionRef = z.string().regex(/^bir_[0-9a-f]{32}$/);
const workspaceRef = z.string().regex(/^wrk_[0-9a-f]{32}$/);
const brokerPayload = z.object({
  introductionRef,
  workspaceRef: workspaceRef.optional(),
  audience: z.enum(["source", "recipient", "broker"]),
}).strict();
const claimedJob = z.object({
  notification_ref: z.string().regex(/^ntf_[0-9a-f]{32}$/),
  recipient_user_id: z.uuid(),
  notification_type: relationshipType,
  attempt_count: z.number().int().positive(),
  interest_request_id: z.uuid().nullable(),
  grant_id: z.uuid().nullable(),
  broker_introduction_id: z.uuid().nullable().optional().default(null),
  payload: z.custom<Json>(),
});
const appOrigin = z.url().transform((value) => new URL(value).origin);

type Client = SupabaseClient<Database>;
type Job = z.infer<typeof claimedJob>;

class NotificationRenderError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
  }
}

function deliveryId(notificationRef: string) {
  const value = notificationRef.slice(4);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "UTC", timeZoneName: "short",
  }).format(new Date(value));
}

const expiryContext = z.object({
  schemaVersion: z.literal(1).optional(),
  audience: z.enum(["owner", "viewer"]),
  expiresAt: z.iso.datetime({ offset: true }),
  portfolioId: z.uuid(),
});
const isExpiryReminder = (job: Job) => job.notification_type === "full_view_expiring" || job.notification_type === "full_view_access_expiring";

function renderExpiryReminder(job: Job, to: string, origin: string) {
  const context = expiryContext.safeParse(job.payload);
  if (!context.success || !job.grant_id
    || context.data.audience !== (job.notification_type === "full_view_expiring" ? "viewer" : "owner")) {
    throw new NotificationRenderError("REMINDER_CONTEXT_INVALID", false);
  }
  const expiry = formatExpiry(context.data.expiresAt);
  // No mutable portfolio name or personal details: retries keep the same text.
  return context.data.audience === "owner"
    ? { to, subject: "Sharing period ends soon", text: `A viewer's access to your private details ends on ${expiry}.\n\nReview sharing in your VivIntro dashboard: ${origin}/dashboard` }
    : { to, subject: "Your sharing period ends soon", text: `Your access to the shared private details ends on ${expiry}.\n\nOpen the introduction using the same verified email: ${origin}/access/${encodeURIComponent(job.grant_id)}\n\nForwarding this email does not transfer access.` };
}

async function renderJob(supabase: Client, job: Job, origin: string) {
  const isBrokerNotification = brokerNotificationType.safeParse(job.notification_type).success;
  if (isBrokerNotification) {
    if (!job.broker_introduction_id) {
      throw new NotificationRenderError("BROKER_INTRODUCTION_UNAVAILABLE", false);
    }
    const { data: currentRecipient, error: recipientValidationError } = await supabase.rpc(
      "broker_notification_recipient_is_current",
      {
        p_broker_introduction_id: job.broker_introduction_id,
        p_recipient_user_id: job.recipient_user_id,
        p_notification_type: job.notification_type,
      },
    );
    if (recipientValidationError) {
      throw new NotificationRenderError("BROKER_RECIPIENT_CHECK_FAILED", true);
    }
    if (currentRecipient !== true) {
      throw new NotificationRenderError("BROKER_RECIPIENT_STALE", false);
    }
  }

  const { data: recipient, error: recipientError } = await supabase.auth.admin.getUserById(job.recipient_user_id);
  const to = recipient.user?.email?.trim().toLowerCase();
  if (recipientError) throw new NotificationRenderError("RECIPIENT_LOOKUP_FAILED", true);
  if (!to) throw new NotificationRenderError("RECIPIENT_UNAVAILABLE", false);
  if (isExpiryReminder(job)) return renderExpiryReminder(job, to, origin);

  if (isBrokerNotification) {
    const payload = brokerPayload.safeParse(job.payload);
    if (!payload.success) throw new NotificationRenderError("BROKER_NOTIFICATION_PAYLOAD_INVALID", false);
    const customerUrl = `${origin}/introductions/${encodeURIComponent(payload.data.introductionRef)}`;

    if (job.notification_type === "broker_introduction_response") {
      if (payload.data.audience !== "broker" || !payload.data.workspaceRef) {
        throw new NotificationRenderError("BROKER_NOTIFICATION_PAYLOAD_INVALID", false);
      }
      return {
        to,
        subject: "A customer responded to an introduction",
        text: `A customer has responded to a VivIntroDesk introduction. Sign in to review the response and decide the next step:\n\n${origin}/brokerdesk/w/${encodeURIComponent(payload.data.workspaceRef)}/dashboard\n\nThe email does not contain the response or any portfolio details.`,
      };
    }
    if (payload.data.audience === "broker") {
      throw new NotificationRenderError("BROKER_NOTIFICATION_PAYLOAD_INVALID", false);
    }
    if (job.notification_type === "broker_introduction_ready") {
      return { to, subject: "A broker introduction is ready", text: `Your broker has shared a VivIntro introduction for you to review. Sign in to view it and respond:\n\n${customerUrl}\n\nThe link works only for the selected VivIntro customers. Forwarding this email does not transfer access.` };
    }
    if (job.notification_type === "broker_mutual_interest") {
      return { to, subject: "Mutual interest is confirmed", text: `Both customers have shown interest. You can now view the other customer's pinned Complete Portfolio, including Protected Contact, for 30 days:\n\n${customerUrl}\n\nSign-in and current relationship permissions are still required.` };
    }
    if (job.notification_type === "broker_introduction_revoked") {
      return { to, subject: "A broker introduction has ended", text: `This broker introduction is no longer available. Sign in to see your current Introduction history:\n\n${origin}/dashboard` };
    }
    if (job.notification_type === "broker_introduction_expired") {
      return { to, subject: "A broker introduction has closed", text: `The 15-day response window has ended. Expiration is not treated as a rejection. Sign in to see your Introduction history:\n\n${origin}/dashboard` };
    }
    return { to, subject: "Complete Portfolio access has ended", text: `The 30-day Complete Portfolio access period has ended. Protected Contact is no longer available through this Introduction.\n\nReview your Introduction history: ${origin}/dashboard` };
  }

  if (job.notification_type === "vivara_published") {
    return { to, subject: "Your Vivara has been published", text: `You published your Vivara. You can manage its current link and sharing settings in your VivIntro dashboard:\n\n${origin}/dashboard\n\nPrivate details remain subject to your sharing permissions.` };
  }
  if (job.notification_type === "interest_received") {
    return { to, subject: "Your request has been received", text: `Your request to view private details was received. Submitting a request does not grant access; the owner decides whether to share. We will email you when a decision is made.\n\nUse the same verified email when returning to VivIntro: ${origin}/dashboard` };
  }
  if (job.notification_type === "new_introduction") {
    return { to, subject: "Someone has shown interest", text: `Someone has confirmed their email and introduced themselves.\n\nReview their interest in your VivIntro dashboard: ${origin}/dashboard\n\nRead their details before deciding whether to share private details. Email confirmation is not proof of identity.` };
  }
  if (job.notification_type === "introduction_declined") {
    return { to, subject: "Update on your VivIntro introduction", text: "The person you contacted is not sharing private details at this time. The details you sent remain subject to VivIntro’s privacy and retention rules." };
  }
  if (job.notification_type === "full_view_revoked") {
    return { to, subject: "Sharing has stopped", text: "The person who shared their introduction has stopped sharing private details. The link will no longer open those details." };
  }


  if (!job.grant_id) throw new NotificationRenderError("GRANT_UNAVAILABLE", false);
  const { data: grant, error: grantError } = await supabase
    .from("reveal_grants")
    .select("id, expires_at, portfolio_id, revoked_at")
    .eq("id", job.grant_id)
    .maybeSingle();
  if (grantError) throw new NotificationRenderError("GRANT_LOOKUP_FAILED", true);
  if (!grant || grant.revoked_at || Date.parse(grant.expires_at) <= Date.now()) throw new NotificationRenderError("GRANT_UNAVAILABLE", false);
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("draft_data")
    .eq("id", grant.portfolio_id)
    .maybeSingle();
  const draft = portfolioDraftSchema.safeParse(portfolio?.draft_data);
  const ownerName = draft.success ? draft.data.personal.name?.trim() : "";
  const accessUrl = `${origin}/access/${encodeURIComponent(grant.id)}`;
  const expiry = formatExpiry(grant.expires_at);



  const renewed = job.notification_type === "full_view_renewed";
  return {
    to,
    subject: renewed ? "Private details shared for another 15 days" : "Private details shared with you",
    text: `${ownerName || "The person you contacted"} has shared private details with you for ${renewed ? "another " : ""}15 days.\n\nView the introduction: ${accessUrl}\n\nSharing ends on ${expiry}. Verify the same email address that received this message. Forwarding this email does not transfer access. The person sharing may stop sharing early.`,
  };
}

/** Claims and delivers durable relationship notifications without mixing in pilot-access jobs. */
export async function processRelationshipNotifications(supabase: Client, limit = 10, transport?: typeof fetch) {
  const origin = appOrigin.parse(process.env.NEXT_PUBLIC_APP_URL);
  const { data, error } = await supabase.rpc("claim_relationship_notification_outbox", { p_limit: limit });
  if (error) throw error;
  const jobs = z.array(claimedJob).parse(data || []);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    let succeeded = false;
    let errorCode: string | null = null;
    let retryable = false;
    try {
      const message = await renderJob(supabase, job, origin);
      if (isExpiryReminder(job)) {
        const { data: preparation, error: prepareError } = await supabase.rpc("prepare_full_view_expiry_email", {
          p_notification_ref: job.notification_ref, p_attempt_count: job.attempt_count,
          p_recipient_email_hash: createHash("sha256").update(message.to).digest("hex"),
          p_message_digest: createHash("sha256").update(JSON.stringify(message)).digest("hex"),
        });
        if (prepareError) throw new NotificationRenderError("REMINDER_PREPARE_FAILED", true);
        if (preparation === "skipped") { skipped += 1; continue; }
        if (preparation === "unavailable") { failed += 1; continue; }
        if (preparation !== "ready") throw new NotificationRenderError("REMINDER_PREPARE_FAILED", true);
      }
      const input = { deliveryId: deliveryId(job.notification_ref), ...message };
      const result = await sendResendEmail(input, transport, supabase);
      succeeded = result.status === "accepted";
      errorCode = result.status === "failed" ? result.code : null;
      retryable = result.status === "failed" && result.retryable;
    } catch (jobError) {
      errorCode = jobError instanceof Error && /^[A-Z0-9_]{3,80}$/.test(jobError.message)
        ? jobError.message
        : "NOTIFICATION_RENDER_FAILED";
      retryable = jobError instanceof NotificationRenderError && jobError.retryable;
    }
    const { data: completion, error: completionError } = await supabase.rpc("complete_relationship_notification_outbox", {
      p_notification_ref: job.notification_ref,
      p_attempt_count: job.attempt_count,
      p_succeeded: succeeded,
      ...(errorCode === null ? {} : { p_error_code: errorCode }),
      p_retryable: retryable,
    });
    if (completionError) throw completionError;
    const expectedCompletion = succeeded
      ? "sent"
      : retryable && job.attempt_count < 5
        ? "queued"
        : "failed";
    // The database may close the retry window while this send is in flight.
    if (completion !== expectedCompletion && !(expectedCompletion === "queued" && completion === "failed")) {
      throw new Error(`notification completion was ${completion || "unavailable"}; expected ${expectedCompletion}`);
    }
    if (succeeded) sent += 1;
    else failed += 1;
  }
  return { claimed: jobs.length, sent, failed, skipped };
}
