import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processRelationshipNotifications } from "@/features/notifications/server/relationship-notification.service";
import { getRequestId, logServerError } from "@/lib/security/logging";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const expected = process.env.NOTIFICATION_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

/** Service-only entry point for a scheduler; browser sessions cannot claim notification work. */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!authorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const result = await processRelationshipNotifications(createServiceRoleClient());
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logServerError("relationship_notifications.process_failed", requestId, error);
    return NextResponse.json({ code: "NOTIFICATION_WORKER_FAILED", error: "Notification processing failed." }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
}
