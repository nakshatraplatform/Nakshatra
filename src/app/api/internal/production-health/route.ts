import { NextResponse } from "next/server";
import { productionHealth, workerAuthorized } from "@/features/operations/server/production-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!workerAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const health = await productionHealth();
    return NextResponse.json(health, { status: health.healthy === true ? 200 : 503, headers });
  } catch {
    return NextResponse.json({ healthy: false }, { status: 503, headers });
  }
}
