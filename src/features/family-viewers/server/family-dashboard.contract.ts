import { z } from "zod/v4";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";

export const familyDashboardCursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  introductionRef: brokerIntroductionRouteRefSchema,
}).strict();

export const familyDashboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  beforeCreatedAt: z.iso.datetime({ offset: true }).optional(),
  beforeRef: brokerIntroductionRouteRefSchema.optional(),
}).strict().refine(
  value => Boolean(value.beforeCreatedAt) === Boolean(value.beforeRef),
  { message: "Both cursor fields are required together." }
);

export const familyDashboardSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }).strict(),
  z.object({
    available: z.literal(true),
    introductions: z.array(z.object({
      introductionRef: brokerIntroductionRouteRefSchema,
      // The publication database accepts names up to 180 characters.
      candidateNames: z.array(z.string().min(1).max(180)).min(1).max(2),
      status: z.enum(["active", "awaiting", "mutual", "expired", "closed"]),
      createdAt: z.iso.datetime({ offset: true }),
      responseDueAt: z.iso.datetime({ offset: true }),
    }).strict()).max(50),
    nextCursor: familyDashboardCursorSchema.nullable(),
  }).strict(),
]);

export type FamilyDashboardQuery = z.input<typeof familyDashboardQuerySchema>;
export type FamilyDashboard = z.infer<typeof familyDashboardSchema>;
