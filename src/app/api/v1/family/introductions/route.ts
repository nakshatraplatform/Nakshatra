import { NextResponse } from "next/server";
import { familyDashboardQuerySchema } from "@/features/family-viewers/server/family-dashboard.contract";
import { resolveFamilyDashboard } from "@/features/family-viewers/server/family-dashboard.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";
import { getRequestId, logServerError } from "@/lib/security/logging";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const params = new URL(request.url).searchParams;
    const input = familyDashboardQuerySchema.safeParse(Object.fromEntries(params));
    if (!input.success || new Set(params.keys()).size !== [...params.keys()].length) {
      return NextResponse.json({ available: false }, { status: 400, headers: privateHeaders });
    }
    const auth = await getApiUser();
    if (auth.status !== "authenticated") {
      const response = apiAuthFailureResponse(auth);
      for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
      return response;
    }
    const limited = await enforceRateLimit(auth.supabase, request, "customer_family_viewer_read");
    if (limited) {
      for (const [key, value] of Object.entries(privateHeaders)) limited.headers.set(key, value);
      return limited;
    }
    const result = await resolveFamilyDashboard(auth.supabase, input.data);
    return NextResponse.json(result, { status: result.available ? 200 : 403, headers: privateHeaders });
  } catch (error) {
    logServerError("family.dashboard.read_failed", requestId, error);
    return NextResponse.json({ available: false }, {
      status: 503, headers: { ...privateHeaders, "X-Request-Id": requestId },
    });
  }
}
