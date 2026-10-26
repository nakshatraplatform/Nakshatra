import { z } from "zod/v4";
import { accessGrantSchema } from "./server/access.contract";
import { dashboardInterestSchema } from "@/features/interest/server/interest-dashboard.contract";

export const relationshipStageSchema = z.enum(["awaiting", "set-aside", "access", "history"]);
export const relationshipQueueSchema = z.object({
  records: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("interest"), item: dashboardInterestSchema }),
    z.object({ kind: z.literal("grant"), item: accessGrantSchema }),
  ])).max(8),
  total: z.number().int().nonnegative(),
});
export type RelationshipQueue = z.infer<typeof relationshipQueueSchema>;
