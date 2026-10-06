import { z } from "zod/v4";

/** Public recovery state contains no bearer credential or provider evidence. */
export const candidateRecoverySchema = z.object({
  state: z.enum(["not_started", "creating", "active", "awaiting_result", "cleanup_pending", "failed", "declined", "expired", "cancelled", "verified"]),
  attemptId: z.uuid().nullable(),
  deadline: z.iso.datetime({ offset: true }).nullable(),
  cleanupPending: z.boolean(),
  canStart: z.boolean(),
  canResume: z.boolean(),
  canCancel: z.boolean(),
});
export type CandidateRecovery = z.infer<typeof candidateRecoverySchema>;
