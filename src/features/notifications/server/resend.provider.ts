import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { EmailDispatchResult } from "./email.contract";
import { sendTrackedEmail } from "./delivery.runtime.mjs";

/** Every application caller shares suppression/tracking; Auth SMTP is separate. */
export async function sendResendEmail(input: unknown, transport: typeof fetch = fetch, client?: SupabaseClient): Promise<EmailDispatchResult> {
  try {
    const databaseTransport: typeof fetch = (url, init) => transport(url, { ...init,
      signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : [])]),
    });
    return await sendTrackedEmail(input, client ?? createServiceRoleClient(databaseTransport), transport) as EmailDispatchResult;
  } catch {
    return { status: "failed", code: "EMAIL_DELIVERY_GUARD_UNAVAILABLE", retryable: true };
  }
}
