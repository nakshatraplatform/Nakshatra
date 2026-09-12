import { z } from "zod/v4";

export const PILOT_CONTACT_CONSENT_VERSION = "pilot_access_v1";

export const pilotRequestRefSchema = z.string().regex(/^par_[0-9a-f]{32}$/);
export const pilotAccessStatusSchema = z.enum(["pending", "approved", "declined", "revoked"]);

export const submitPilotAccessSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  phoneE164: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/).nullable(),
  contactConsentVersion: z.literal(PILOT_CONTACT_CONSENT_VERSION),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_.:-]{16,128}$/),
}).strict();

export const pilotApplicationSchema = z.object({
  requestRef: pilotRequestRefSchema,
  status: pilotAccessStatusSchema,
  submittedAt: z.string(),
  reviewedAt: z.string().nullable(),
}).strict();

export const pilotAccessStateSchema = z.object({
  canCreatePortfolio: z.boolean(),
  isPilotAdministrator: z.boolean(),
  application: pilotApplicationSchema.nullable(),
}).strict();

export type PilotAccessState = z.infer<typeof pilotAccessStateSchema>;
export type SubmitPilotAccessCommand = z.infer<typeof submitPilotAccessSchema>;

export const pilotAdminFilterSchema = z.enum(["pending", "approved", "declined", "revoked", "all"]);
export const pilotDecisionSchema = z.enum(["approve", "decline", "revoke"]);

export const reviewPilotAccessSchema = z.object({
  requestRef: pilotRequestRefSchema,
  decision: pilotDecisionSchema,
  reviewNote: z.string().trim().max(500).nullable(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_.:-]{16,128}$/),
}).strict();

export const pilotAdminRequestSchema = z.object({
  requestRef: pilotRequestRefSchema,
  displayName: z.string(),
  verifiedEmail: z.string().email(),
  phoneE164: z.string().nullable(),
  status: pilotAccessStatusSchema,
  submittedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
}).strict();

export type PilotAdminFilter = z.infer<typeof pilotAdminFilterSchema>;
export type PilotAdminRequest = z.infer<typeof pilotAdminRequestSchema>;
export type ReviewPilotAccessCommand = z.infer<typeof reviewPilotAccessSchema>;
