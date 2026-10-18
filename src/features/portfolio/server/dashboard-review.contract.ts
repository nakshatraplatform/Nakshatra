import { z } from "zod/v4";
import { mediaVisibilitySchema } from "@/features/media/server/media.contract";
import { publicationReadinessSchema } from "./publication-readiness.contract";

const nullableText = z.string().nullable();

/** Explicit private owner projection; never reuse this contract for public viewers. */
export const dashboardReviewSnapshotSchema = z.object({
  portfolio: z.object({
    id: z.string().min(1), user_id: z.string().min(1), candidate_id: nullableText,
    share_token: nullableText, draft_data: z.json(), published_data: z.json(),
    template_id: z.number().int(), theme_color: nullableText, sun_sign: nullableText,
    is_published: z.boolean(), published_at: nullableText, expires_at: nullableText,
    last_renewed_at: nullableText, privacy_mode: z.string(), visibility_settings: z.json(),
    created_at: z.string(), updated_at: z.string(),
  }).strict().nullable(),
  media: z.array(z.object({
    id: z.string().min(1), portfolio_id: z.string().min(1), storage_path: z.string().min(1),
    thumbnail_path: nullableText, media_type: z.enum(["hero", "gallery"]),
    visibility: mediaVisibilitySchema, sort_order: z.number().int(), alt_text: nullableText,
    metadata: z.json().optional(),
  }).strict()),
  horoscope: z.object({
    id: z.string().min(1), portfolio_id: z.string().min(1), storage_path: z.string().min(1),
    mime_type: z.enum(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/webp"]),
    file_extension: z.enum(["pdf", "doc", "docx", "webp"]), byte_size: z.number().int(),
    language_label: nullableText, page_count: z.number().int().nullable(), published_at: nullableText,
    created_at: z.string(), updated_at: z.string(),
  }).strict().nullable(),
  readiness: publicationReadinessSchema,
}).strict().superRefine((snapshot, context) => {
  const portfolioId = snapshot.portfolio?.id;
  if (snapshot.readiness.portfolioExists !== Boolean(portfolioId)
    || snapshot.media.some((media) => media.portfolio_id !== portfolioId)
    || (snapshot.horoscope && snapshot.horoscope.portfolio_id !== portfolioId)
    || (portfolioId && !snapshot.readiness.reviewFingerprint)) {
    context.addIssue({ code: "custom", message: "Dashboard snapshot is inconsistent" });
  }
});
