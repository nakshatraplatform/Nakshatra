import "server-only";

import { z } from "zod/v4";
import { emailMessageSchema as runtimeSchema } from "./email-message.schema.mjs";

/** Internal dispatch input, never a public request schema or authorization proof. */
export const emailMessageSchema = runtimeSchema;

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
