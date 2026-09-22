import { z } from "zod/v4";
import { portfolioDataSchema } from "@/types/portfolio";
import { publicMediaDescriptorSchema } from "@/features/portfolio/server/public-portfolio.contract";
import {
  brokerCustomerRelationshipRefSchema,
  brokerIntroductionRouteRefSchema,
  brokerPortfolioNoticeRefSchema,
  portfolioVersionRefSchema,
} from "@/features/security/public-reference";
import { idempotencyKeySchema } from "@/features/organization-access/server/brokerdesk-team-invitation.contract";

export const brokerIntroductionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const createBrokerIntroductionSchema = z.object({
  relationshipRef: brokerCustomerRelationshipRefSchema,
  recipientRelationshipRef: brokerCustomerRelationshipRefSchema,
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const eligibleBrokerIntroductionRecipientSchema = z.object({
  relationshipRef: brokerCustomerRelationshipRefSchema,
  displayName: z.string().min(1).max(180),
  gender: z.string().max(80).nullable(),
  location: z.string().max(240).nullable(),
}).strict();

export const eligibleBrokerIntroductionRecipientsSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    recipients: z.array(eligibleBrokerIntroductionRecipientSchema).max(500),
  }).strict(),
]);

export const preparedBrokerIntroductionSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    versionRef: portfolioVersionRefSchema,
    // Compatibility key: the database now returns the bounded Broker Standard
    // projection here. It never returns the stored Complete Portfolio.
    completeData: portfolioDataSchema,
  }).strict(),
]);

export const createdBrokerIntroductionSchema = z.object({
  status: z.literal("created"),
  introductionRef: brokerIntroductionRouteRefSchema,
  sourceName: z.string().min(1).max(180),
  recipientLabel: z.string().min(1).max(120),
  recipientEmailHint: z.string().min(5).max(254).nullable(),
  expiresAt: z.string(),
  versionNumber: z.number().int().positive(),
  rowVersion: z.number().int().positive(),
}).strict();

export const brokerIntroductionItemSchema = z.object({
  introductionRef: brokerIntroductionRouteRefSchema,
  recipientLabel: z.string().min(1).max(120),
  recipientEmailHint: z.string().min(5).max(254).nullable(),
  status: z.enum(["created", "shared", "responded", "revoked", "expired"]),
  response: z.enum(["accepted", "declined"]).nullable(),
  responseComment: z.string().max(1000).nullable(),
  respondedAt: z.string().nullable(),
  sourceResponse: z.enum(["accepted", "declined"]).nullable(),
  sourceResponseComment: z.string().max(1000).nullable(),
  sourceRespondedAt: z.string().nullable(),
  recipientResponse: z.enum(["accepted", "declined"]).nullable(),
  recipientResponseComment: z.string().max(1000).nullable(),
  recipientRespondedAt: z.string().nullable(),
  expiresAt: z.string(),
  versionNumber: z.number().int().positive(),
  rowVersion: z.number().int().positive(),
  createdAt: z.string(),
}).strict();

export const brokerIntroductionListSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({ available: z.literal(true), introductions: z.array(brokerIntroductionItemSchema).max(200) }).strict(),
]);

export const brokerPortfolioNoticeSchema = z.object({
  noticeRef: brokerPortfolioNoticeRefSchema,
  status: z.enum(["unread", "acknowledged", "clarification"]),
  versionNumber: z.number().int().positive(),
  publishedAt: z.string(),
  createdAt: z.string(),
}).strict();

export const brokerPortfolioNoticeListSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({ available: z.literal(true), notices: z.array(brokerPortfolioNoticeSchema).max(200) }).strict(),
]);

export const resolvedBrokerIntroductionSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    introductionRef: brokerIntroductionRouteRefSchema,
    participantSide: z.enum(["source", "recipient"]),
    // `complete` is a legacy transport value retained for a database-first
    // rollout. For broker introductions it means Broker Standard Profile.
    accessMode: z.literal("complete"),
    data: portfolioDataSchema,
    media: z.array(publicMediaDescriptorSchema).max(8),
    horoscope: z.object({
      accessPath: z.string().min(1).max(1024),
      fileExtension: z.enum(["pdf", "doc", "docx", "webp"]),
      languageLabel: z.string().max(80).nullable(),
      pageCount: z.number().int().positive().nullable(),
    }).nullable(),
    templateId: z.number().int().positive(),
    themeColor: z.string().nullable(),
    sunSign: z.string().nullable(),
    expiresAt: z.string(),
    recipientLabel: z.string().min(1).max(120),
    response: z.enum(["accepted", "declined"]).nullable(),
    responseComment: z.string().max(1000).nullable(),
    respondedAt: z.string().nullable(),
    versionNumber: z.number().int().positive(),
  }).strict(),
]);

export const brokerIntroductionResponseSchema = z.object({
  response: z.enum(["accepted", "declined"]),
  comment: z.string().trim().max(1000).default(""),
}).strict();

export const ownerBrokerIntroductionResponsesSchema = z.object({
  available: z.literal(true),
  responses: z.array(z.object({
    introductionRef: brokerIntroductionRouteRefSchema,
    brokerName: z.string().min(1).max(180),
    recipientLabel: z.string().min(1).max(120),
    response: z.enum(["accepted", "declined"]),
    comment: z.string().max(1000).nullable(),
    respondedAt: z.string(),
  }).strict()).max(200),
}).strict();

export const receivedBrokerIntroductionsSchema = z.object({
  available: z.literal(true),
  introductions: z.array(z.object({
    introductionRef: brokerIntroductionRouteRefSchema,
    sourceName: z.string().min(1).max(180),
    brokerName: z.string().min(1).max(180),
    status: z.enum(["shared", "responded"]),
    response: z.enum(["accepted", "declined"]).nullable(),
    expiresAt: z.string(),
    createdAt: z.string(),
  }).strict()).max(200),
}).strict();

export const brokerdeskDashboardActionSchema = z.object({
  type: z.enum(["response", "portfolio_update", "clarification", "expiring"]),
  occurredAt: z.string(),
  relationshipRef: brokerCustomerRelationshipRefSchema,
  customerName: z.string().min(1).max(180),
  introductionRef: brokerIntroductionRouteRefSchema.optional(),
  noticeRef: brokerPortfolioNoticeRefSchema.optional(),
  recipientLabel: z.string().min(1).max(120).optional(),
  response: z.enum(["accepted", "declined"]).optional(),
  responseComment: z.string().max(1000).optional(),
  expiresAt: z.string().optional(),
  versionNumber: z.number().int().positive().optional(),
}).strict();

export const brokerdeskDashboardSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    workspaceRef: z.string().regex(/^wrk_[0-9a-f]{32}$/),
    workspaceName: z.string().min(1).max(160),
    metrics: z.object({
      activeCustomers: z.number().int().nonnegative(),
      openIntroductions: z.number().int().nonnegative(),
      responsesAwaitingReview: z.number().int().nonnegative(),
      portfolioUpdates: z.number().int().nonnegative(),
    }).strict(),
    actions: z.array(brokerdeskDashboardActionSchema).max(100),
  }).strict(),
]);

export type BrokerIntroductionItem = z.infer<typeof brokerIntroductionItemSchema>;
export type EligibleBrokerIntroductionRecipient = z.infer<typeof eligibleBrokerIntroductionRecipientSchema>;
export type BrokerPortfolioNotice = z.infer<typeof brokerPortfolioNoticeSchema>;
export type ResolvedBrokerIntroduction = z.infer<typeof resolvedBrokerIntroductionSchema>;
export type OwnerBrokerIntroductionResponse = z.infer<typeof ownerBrokerIntroductionResponsesSchema>["responses"][number];
export type ReceivedBrokerIntroduction = z.infer<typeof receivedBrokerIntroductionsSchema>["introductions"][number];
export type BrokerdeskDashboard = z.infer<typeof brokerdeskDashboardSchema>;
export type BrokerdeskDashboardAction = z.infer<typeof brokerdeskDashboardActionSchema>;
