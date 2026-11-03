import { z } from "zod/v4";
import { portfolioSharePathSchema } from "@/features/portfolio/share-path";

export const memberInterestContextSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }),
  z.object({ available: z.literal(true), name: z.string().min(1).max(180), revision: z.string().regex(/^[a-f0-9]{32}$/),
    photoCount: z.number().int().nonnegative(), privatePhotoCount: z.number().int().nonnegative(), hasHoroscope: z.boolean(),
    alreadySent: z.boolean(), requestStatus: z.string().nullable(), sharingActive: z.boolean() }),
]);
export type MemberInterestContext = Extract<z.infer<typeof memberInterestContextSchema>, { available: true }>;
export const memberInterestSubmissionSchema = z.object({
  portfolioToken: portfolioSharePathSchema, revision: z.string().regex(/^[a-f0-9]{32}$/),
  scope: z.literal("full_portfolio"), message: z.string().trim().max(600).optional(),
}).strict();
export const memberInterestResultSchema = z.object({ status: z.enum(["submitted", "existing_request", "unavailable", "review_changed", "rate_limited"]),
  mutual: z.boolean().optional(), requestStatus: z.string().optional() });
