import { z } from "zod/v4";
import { accessGrantSchema } from "./server/access.contract";
import { dashboardInterestSchema } from "@/features/interest/server/interest-dashboard.contract";
import { portfolioDataSchema } from "@/types/portfolio";

export const relationshipQuerySchema = z.object({
  queue: z.enum(["overview", "awaiting", "set-aside", "access", "history"]).default("overview"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  query: z.string().trim().max(80).default(""),
  filter: z.enum(["all", "direct", "broker", "verified", "pending", "active", "ended"]).default("all"),
});
export const sharingDisclosureSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{32}$/),
  data: portfolioDataSchema,
  photoCount: z.number().int().nonnegative(),
  privatePhotoCount: z.number().int().nonnegative(),
  hasHoroscope: z.boolean(),
}).refine(value => value.privatePhotoCount <= value.photoCount, "Private photos cannot exceed the total.");
export const relationshipRecordSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("interest"), item: dashboardInterestSchema }),
  z.object({ kind: z.literal("grant"), item: accessGrantSchema }),
]);
export const relationshipPageSchema = z.object({
  records: z.array(relationshipRecordSchema).max(50),
  total: z.number().int().nonnegative(),
  counts: z.object({ interests: z.number().int().nonnegative(), awaiting: z.number().int().nonnegative(), setAside: z.number().int().nonnegative(), active: z.number().int().nonnegative() }),
  disclosure: sharingDisclosureSchema.nullable(),
});
export type RelationshipPage = z.infer<typeof relationshipPageSchema>;
export type RelationshipQuery = z.infer<typeof relationshipQuerySchema>;
export type SharingDisclosure = z.infer<typeof sharingDisclosureSchema>;
