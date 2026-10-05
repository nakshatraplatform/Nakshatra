import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { listOnboardingFeedback } from "@/features/feedback/server/onboarding-feedback.service";

export async function GET() {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json({ feedback: await listOnboardingFeedback(auth.supabase) }, { headers });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "42501") return NextResponse.json({ code: "ADMIN_FORBIDDEN", error: "Administrator access is required." }, { status: 403, headers });
    return NextResponse.json({ code: "FEEDBACK_UNAVAILABLE", error: "Feedback is temporarily unavailable." }, { status: 503, headers });
  }
}
