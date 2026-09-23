import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import type { Database, Json } from "@/types/database.generated";
import { portfolioDraftSchema } from "@/types/portfolio";
import { sendResendEmail } from "./resend.provider";

const relationshipType = z.enum([
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

  if (job.notification_type === "new_introduction") {
    return { to, subject: "A new verified introduction is waiting", text: `A verified viewer has introduced themselves.\n\nReview the introduction in your VivIntro dashboard: ${origin}/dashboard\n\nReview their verified contact and context before deciding whether to share the Complete Portfolio.` };
  }
  if (job.notification_type === "introduction_declined") {
    return { to, subject: "Update on your VivIntro introduction", text: "The portfolio owner is not sharing Complete Portfolio access at this time. Your verified contact information remains protected by VivIntro's access controls." };
  }
  if (job.notification_type === "full_view_revoked") {
    return { to, subject: "Your Complete Portfolio access has ended", text: "The portfolio owner has ended your Complete Portfolio access. The access link will no longer open protected details." };
  }
  if (job.notification_type === "full_view_access_expiring") {
    return { to, subject: "Complete Portfolio access expires soon", text: `A viewer's Complete Portfolio access expires within 24 hours.\n\nReview access in your VivIntro dashboard: ${origin}/dashboard` };
  }

  if (!job.grant_id) throw new NotificationRenderError("GRANT_UNAVAILABLE", false);
  const { data: grant, error: grantError } = await supabase
    .from("reveal_grants")
    .select("id, expires_at, portfolio_id, revoked_at")
    .eq("id", job.grant_id)
    .maybeSingle();
  if (grantError) throw new NotificationRenderError("GRANT_LOOKUP_FAILED", true);
  if (!grant || grant.revoked_at) throw new NotificationRenderError("GRANT_UNAVAILABLE", false);
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("draft_data")
    .eq("id", grant.portfolio_id)
    .maybeSingle();
  const draft = portfolioDraftSchema.safeParse(portfolio?.draft_data);
  const ownerName = draft.success ? draft.data.personal.name?.trim() : "";
  const accessUrl = `${origin}/access/${encodeURIComponent(grant.id)}`;
  const expiry = formatExpiry(grant.expires_at);

  if (job.notification_type === "full_view_expiring") {
    return { to, subject: "Your Complete Portfolio access expires soon", text: `Your access${ownerName ? ` to ${ownerName}'s Complete Portfolio` : ""} expires on ${expiry}.\n\nOpen the portfolio after verifying your email: ${accessUrl}\n\nForwarding this email does not transfer access.` };
  }

  const renewed = job.notification_type === "full_view_renewed";
  return {
    to,
    subject: renewed ? "Your Complete Portfolio access was renewed" : "You can now view the Complete Portfolio",
    text: `${ownerName || "The portfolio owner"} has ${renewed ? "renewed" : "granted"} your Complete Portfolio access for 15 days.\n\nView the portfolio: ${accessUrl}\n\nAccess expires on ${expiry}. You must verify the same email address that received this message. Forwarding this email does not transfer access, and the owner may end access early.`,
  };
}

/** Claims and delivers durable relationship notifications without mixing in pilot-access jobs. */
export async function processRelationshipNotifications(supabase: Client, limit = 10) {
  const origin = appOrigin.parse(process.env.NEXT_PUBLIC_APP_URL);
  const { data, error } = await supabase.rpc("claim_relationship_notification_outbox", { p_limit: limit });
  if (error) throw error;
  const jobs = z.array(claimedJob).parse(data || []);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    let succeeded = false;
    let errorCode: string | null = null;
    let retryable = false;
    try {
      const message = await renderJob(supabase, job, origin);
      const result = await sendResendEmail({ deliveryId: deliveryId(job.notification_ref), ...message });
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
      p_error_code: errorCode,
      p_retryable: retryable,
    });
    if (completionError) throw completionError;
    const expectedCompletion = succeeded
      ? "sent"
      : retryable && job.attempt_count < 5
        ? "queued"
        : "failed";
    if (completion !== expectedCompletion) {
      throw new Error(`notification completion was ${completion || "unavailable"}; expected ${expectedCompletion}`);
    }
    if (succeeded) sent += 1;
    else failed += 1;
  }
  return { claimed: jobs.length, sent, failed };
}
