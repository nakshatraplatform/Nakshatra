import { z } from "zod/v4";
import { resolvedBrokerIntroductionSchema } from "@/features/broker-introductions/server/broker-introduction.contract";

const [unavailable, portfolio] = resolvedBrokerIntroductionSchema.options;
export const familyIntroductionSchema = z.discriminatedUnion("available", [
  unavailable,
  portfolio.pick({
    available: true, introductionRef: true, disclosureLevel: true, data: true,
    media: true, horoscope: true, templateId: true, sunSign: true, expiresAt: true, versionNumber: true,
  }),
]);
export const familyIntroductionAssetSchema = z.enum([
  "photo-0", "photo-1", "photo-2", "photo-3", "photo-4", "photo-5", "photo-6", "photo-7", "horoscope",
]);
export type FamilyIntroductionAsset = z.infer<typeof familyIntroductionAssetSchema>;
