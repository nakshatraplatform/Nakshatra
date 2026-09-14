import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  pilotAccessStateSchema,
  pilotApplicationSchema,
  type SubmitPilotAccessCommand,
  pilotAdminRequestSchema,
  type PilotAdminFilter,
  type ReviewPilotAccessCommand,
} from "./pilot-access.contract";

export type PilotAccessFailureReason =
  | "database_update_required"
  | "verified_email_required"
  | "invalid_request"
  | "unavailable";

export class PilotAccessServiceError extends Error {
  constructor(
    readonly reason: PilotAccessFailureReason,
    readonly databaseCode?: string
  ) {
    super(reason);
  }
}

function classifyPilotError(error: { code?: string; message?: string } | null): PilotAccessFailureReason {
  if (error?.code === "PGRST202") return "database_update_required";
  if (error?.code === "42501" && error.message === "verified email required") {
    return "verified_email_required";
  }
  if (error?.code === "22023") return "invalid_request";
  return "unavailable";
}

/** Returns only the current account's capabilities and application state. */
export async function loadPilotAccessState(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_current_pilot_access_state");
  const parsed = pilotAccessStateSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new PilotAccessServiceError(classifyPilotError(error), error?.code);
  }
  return parsed.data;
}

/** Submits details only after Supabase has verified the live account email. */
export async function submitPilotAccessRequest(
  supabase: SupabaseClient,
  command: SubmitPilotAccessCommand
) {
  const { data, error } = await supabase.rpc("submit_pilot_access_request", {
    p_display_name: command.displayName,
    p_phone_e164: command.phoneE164,
    p_contact_consent_version: command.contactConsentVersion,
    p_idempotency_key: command.idempotencyKey,
  });
  if (!error && data && typeof data === "object" && "status" in data && data.status === "already_creator") {
    return { status: "already_creator" as const };
  }
  const parsed = pilotApplicationSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new PilotAccessServiceError(classifyPilotError(error), error?.code);
  }
  return parsed.data;
}

const pilotAdminRowsSchema = pilotAdminRequestSchema.array();

/** Lists applicant PII only after the database independently verifies administrator membership. */
export async function listPilotAccessRequests(
  supabase: SupabaseClient,
  filter: PilotAdminFilter
) {
  const { data, error } = await supabase.rpc("list_pilot_access_requests", {
    p_status: filter === "all" ? null : filter,
    p_limit: 100,
  });
  const normalized = Array.isArray(data) ? data.map((row) => ({
    requestRef: row.request_ref,
    displayName: row.display_name,
    verifiedEmail: row.verified_email,
    phoneE164: row.phone_e164,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  })) : data;
  const parsed = pilotAdminRowsSchema.safeParse(normalized);
  if (error || !parsed.success) {
    throw new PilotAccessServiceError(classifyPilotError(error), error?.code);
  }
  return parsed.data;
}

/** Applies an auditable decision; entitlement and notification enqueueing occur in one transaction. */
export async function reviewPilotAccessRequest(
  supabase: SupabaseClient,
  command: ReviewPilotAccessCommand
) {
  const { data, error } = await supabase.rpc("review_pilot_access_request", {
    p_request_ref: command.requestRef,
    p_decision: command.decision,
    p_review_note: command.reviewNote,
    p_idempotency_key: command.idempotencyKey,
  });
  const parsed = pilotApplicationSchema.safeParse(data);
  if (error || !parsed.success) {
    throw new PilotAccessServiceError(classifyPilotError(error), error?.code);
  }
  return parsed.data;
}
