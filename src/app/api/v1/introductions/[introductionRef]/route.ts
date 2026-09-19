import { NextResponse } from "next/server";
import { readRequestCookie } from "@/features/account/server/reauth-cookie";
import { brokerIntroductionCookieName, readBrokerIntroductionCookie } from "@/features/broker-introductions/server/broker-introduction.cookie";
import { resolveBrokerIntroduction } from "@/features/broker-introductions/server/broker-introduction.service";
import { hashBrokerIntroductionToken } from "@/features/broker-introductions/server/broker-introduction.token";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ introductionRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request, context: Context) {
  const { introductionRef } = await context.params;
  if (!brokerIntroductionRouteRefSchema.safeParse(introductionRef).success) {
    return NextResponse.json({ available: false }, { status: 404, headers });
  }
  const supabase = await createClient();
  const limited = await enforceRateLimit(supabase, request, "broker_introduction_read");
  if (limited) return limited;
  const sessionToken = readBrokerIntroductionCookie(readRequestCookie(request, brokerIntroductionCookieName(introductionRef)), introductionRef);
  try {
    const result = await resolveBrokerIntroduction(
      supabase,
      introductionRef,
      sessionToken ? hashBrokerIntroductionToken(sessionToken) : null
    );
    return NextResponse.json(result, { status: result.available ? 200 : 404, headers });
  } catch {
    return NextResponse.json({ available: false }, { status: 404, headers });
  }
}
