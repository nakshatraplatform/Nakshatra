import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { memberInterestSubmissionSchema } from "@/features/interest/member-interest.contract";
import { loadMemberInterestContext, sendMemberInterest } from "@/features/interest/server/member-interest.service";
import { portfolioSharePathSchema } from "@/features/portfolio/share-path";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { readJsonBody, requireSameOrigin, RequestSecurityError, requestSecurityErrorResponse } from "@/lib/api/request-security";
const headers = { "Cache-Control": "private, no-store" };
const failure = (status: number, error: string, code = "MEMBER_INTEREST_UNAVAILABLE") => NextResponse.json({ error, code }, { status, headers });

export async function GET(request: Request) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "interest_decision");
  if (limited) return limited;
  const token = portfolioSharePathSchema.safeParse(new URL(request.url).searchParams.get("token"));
  if (!token.success) return failure(400, "Open the original introduction link and try again.");
  try { return NextResponse.json(await loadMemberInterestContext(auth.supabase, token.data), { headers }); }
  catch { return failure(503, "We could not load your published profile. Please try again."); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const parsed = memberInterestSubmissionSchema.safeParse(await readJsonBody(request, 4096));
    if (!parsed.success) return failure(400, "Refresh this form and review what you are sharing.", "MEMBER_INTEREST_INVALID");
    const result = await sendMemberInterest(auth.supabase, parsed.data);
    if (result.status === "review_changed") return failure(409, "Your published details changed. We have refreshed the sharing summary; review it and send again.", "SHARING_REVIEW_CHANGED");
    if (result.status === "existing_request") return failure(409, "You already sent interest to this person. Check its current status in your dashboard.", "INTEREST_ALREADY_SENT");
    if (result.status === "unavailable") return failure(409, "A published introduction is unavailable. No interest or access was created.");
    if (result.status === "rate_limited") return failure(429, "Too many requests. Please wait and try again.");
    return NextResponse.json({ submitted: true, mutual: result.mutual === true }, { status: 201, headers });
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return failure(503, "We could not confirm the request. Retry safely; this will not duplicate sharing or extend its expiry.");
  }
}
