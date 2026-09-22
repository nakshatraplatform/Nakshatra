import { NextResponse } from "next/server";
import { resolveBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.service";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";

type Context = { params: Promise<{ introductionRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, context: Context) {
  const { introductionRef } = await context.params;
  if (!brokerIntroductionRouteRefSchema.safeParse(introductionRef).success) {
    return NextResponse.json({ available: false }, { status: 404, headers });
  }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "broker_introduction_read");
  if (limited) return limited;
  try {
    const result = await resolveBrokerIntroduction(auth.supabase, introductionRef);
    return NextResponse.json(result, { status: result.available ? 200 : 404, headers });
  } catch {
    return NextResponse.json({ available: false }, { status: 404, headers });
  }
}
