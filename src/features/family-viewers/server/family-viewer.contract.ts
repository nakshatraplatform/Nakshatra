import { z } from "zod/v4";
import { idempotencyKeySchema } from "@/features/organization-access/server/brokerdesk-team-invitation.contract";
import {
  familyViewerInvitationRefSchema,
  familyViewerRefSchema,
} from "@/features/security/public-reference";

export const familyRelationshipKindSchema = z.enum([
  "father",
  "mother",
  "parent",
  "sibling",
  "guardian",
  "relative",
  "other",
]);

export const familyViewerStatusSchema = z.enum([
  "pending_candidate_approval",
  "pending_verification",
  "active",
  "rejected",
  "revoked",
]);

export const proposeFamilyViewerCommandSchema = z.object({
  email: z.email().max(254),
  displayName: z.string().trim().min(1).max(120),
  relationshipKind: familyRelationshipKindSchema,
  relationshipLabel: z.string().trim().min(1).max(40).nullable().optional(),
  preferredLocale: z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).nullable().optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict().superRefine((value, context) => {
  const hasLabel = Boolean(value.relationshipLabel);
  if ((value.relationshipKind === "other") !== hasLabel) {
    context.addIssue({
      code: "custom",
      path: ["relationshipLabel"],
      message: "A relationship label is required only when relationship kind is other.",
    });
  }
});

const ownProposalSchema = z.object({
  displayName: z.string().min(1).max(120),
  relationshipKind: familyRelationshipKindSchema,
  relationshipLabel: z.string().min(1).max(40).nullable(),
  emailHint: z.string().min(7).max(254),
  preferredLocale: z.string().max(35).nullable(),
  status: familyViewerStatusSchema,
  createdAt: z.string(),
}).strict();

export const brokerdeskFamilySetupSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    activeViewerCount: z.number().int().min(0).max(3),
    maximumActiveViewers: z.literal(3),
    canPropose: z.boolean(),
    ownProposals: z.array(ownProposalSchema).max(0),
  }).strict(),
]);

export const proposedFamilyViewerResultSchema = z.object({
  accepted: z.literal(true),
}).strict();

const familyViewerItemSchema = z.object({
  viewerRef: familyViewerRefSchema,
  displayName: z.string().min(1).max(120),
  relationshipKind: familyRelationshipKindSchema,
  relationshipLabel: z.string().min(1).max(40).nullable(),
  emailHint: z.string().min(7).max(254),
  preferredLocale: z.string().max(35).nullable(),
  role: z.enum(["viewer", "primary"]),
  status: z.enum(["pending_candidate_approval", "pending_verification", "active"]),
  rowVersion: z.number().int().positive(),
  proposedByWorkspaceName: z.string().min(1).max(180).nullable(),
  invitationStatus: z.enum(["accepted", "revoked", "expired", "pending"]).nullable(),
  invitationExpiresAt: z.string().nullable(),
}).strict();

export const candidateFamilyRosterSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    activeCount: z.number().int().min(0).max(3),
    viewers: z.array(familyViewerItemSchema).max(10),
  }).strict(),
]);

export const createFamilyViewerCommandSchema = z.object({
  email: z.email().max(254),
  displayName: z.string().trim().min(1).max(120),
  relationshipKind: familyRelationshipKindSchema,
  relationshipLabel: z.string().trim().min(1).max(40).nullable().optional(),
  preferredLocale: z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).nullable().optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict().superRefine((value, context) => {
  if ((value.relationshipKind === "other") !== Boolean(value.relationshipLabel)) {
    context.addIssue({
      code: "custom",
      path: ["relationshipLabel"],
      message: "A relationship label is required only when relationship kind is other.",
    });
  }
});

export const decideFamilyViewerProposalCommandSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    email: z.email().max(254),
    idempotencyKey: idempotencyKeySchema,
  }).strict(),
  z.object({
    decision: z.literal("reject"),
    idempotencyKey: idempotencyKeySchema,
  }).strict(),
]);

export const familyViewerVersionCommandSchema = z.object({
  expectedVersion: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const createdFamilyViewerInvitationSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    viewerRef: familyViewerRefSchema,
    invitationRef: familyViewerInvitationRefSchema,
    status: z.literal("pending_verification"),
    expiresAt: z.string(),
    rowVersion: z.number().int().positive(),
  }).strict(),
]);

const familyInvitationDeliveryFields = {
  invitationUrl: z.url().max(2_048),
  emailStatus: z.enum(["sent", "unavailable"]),
} as const;

export const candidateFamilyViewerCreateResponseSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    viewerRef: familyViewerRefSchema,
    invitationRef: familyViewerInvitationRefSchema,
    status: z.literal("pending_verification"),
    expiresAt: z.string(),
    rowVersion: z.number().int().positive(),
    ...familyInvitationDeliveryFields,
  }).strict(),
]);

export const familyViewerTransitionSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    viewerRef: familyViewerRefSchema,
    status: z.enum(["pending_verification", "active", "rejected", "revoked"]),
    role: z.enum(["viewer", "primary"]).optional(),
    invitationRef: familyViewerInvitationRefSchema.optional(),
    expiresAt: z.string().optional(),
    rowVersion: z.number().int().positive(),
  }).strict(),
]);

export const candidateFamilyViewerDecisionResponseSchema = z.union([
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    viewerRef: familyViewerRefSchema,
    status: z.literal("rejected"),
    rowVersion: z.number().int().positive(),
  }).strict(),
  z.object({
    available: z.literal(true),
    viewerRef: familyViewerRefSchema,
    status: z.literal("pending_verification"),
    invitationRef: familyViewerInvitationRefSchema,
    expiresAt: z.string(),
    rowVersion: z.number().int().positive(),
    ...familyInvitationDeliveryFields,
  }).strict(),
]);

export const familyInvitationFragmentSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export const familyInvitationExchangeRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).strict();

export const familyInvitationExchangeResponseSchema = z.object({
  ready: z.boolean(),
}).strict();

export const familyInvitationAcceptSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
}).strict();

export type BrokerdeskFamilySetup = z.infer<typeof brokerdeskFamilySetupSchema>;
export type ProposeFamilyViewerCommand = z.infer<typeof proposeFamilyViewerCommandSchema>;
export type CandidateFamilyRoster = z.infer<typeof candidateFamilyRosterSchema>;
