import "server-only";

import { z } from "zod/v4";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { invitationRefSchema } from "@/features/security/public-reference";

const inputSchema = z.object({
  invitationRef: invitationRefSchema,
  recipientEmail: z.email().max(254),
  invitationUrl: z.url().max(2_048),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict();

function invitationDeliveryId(invitationRef: string) {
  const value = invitationRef.slice(4);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** Sends one idempotent setup invitation. Persistence and authorization happen before this call. */
export async function sendCustomerPortfolioInvitationEmail(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "unavailable" as const };

  const expiry = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(parsed.data.expiresAt));
  const text = [
    "You have been invited to create your own VivIntro portfolio.",
    "",
    "Your broker cannot create or edit your portfolio. You decide what to publish, and you can end the broker relationship later.",
    "",
    `Open your private setup invitation: ${parsed.data.invitationUrl}`,
    "",
    `This invitation expires on ${expiry}. If you were not expecting it, you can ignore this email.`,
  ].join("\n");

  const result = await sendResendEmail({
    deliveryId: invitationDeliveryId(parsed.data.invitationRef),
    to: parsed.data.recipientEmail,
    subject: "Create your VivIntro portfolio",
    text,
  });
  return result.status === "accepted"
    ? { status: "sent" as const }
    : { status: "unavailable" as const };
}

