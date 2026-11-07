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
const cursor = z.object({ createdAt: date, introductionRef: brokerIntroductionRouteRefSchema }).strict();
export const introductionActionSchema = z.discriminatedUnion("available", [
  unavailable,
  z.object({
    available: z.literal(true), introductionRef: brokerIntroductionRouteRefSchema,
    status, rowVersion: z.number().int().positive(),
    createdAt: date, expiresAt: date, canActivate: z.boolean(),
    sides: z.array(z.object({
      side: z.enum(["source", "recipient"]),
      name: z.string().min(1).max(180),
      relationshipRef: brokerCustomerRelationshipRefSchema,
      response: z.enum(["accepted", "declined"]).nullable(), respondedAt: date.nullable(),
      shareState, initiatedAt: date.nullable(), confirmedAt: date.nullable(),
      lastRemindedAt: date.nullable(), reminderCount: z.number().int().min(0).max(30),
      rowVersion: z.number().int().positive(), canShare: z.boolean(), canRemind: z.boolean(),
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
export type IntroductionAction = Extract<z.infer<typeof introductionActionSchema>, { available: true }>;
