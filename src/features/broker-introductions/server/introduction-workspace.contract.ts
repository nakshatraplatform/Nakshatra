import { z } from "zod/v4";
import { brokerCustomerRelationshipRefSchema, brokerIntroductionRouteRefSchema, workspaceRefSchema } from "@/features/security/public-reference";
import { idempotencyKeySchema } from "@/features/organization-access/server/brokerdesk-team-invitation.contract";

export const introductionWorkspacePathSchema = z.object({
  workspaceRef: workspaceRefSchema,
  introductionRef: brokerIntroductionRouteRefSchema,
}).strict();
export const introductionWorkspaceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  beforeCreatedAt: z.iso.datetime({ offset: true }).optional(),
  beforeRef: brokerIntroductionRouteRefSchema.optional(),
}).strict().refine(value => Boolean(value.beforeCreatedAt) === Boolean(value.beforeRef), {
  message: "Both cursor fields are required together.",
});
export const introductionShareCommandSchema = z.object({
  side: z.enum(["source", "recipient"]),
  action: z.enum(["initiate", "confirm", "remind"]),
  expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: idempotencyKeySchema,
}).strict();

const status = z.enum(["created", "shared", "responded", "revoked", "expired"]);
const shareState = z.enum(["not_started", "initiated", "broker_confirmed"]);
const date = z.iso.datetime({ offset: true });
const unavailable = z.object({ available: z.literal(false) }).strict();
const reportedStatus = z.enum(["accepted", "declined", "needs_time", "callback_requested", "no_response", "other"]);
const reportedBy = z.enum(["candidate", "authorized_parent", "family"]);
const channel = z.enum(["phone", "whatsapp", "in_person", "other"]);
const familyComment = z.string().refine(value => [...value].length <= 1000, "Use up to 1,000 characters.");
export const introductionFamilyUpdateCommandSchema = z.object({
  side: z.enum(["source", "recipient"]),
  status: reportedStatus,
  reportedBy,
  channel,
  comment: z.string().trim().pipe(familyComment),
  consentAttested: z.boolean(),
  confirmFamilyAccess: z.literal(true).optional(),
  expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: idempotencyKeySchema,
}).strict().refine(value => {
  const decision = value.status === "accepted" || value.status === "declined";
  return value.consentAttested === decision && (!decision || value.reportedBy !== "family") && (!value.confirmFamilyAccess || value.status === "accepted");
}, { message: "Confirm the candidate's or authorized parent's decision." });

export const introductionFamilyUpdateResultSchema = z.discriminatedUnion("available", [
  unavailable,
  z.object({ available: z.literal(true), rowVersion: z.number().int().positive(), completeAccessExpiresAt: date.nullable() }).strict(),
]);

const familyUpdate = z.object({
  status: reportedStatus, reportedBy, channel, comment: familyComment.nullable(), recordedAt: date,
}).strict();
const cursor = z.object({ createdAt: date, introductionRef: brokerIntroductionRouteRefSchema }).strict();
export const introductionActionSchema = z.discriminatedUnion("available", [
  unavailable,
  z.object({
    available: z.literal(true), introductionRef: brokerIntroductionRouteRefSchema,
    status, rowVersion: z.number().int().positive(),
    createdAt: date, expiresAt: date, canActivate: z.boolean(), completeAccessExpiresAt: date.nullable().optional(),
    sides: z.array(z.object({
      side: z.enum(["source", "recipient"]),
      name: z.string().min(1).max(180),
      relationshipRef: brokerCustomerRelationshipRefSchema,
      response: z.enum(["accepted", "declined"]).nullable(), respondedAt: date.nullable(),
      shareState, initiatedAt: date.nullable(), confirmedAt: date.nullable(),
      lastRemindedAt: date.nullable(), reminderCount: z.number().int().min(0).max(30),
      rowVersion: z.number().int().positive(), canShare: z.boolean(), canRemind: z.boolean(),
      canRecordResponse: z.boolean().optional(), latestUpdate: familyUpdate.nullable().optional(),
    }).strict()).length(2).refine(sides => new Set(sides.map(side => side.side)).size === 2),
    timeline: z.array(z.object({
      type: z.enum(["created", "shared", "claimed", "response_submitted", "complete_access_confirmed",
        "mutual_access_granted", "revoked", "expired", "share_initiated", "share_confirmed", "reminder_initiated"]),
      occurredAt: date, side: z.enum(["source", "recipient"]).nullable(),
    }).strict()).max(100),
  }).strict(),
]);
export const introductionShareResultSchema = z.discriminatedUnion("available", [
  unavailable,
  z.object({
    available: z.literal(true), side: z.enum(["source", "recipient"]),
    shareState, rowVersion: z.number().int().positive(),
  }).strict(),
]);
export const introductionWorkspaceListSchema = z.discriminatedUnion("available", [
  unavailable,
  z.object({
    available: z.literal(true),
    introductions: z.array(z.object({
      introductionRef: brokerIntroductionRouteRefSchema,
      sourceName: z.string().min(1).max(180), recipientName: z.string().min(1).max(180),
      status, createdAt: date, expiresAt: date,
    }).strict()).max(50),
    nextCursor: cursor.nullable(),
  }).strict(),
]);
export type IntroductionShareCommand = z.infer<typeof introductionShareCommandSchema>;
export type IntroductionFamilyUpdateCommand = z.infer<typeof introductionFamilyUpdateCommandSchema>;
export type IntroductionAction = Extract<z.infer<typeof introductionActionSchema>, { available: true }>;
