import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { feedbackCommandSchema, getOwnOnboardingFeedback, submitOnboardingFeedback } from "@/features/feedback/server/onboarding-feedback.service";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  try {
    return NextResponse.json({ feedback: await getOwnOnboardingFeedback(auth.supabase) }, { headers: noStore });
  } catch {
    return NextResponse.json({ code: "FEEDBACK_UNAVAILABLE", error: "Feedback is temporarily unavailable." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return requestSecurityErrorResponse(error); }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "dashboard_save");
  if (limited) return limited;
  let input: unknown;
  try { input = await readJsonBody(request); } catch (error) { return requestSecurityErrorResponse(error); }
  const parsed = feedbackCommandSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ code: "FEEDBACK_INVALID", error: "Choose a rating and the hardest step, then try again." }, { status: 400, headers: noStore });
  try {
    await submitOnboardingFeedback(auth.supabase, parsed.data);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42501") return NextResponse.json({ code: "PORTFOLIO_INCOMPLETE", error: "Complete your portfolio details before sending feedback." }, { status: 403, headers: noStore });
    return NextResponse.json({ code: "FEEDBACK_UNAVAILABLE", error: "We could not save your feedback. Please try again." }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ status: "saved" }, { headers: noStore });
}
