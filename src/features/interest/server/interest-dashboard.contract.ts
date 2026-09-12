import { z } from "zod/v4";

export const dashboardInterestSchema = z.object({
  id: z.string().uuid(),
  viewer_name: z.string().nullable(),
  viewer_phone: z.string().nullable(),
  viewer_email: z.string().nullable(),
  viewer_family_context: z.string().nullable(),
  message: z.string().nullable(),
  status: z.string(),
  requester_user_id: z.string().uuid().nullable(),
  metadata: z.preprocess(
    (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : null,
    z.record(z.string(), z.unknown()).nullable()
  ),
  created_at: z.string(),
  email_verified: z.boolean().default(false),
  source_type: z.enum(["direct", "broker"]).default("direct"),
  broker_name: z.string().nullable().default(null),
  broker_representative_name: z.string().nullable().default(null),
  requester_portfolio_token: z.string().nullable().default(null),
});

export const dashboardInterestsSchema = z.array(dashboardInterestSchema);

export type DashboardInterest = z.output<typeof dashboardInterestSchema>;
