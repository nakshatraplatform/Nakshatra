import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

const feedbackSchema = z.object({
  easeRating: z.number().int().min(1).max(5),
  hardestStep: z.enum(["none", "details", "photos", "verification", "publishing", "other"]),
  comment: z.string().nullable(),
  submittedAt: z.string(),
});

export const feedbackCommandSchema = feedbackSchema.pick({ easeRating: true, hardestStep: true })
  .extend({ comment: z.string().trim().max(1000).optional() }).strict();

export async function getOwnOnboardingFeedback(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_creator_onboarding_feedback");
  if (error) throw error;
  return data === null ? null : feedbackSchema.parse(data);
}

export async function submitOnboardingFeedback(supabase: SupabaseClient, command: z.infer<typeof feedbackCommandSchema>) {
  const { data, error } = await supabase.rpc("submit_creator_onboarding_feedback", {
    p_ease_rating: command.easeRating,
    p_hardest_step: command.hardestStep,
    p_comment: command.comment ?? null,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || data.status !== "saved") throw new Error("Feedback persistence failed");
}

export async function listOnboardingFeedback(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("list_creator_onboarding_feedback", { p_limit: 50 });
  if (error) throw error;
  return feedbackSchema.array().parse(data);
}
