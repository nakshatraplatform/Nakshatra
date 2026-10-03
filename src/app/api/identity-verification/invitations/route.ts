import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";

const noStore = { "Cache-Control": "private, no-store" };

/** Delegated verification is unavailable during the self-created pilot. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    const response = requestSecurityErrorResponse(error);
    response.headers.set("Cache-Control", noStore["Cache-Control"]);
    return response;
  }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") {
    const response = apiAuthFailureResponse(auth);
    response.headers.set("Cache-Control", noStore["Cache-Control"]);
    return response;
  }
  return NextResponse.json(
    { code: "PILOT_SELF_VERIFICATION_ONLY", error: "For this pilot, the person in the portfolio must verify from their own account." },
    { status: 403, headers: noStore }
  );
}
