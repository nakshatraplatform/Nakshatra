import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  brokerIntroductionListSchema,
  brokerPortfolioNoticeListSchema,
  createdBrokerIntroductionSchema,
  eligibleBrokerIntroductionRecipientsSchema,
  resolvedBrokerIntroductionSchema,
  ownerBrokerIntroductionResponsesSchema,
  receivedBrokerIntroductionsSchema,
  brokerdeskDashboardSchema,
} from "./broker-introduction.contract";
import { BrokerIntroductionRepository } from "./broker-introduction.repository";

const transitionSchema = z.object({
  available: z.literal(true),
  status: z.enum(["shared", "responded", "revoked"]),
  rowVersion: z.number().int().positive().optional(),
  response: z.enum(["accepted", "declined"]).optional(),
}).strict();
const claimSchema = z.object({ available: z.literal(true), expiresAt: z.string() }).strict();
const flagSchema = z.object({ available: z.literal(true), status: z.literal("clarification") }).strict();
const reviewedSchema = z.object({ available: z.literal(true), status: z.literal("reviewed") }).strict();
const acknowledgedSchema = z.object({ available: z.literal(true), status: z.literal("acknowledged") }).strict();

export class BrokerIntroductionError extends Error {
  constructor(
    message = "The broker introduction is unavailable.",
    readonly code = "BROKER_INTRODUCTION_UNAVAILABLE",
    readonly status = 403
  ) { super(message); }
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, error: unknown): T {
  const parsed = schema.safeParse(data);
  if (error || !parsed.success) throw new BrokerIntroductionError();
  return parsed.data;
}

export async function createBrokerIntroduction(
  supabase: SupabaseClient,
  input: {
    workspaceRef: string;
    relationshipRef: string;
    recipientRelationshipRef: string;
    idempotencyKey: string;
  }
) {
  const repository = new BrokerIntroductionRepository(supabase);
  const result = await repository.createIdentityBound(
    input.workspaceRef,
    input.relationshipRef,
    input.recipientRelationshipRef,
    input.idempotencyKey
  );
  return parseOrThrow(createdBrokerIntroductionSchema, result.data, result.error);
}

export async function listEligibleBrokerIntroductionRecipients(
  supabase: SupabaseClient,
  workspaceRef: string,
  relationshipRef: string
) {
  const result = await new BrokerIntroductionRepository(supabase).recipients(workspaceRef, relationshipRef);
  return parseOrThrow(eligibleBrokerIntroductionRecipientsSchema, result.data, result.error);
}

export async function listBrokerIntroductions(supabase: SupabaseClient, workspaceRef: string, relationshipRef: string) {
  const result = await new BrokerIntroductionRepository(supabase).list(workspaceRef, relationshipRef);
  return parseOrThrow(brokerIntroductionListSchema, result.data, result.error);
}

export async function listBrokerPortfolioNotices(supabase: SupabaseClient, workspaceRef: string, relationshipRef: string) {
  const result = await new BrokerIntroductionRepository(supabase).notices(workspaceRef, relationshipRef);
  return parseOrThrow(brokerPortfolioNoticeListSchema, result.data, result.error);
}

export async function markBrokerIntroductionShared(supabase: SupabaseClient, workspaceRef: string, introductionRef: string, expectedVersion: number) {
  const result = await new BrokerIntroductionRepository(supabase).markShared(workspaceRef, introductionRef, expectedVersion);
  return parseOrThrow(transitionSchema, result.data, result.error);
}

export async function revokeBrokerIntroduction(supabase: SupabaseClient, workspaceRef: string, introductionRef: string, expectedVersion: number) {
  const result = await new BrokerIntroductionRepository(supabase).revoke(workspaceRef, introductionRef, expectedVersion);
  return parseOrThrow(transitionSchema, result.data, result.error);
}

export async function claimBrokerIntroductionPass(supabase: SupabaseClient, introductionRef: string, claimHash: string, sessionHash: string) {
  const result = await new BrokerIntroductionRepository(supabase).claim(introductionRef, claimHash, sessionHash);
  return parseOrThrow(claimSchema, result.data, result.error);
}

export async function resolveBrokerIntroduction(supabase: SupabaseClient, introductionRef: string) {
  const result = await new BrokerIntroductionRepository(supabase).resolve(introductionRef);
  const resolved = parseOrThrow(resolvedBrokerIntroductionSchema, result.data, result.error);
  if (!resolved.available) return resolved;

  let admin: ReturnType<typeof createServiceRoleClient> | null = null;
  try { admin = createServiceRoleClient(); } catch { /* Data remains available if media signing is not configured. */ }
  const media = admin ? await Promise.all(resolved.media.map(async (item) => {
    const signed = await admin!.storage.from("photos").createSignedUrl(item.accessPath, 5 * 60);
    return signed.data?.signedUrl ? { ...item, accessPath: signed.data.signedUrl } : null;
  })) : [];
  let horoscopeUrl: string | null = null;
  if (admin && resolved.horoscope) {
    const signed = await admin.storage.from("horoscopes").createSignedUrl(resolved.horoscope.accessPath, 5 * 60);
    horoscopeUrl = signed.data?.signedUrl ?? null;
  }
  return {
    ...resolved,
    media: media.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    horoscope: resolved.horoscope && horoscopeUrl
      ? { ...resolved.horoscope, accessPath: horoscopeUrl }
      : null,
  };
}

export async function respondToBrokerIntroduction(supabase: SupabaseClient, introductionRef: string, response: "accepted" | "declined", comment: string) {
  const result = await new BrokerIntroductionRepository(supabase).respond(introductionRef, response, comment);
  return parseOrThrow(transitionSchema, result.data, result.error);
}

export async function flagBrokerPortfolioUpdate(supabase: SupabaseClient, workspaceRef: string, relationshipRef: string, noticeRef: string) {
  const result = await new BrokerIntroductionRepository(supabase).flagNotice(workspaceRef, relationshipRef, noticeRef);
  return parseOrThrow(flagSchema, result.data, result.error);
}

export async function listOwnerBrokerIntroductionResponses(supabase: SupabaseClient) {
  const result = await new BrokerIntroductionRepository(supabase).ownerResponses();
  return parseOrThrow(ownerBrokerIntroductionResponsesSchema, result.data, result.error).responses;
}

export async function listReceivedBrokerIntroductions(supabase: SupabaseClient) {
  const result = await new BrokerIntroductionRepository(supabase).received();
  return parseOrThrow(receivedBrokerIntroductionsSchema, result.data, result.error).introductions;
}

export async function resolveBrokerdeskDashboard(supabase: SupabaseClient, workspaceRef: string) {
  const result = await new BrokerIntroductionRepository(supabase).dashboard(workspaceRef);
  return parseOrThrow(brokerdeskDashboardSchema, result.data, result.error);
}

export async function markBrokerIntroductionResponseReviewed(
  supabase: SupabaseClient,
  workspaceRef: string,
  introductionRef: string
) {
  const result = await new BrokerIntroductionRepository(supabase)
    .markResponseReviewed(workspaceRef, introductionRef);
  return parseOrThrow(reviewedSchema, result.data, result.error);
}

export async function acknowledgeBrokerPortfolioUpdate(
  supabase: SupabaseClient,
  workspaceRef: string,
  relationshipRef: string,
  noticeRef: string
) {
  const result = await new BrokerIntroductionRepository(supabase)
    .acknowledgeNotice(workspaceRef, relationshipRef, noticeRef);
  return parseOrThrow(acknowledgedSchema, result.data, result.error);
}
