import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memberInterestContextSchema, memberInterestResultSchema, memberInterestSubmissionSchema } from "../member-interest.contract";
import type { z } from "zod/v4";

/** These narrow RPCs are supplied by the separately deployed database prerequisite. */
export async function loadMemberInterestContext(client: SupabaseClient, token: string) {
  const { data, error } = await client.rpc("member_interest_context", { p_share_token: token });
  const parsed = memberInterestContextSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("MEMBER_INTEREST_UNAVAILABLE");
  return parsed.data;
}
export async function sendMemberInterest(client: SupabaseClient, input: z.infer<typeof memberInterestSubmissionSchema>) {
  const { data, error } = await client.rpc("send_member_interest_and_share", {
    p_share_token: input.portfolioToken, p_revision: input.revision, p_message: input.message || null,
  });
  const parsed = memberInterestResultSchema.safeParse(data);
  if (error || !parsed.success) throw new Error("MEMBER_INTEREST_UNAVAILABLE");
  return parsed.data;
}

export async function loadMemberInterestNotificationLink(client: SupabaseClient, requestId: string, recipientId: string) {
  const { data, error } = await client.rpc("member_interest_notification_link", { p_request_id: requestId, p_recipient_user_id: recipientId });
  if (error || data !== null && (typeof data !== "string" || !/^[A-Za-z0-9_-]{3,160}$/.test(data))) throw new Error("MEMBER_SHARE_LOOKUP_FAILED");
  return data as string | null;
}
