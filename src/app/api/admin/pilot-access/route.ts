import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import {
  AUTH_BODY_LIMIT,
  readJsonBody,
  requestSecurityErrorResponse,
  requireSameOrigin,
} from "@/lib/api/request-security";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import {
  pilotAdminFilterSchema,
  reviewPilotAccessSchema,
} from "@/features/pilot-access/server/pilot-access.contract";
import {
  listPilotAccessRequests,
  PilotAccessServiceError,
  reviewPilotAccessRequest,
} from "@/features/pilot-access/server/pilot-access.service";

const noStore = { "Cache-Control": "private, no-store" };

function failure(error: unknown) {
  if (error instanceof PilotAccessServiceError) {
    if (error.databaseCode === "42501") {
      return NextResponse.json({ code: "PILOT_ADMIN_FORBIDDEN", error: "Pilot administration is unavailable." }, { status: 403, headers: noStore });
    }
    if (error.reason === "invalid_request") {
      return NextResponse.json({ code: "PILOT_DECISION_REJECTED", error: "This decision is no longer valid. Refresh and try again." }, { status: 409, headers: noStore });
    }
  }
  return NextResponse.json({ code: "PILOT_ADMIN_UNAVAILABLE", error: "Pilot administration is temporarily unavailable." }, { status: 503, headers: noStore });
}

export async function GET(request: Request) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const parsed = pilotAdminFilterSchema.safeParse(new URL(request.url).searchParams.get("status") ?? "pending");
  if (!parsed.success) return NextResponse.json({ code: "PILOT_FILTER_INVALID", error: "Invalid request filter." }, { status: 400, headers: noStore });
  try {
    return NextResponse.json({ requests: await listPilotAccessRequests(auth.supabase, parsed.data) }, { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const limited = await enforceRateLimit(auth.supabase, request, "pilot_access_review");
  if (limited) return limited;
  const parsed = reviewPilotAccessSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
  if (!parsed.success) return NextResponse.json({ code: "PILOT_DECISION_INVALID", error: "Check the decision and note." }, { status: 400, headers: noStore });
  try {
    return NextResponse.json(await reviewPilotAccessRequest(auth.supabase, parsed.data), { headers: noStore });
  } catch (error) {
    return failure(error);
  }
}
