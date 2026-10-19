import { NextResponse } from "next/server";
import { readLimitedBody, RequestSecurityError } from "@/lib/api/request-security";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ResendWebhookError, verifyResendWebhook } from "@/features/notifications/server/resend-webhook";

export const runtime = "nodejs";
export const maxDuration = 15;
const noStore = { "Cache-Control": "no-store" };
const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: noStore });

/** Only authenticated, normalized metadata crosses the private persistence boundary. */
export async function POST(request: Request) {
  try {
    const bytes = await readLimitedBody(request, 64 * 1024);
    const event = verifyResendWebhook(bytes, request.headers);
    if (event) {
      const bounded: typeof fetch = (url, init) => fetch(url, { ...init,
        signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : [])]),
      });
      const { data, error } = await createServiceRoleClient(bounded).rpc("record_resend_delivery_event", event);
      if (error || typeof data !== "boolean") return reply({ code: "RESEND_WEBHOOK_UNAVAILABLE" }, 503);
    }
    return reply({ accepted: true }, 202);
  } catch (error) {
    if (error instanceof ResendWebhookError) return reply({ code: error.code }, error.status);
    if (error instanceof RequestSecurityError) return reply({ code: "RESEND_WEBHOOK_INVALID" }, 413);
    return reply({ code: "RESEND_WEBHOOK_UNAVAILABLE" }, 503);
  }
}
