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
]);
const claimedJob = z.object({
  notification_ref: z.string().regex(/^ntf_[0-9a-f]{32}$/),
  recipient_user_id: z.uuid(),
  notification_type: relationshipType,
  attempt_count: z.number().int().positive(),
  interest_request_id: z.uuid().nullable(),
  grant_id: z.uuid().nullable(),
  payload: z.custom<Json>(),
});
const appOrigin = z.url().transform((value) => new URL(value).origin);

type Client = SupabaseClient<Database>;
type Job = z.infer<typeof claimedJob>;

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
  const { data: recipient, error: recipientError } = await supabase.auth.admin.getUserById(job.recipient_user_id);
  const to = recipient.user?.email?.trim().toLowerCase();
  if (recipientError || !to) throw new Error("RECIPIENT_UNAVAILABLE");

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

  if (!job.grant_id) throw new Error("GRANT_UNAVAILABLE");
  const { data: grant, error: grantError } = await supabase
    .from("reveal_grants")
    .select("id, expires_at, portfolio_id, revoked_at")
    .eq("id", job.grant_id)
    .maybeSingle();
  if (grantError || !grant || grant.revoked_at) throw new Error("GRANT_UNAVAILABLE");
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
    try {
      const message = await renderJob(supabase, job, origin);
      const result = await sendResendEmail({ deliveryId: deliveryId(job.notification_ref), ...message });
      succeeded = result.status === "accepted";
      errorCode = result.status === "failed" ? result.code : null;
    } catch (jobError) {
      errorCode = jobError instanceof Error && /^[A-Z0-9_]{3,80}$/.test(jobError.message)
        ? jobError.message
        : "NOTIFICATION_RENDER_FAILED";
    }
    const { error: completionError } = await supabase.rpc("complete_notification_outbox", {
      p_notification_ref: job.notification_ref,
      p_succeeded: succeeded,
      p_error_code: errorCode,
    });
    if (completionError) throw completionError;
    if (succeeded) sent += 1;
    else failed += 1;
  }
  return { claimed: jobs.length, sent, failed };
}
