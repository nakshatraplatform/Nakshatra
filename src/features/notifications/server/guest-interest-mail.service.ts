import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import type { Database } from "@/types/database.generated";
import { sendResendEmail } from "./resend.provider";

const jobSchema = z.object({
  id: z.uuid(), interest_request_id: z.uuid(), kind: z.enum(["receipt", "approved_contact", "declined"]),
  recipient_email: z.email(), contact_payload: z.unknown(),
  attempt_count: z.number().int().positive(), lease_token: z.uuid(),
});
const contactSchema = z.object({
  contact_person: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.email().max(254), z.literal("")]).optional(),
  contacts: z.array(z.object({
    name: z.string().trim().max(100).optional(), relationship: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional(), email: z.union([z.email().max(254), z.literal("")]).optional(),
  })).max(5).optional(),
});

type GuestMailRpcArgs = {
  claim_guest_interest_mail: { p_limit?: number };
  guest_interest_mail_is_current: { p_id: string; p_lease_token: string };
  complete_guest_interest_mail: {
    p_id: string; p_lease_token: string; p_sent: boolean;
    p_error_code?: string; p_retryable?: boolean;
  };
  purge_guest_interest_ephemera: { p_limit?: number };
};

/** The additive migration supplies these RPCs before its generated schema types reach main. */
function guestMailRpc(client: SupabaseClient<Database>) {
  return client.rpc.bind(client) as unknown as <Name extends keyof GuestMailRpcArgs>(
    name: Name, args: GuestMailRpcArgs[Name]
  ) => Promise<{ data: unknown; error: unknown }>;
}

function clean(value?: string) {
  return value?.replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim() || "";
}

function contactMessage(payload: unknown) {
  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) throw new Error("CONTACT_PAYLOAD_INVALID");
  const contact = parsed.data;
  const lines: string[] = [];
  if (contact.phone || contact.email) {
    lines.push([contact.contact_person, contact.phone, contact.email].map(clean).filter(Boolean).join(" · "));
  }
  for (const item of contact.contacts || []) {
    if (item.phone || item.email) {
      lines.push([item.name, item.relationship, item.phone, item.email].map(clean).filter(Boolean).join(" · "));
    }
  }
  if (!lines.length) throw new Error("CONTACT_PAYLOAD_INVALID");
  return `The person you contacted through VivIntro has chosen to share these contact details:\n\n${lines.join("\n")}\n\nYou received this because you verified your email and showed interest. This email does not give you access to private introduction details. Please respect the family's choice about further contact.`;
}

/** Durable guest mail uses the job UUID as the tracked provider idempotency key. */
export async function processGuestInterestMail(
  client: SupabaseClient<Database>, limit = 5, transport?: typeof fetch,
) {
  const rpc = guestMailRpc(client);
  const { data, error } = await rpc("claim_guest_interest_mail", { p_limit: limit });
  if (error) throw new Error("GUEST_MAIL_CLAIM_FAILED");
  const jobs = z.array(jobSchema).parse(data || []);
  let failed = 0;
  for (const job of jobs) {
    let sent = false;
    let code = "GUEST_MAIL_UNAVAILABLE";
    let retryable = true;
    try {
      const current = await rpc("guest_interest_mail_is_current", {
        p_id: job.id, p_lease_token: job.lease_token,
      });
      if (current.error) throw new Error("GUEST_MAIL_CHECK_FAILED");
      if (current.data !== true) {
        code = "GUEST_MAIL_STALE";
        retryable = false;
      } else {
        const message = job.kind === "receipt"
          ? { subject: "We received your VivIntro interest", text: "Your interest was sent. The family can review it and may email you the contact details they choose to share. Showing interest did not create an account or open private introduction details." }
          : job.kind === "approved_contact"
            ? { subject: "Contact details shared through VivIntro", text: contactMessage(job.contact_payload) }
            : { subject: "Update on your VivIntro interest", text: "The family is not sharing contact details at this time." };
        const result = await sendResendEmail({ deliveryId: job.id, to: job.recipient_email, ...message }, transport, client);
        if (result.status === "accepted") sent = true;
        else { code = result.code; retryable = result.retryable; }
      }
    } catch (caught) {
      if (caught instanceof Error && caught.message === "CONTACT_PAYLOAD_INVALID") {
        code = "CONTACT_PAYLOAD_INVALID";
        retryable = false;
      }
    }
    const completion = await rpc("complete_guest_interest_mail", {
      p_id: job.id, p_lease_token: job.lease_token, p_sent: sent,
      p_error_code: sent ? undefined : code, p_retryable: !sent && retryable,
    });
    if (completion.error || completion.data !== true || (!sent && retryable)) failed++;
  }
  const purge = await rpc("purge_guest_interest_ephemera", { p_limit: 100 });
  if (purge.error) failed++;
  return { claimed: jobs.length, failed };
}
