import "server-only";

import { z } from "zod/v4";

/** Internal dispatch input, never a public request schema or authorization proof. */
export const emailMessageSchema = z.object({
  deliveryId: z.uuid(),
  to: z.email().max(254),
  subject: z.string().trim().min(1).max(200).regex(/^[^\r\n\u0000-\u001f\u007f]+$/),
  text: z.string().min(1).max(32_768).refine((value) => value.trim().length > 0),
  html: z.string().min(1).max(65_536).optional(),
}).strict();

export type EmailMessage = z.infer<typeof emailMessageSchema>;
export type EmailFailureCode =
  | "EMAIL_INPUT_INVALID"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_CREDENTIALS_REJECTED"
  | "EMAIL_REJECTED"
  | "EMAIL_IDEMPOTENCY_CONFLICT"
  | "EMAIL_RATE_LIMITED"
  | "EMAIL_PROVIDER_UNAVAILABLE"
  | "EMAIL_RESPONSE_INVALID"
  | "EMAIL_TIMEOUT";

export type EmailDispatchResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "failed"; code: EmailFailureCode; retryable: boolean };
