import { z } from "zod/v4";

export const editorSectionSchema = z.enum([
  "privacy", "foundation", "story", "work", "family", "astrology",
  "lifestyle", "preferences", "future",
]);

export const publicationReadinessSchema = z.object({
  portfolioExists: z.boolean(),
  lastEditorSection: editorSectionSchema.nullish().transform((value) => value ?? null),
  previewedAt: z.string().nullable(),
  selectedPlanCode: z.string().nullable(),
  verificationStatus: z.enum(["required", "verified"]),
  paymentStatus: z.enum(["none", "pending", "paid", "failed", "refunded", "cancelled"]),
  paymentExpiresAt: z.string().nullable(),
  paymentActive: z.boolean().optional().default(false),
  disclosureConfirmed: z.boolean(),
  published: z.boolean(),
  missingRequired: z.array(z.string()),
}).strict();

export const publicationProgressActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("editor_section"), value: editorSectionSchema }).strict(),
  z.object({ action: z.literal("previewed"), value: z.null().optional() }).strict(),
  z.object({ action: z.literal("select_plan"), value: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/) }).strict(),
  z.object({ action: z.literal("confirm_disclosure"), value: z.literal("publication-disclosure-v1") }).strict(),
]);

export type PublicationReadiness = z.infer<typeof publicationReadinessSchema>;
export type PublicationProgressAction = z.infer<typeof publicationProgressActionSchema>;

export const EMPTY_PUBLICATION_READINESS: PublicationReadiness = {
  portfolioExists: false,
  lastEditorSection: null,
  previewedAt: null,
  selectedPlanCode: null,
  verificationStatus: "required",
  paymentStatus: "none",
  paymentExpiresAt: null,
  paymentActive: false,
  disclosureConfirmed: false,
  published: false,
  missingRequired: [],
};
