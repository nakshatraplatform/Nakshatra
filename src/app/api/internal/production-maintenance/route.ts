import { NextResponse } from "next/server";
import { runProductionMaintenance, workerAuthorized } from "@/features/operations/server/production-maintenance";
import { getRequestId, logServerError } from "@/lib/security/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!workerAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const result = await runProductionMaintenance(request.headers.get("x-worker-dispatch") ?? undefined);
    return NextResponse.json(result, { status: result.failed ? 503 : 200, headers });
  } catch (error) {
    logServerError("production_maintenance.failed", getRequestId(request), error);
    return NextResponse.json({ error: "Maintenance unavailable" }, { status: 503, headers });
  }
}
