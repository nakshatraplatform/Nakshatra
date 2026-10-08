import "server-only";
import type { EmailDispatchResult } from "./email.contract";
import { sendResendEmail as dispatch } from "./resend.runtime.mjs";

/** Next.js boundary; the isolated Node worker shares the same runtime adapter. */
export async function sendResendEmail(input: unknown, transport: typeof fetch = fetch): Promise<EmailDispatchResult> {
  return dispatch(input, transport) as Promise<EmailDispatchResult>;
}
