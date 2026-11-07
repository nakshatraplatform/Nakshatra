import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod/v4";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { familyViewerInvitationRefSchema } from "@/features/security/public-reference";

const inputSchema = z.object({
  invitationRef: familyViewerInvitationRefSchema,
  recipientEmail: z.email().max(254),
  invitationUrl: z.url().max(2_048),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict();

function deliveryId(invitationRef: string) {
  // A reference contains random bytes, not UUID version/variant bits. Derive a
  // stable domain-separated UUIDv8 for the shared delivery/idempotency guard.
  const value = createHash("sha256").update(`family-invitation-email.v1:${invitationRef}`).digest("hex");
  const variant = ((parseInt(value[16], 16) & 3) | 8).toString(16);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-8${value.slice(13, 16)}-${variant}${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

/** Sends after the guarded command commits; accepted means provider-accepted, not delivered. */
export async function sendFamilyViewerInvitationEmail(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { status: "unavailable" as const };
  const expiry = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(parsed.data.expiresAt));
  const result = await sendResendEmail({
    deliveryId: deliveryId(parsed.data.invitationRef),
    to: parsed.data.recipientEmail,
    subject: "Join as a family viewer on VivIntro",
    text: [
      "You have been invited by a VivIntro customer to join as a family viewer.",
      "",
      "Complete setup now. VivIntro will notify you when an eligible broker Introduction is available to view.",
      "Only the candidate can submit Interested or Decline.",
      "",
      `Open your private invitation: ${parsed.data.invitationUrl}`,
      "",
      `This invitation expires on ${expiry}. Sign in with the same Google email address that received it.`,
      "If you were not expecting this invitation, you can ignore this email.",
    ].join("\n"),
  });
  return result.status === "accepted"
    ? { status: "sent" as const }
    : { status: "unavailable" as const };
}
