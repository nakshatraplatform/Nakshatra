import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const creatorInvitationCommandSchema = z.object({
  email: z.email().max(180).transform((value) => value.trim().toLowerCase()),
  action: z.enum(["grant", "revoke"]),
}).strict();

const invitationSchema = z.object({
  email: z.email(),
  invited_at: z.string(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});

export function hashCreatorInvitationToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid invitation token");
  return createHash("sha256").update(token).digest("hex");
}

export async function listCreatorInvitations(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("list_b2c_creator_invites", { p_limit: 50 });
  if (error) throw error;
  return invitationSchema.array().parse(data);
}

export async function manageCreatorInvitation(supabase: SupabaseClient, email: string, action: "grant" | "revoke", tokenHash?: string) {
  const { data, error } = await supabase.rpc("admin_manage_b2c_creator_invite", {
    p_email: email,
    p_action: action,
    p_token_hash: tokenHash ?? null,
  });
  if (error) throw error;
  return z.object({ status: z.enum(["invited", "revoked"]) }).parse(data);
}

/** Called only for password signup, after request-level rate limiting. */
export async function isCreatorInvitationValid(email: string, token: string) {
  const { data, error } = await createServiceRoleClient().rpc("service_b2c_invite_matches", {
    p_email: email,
    p_token_hash: hashCreatorInvitationToken(token),
  });
  if (error || typeof data !== "boolean") throw error ?? new Error("Invite status unavailable");
  return data;
}

export async function acceptCreatorInvitation(supabase: SupabaseClient, token: string) {
  const { data, error } = await supabase.rpc("accept_b2c_creator_invite", {
    p_token_hash: hashCreatorInvitationToken(token),
  });
  if (error) throw error;
  return z.object({ status: z.literal("accepted") }).parse(data);
}
