import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { hardestStepValues, likedAspectValues } from "@/features/feedback/onboarding-feedback-options";

const hardestStepsSchema = z.array(z.enum(hardestStepValues)).min(1).max(hardestStepValues.length)
  .refine((steps) => new Set(steps).size === steps.length && (steps.length === 1 || !steps.includes("none")), "Choose distinct steps, or Nothing stood out alone.");
const likedAspectsSchema = z.array(z.enum(likedAspectValues)).max(likedAspectValues.length)
  .refine((aspects) => new Set(aspects).size === aspects.length, "Choose distinct aspects.");

const feedbackSchema = z.object({
  easeRating: z.number().int().min(1).max(5),
  hardestSteps: hardestStepsSchema,
  likedAspects: likedAspectsSchema,
  comment: z.string().nullable(),
  submittedAt: z.string(),
});

export const feedbackCommandSchema = feedbackSchema.pick({ easeRating: true, hardestSteps: true, likedAspects: true })
  .extend({ comment: z.string().trim().max(1000).optional() }).strict();

// Accept an already-open pre-release form while it drains after deployment.
export const feedbackRequestSchema = z.union([
  feedbackCommandSchema,
  z.object({
    easeRating: z.number().int().min(1).max(5),
    hardestStep: z.enum(hardestStepValues),
    comment: z.string().trim().max(1000).optional(),
  }).strict().transform(({ hardestStep, ...rest }) => ({ ...rest, hardestSteps: [hardestStep], likedAspects: [] })),
]);

export async function getOwnOnboardingFeedback(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_creator_onboarding_feedback");
  if (error) throw error;
  return data === null ? null : feedbackSchema.parse(data);
}

export async function submitOnboardingFeedback(supabase: SupabaseClient, command: z.infer<typeof feedbackCommandSchema>) {
  const { data, error } = await supabase.rpc("submit_creator_onboarding_feedback_v2", {
    p_ease_rating: command.easeRating,
    p_hardest_steps: command.hardestSteps,
    p_liked_aspects: command.likedAspects,
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
