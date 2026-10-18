import { NextResponse } from "next/server";
import { accountProfileSchema, readAccountProfile } from "@/features/account/profile";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { AUTH_BODY_LIMIT, readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };

/** Only the current verified session can update its three non-privileged name keys. */
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
    const limited = await enforceRateLimit(auth.supabase, request, "dashboard_save");
    if (limited) return limited;
    const parsed = accountProfileSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) return NextResponse.json({ code: "PROFILE_INVALID", error: "Enter your first and last name. Each name must be 80 characters or fewer." }, { status: 400, headers });
    const { firstName, middleName, lastName } = parsed.data;
    const { data, error } = await auth.supabase.auth.updateUser({ data: { account_first_name: firstName, account_middle_name: middleName, account_last_name: lastName } });
    if (error || !data.user || data.user.id !== auth.user.id) return NextResponse.json({ code: "PROFILE_SAVE_FAILED", error: "We could not save your account names. Please try again." }, { status: 503, headers });
    return NextResponse.json(readAccountProfile(data.user), { headers });
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }
}
