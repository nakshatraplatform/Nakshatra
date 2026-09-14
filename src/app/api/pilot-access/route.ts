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
import { submitPilotAccessSchema } from "@/features/pilot-access/server/pilot-access.contract";
import {
  loadPilotAccessState,
  PilotAccessServiceError,
  submitPilotAccessRequest,
} from "@/features/pilot-access/server/pilot-access.service";

const noStore = { "Cache-Control": "private, no-store" };

function pilotAccessErrorResponse(error: unknown) {
  if (error instanceof PilotAccessServiceError) {
    if (error.reason === "database_update_required") {
      return NextResponse.json(
        { code: "PILOT_DATABASE_UPDATE_REQUIRED", error: "Pilot access is temporarily unavailable while the database is updated." },
        { status: 503, headers: noStore }
      );
    }
    if (error.reason === "verified_email_required") {
      return NextResponse.json(
        { code: "VERIFIED_EMAIL_REQUIRED", error: "Verify your email before requesting pilot access." },
        { status: 403, headers: noStore }
      );
    }
    if (error.reason === "invalid_request") {
      return NextResponse.json(
        { code: "PILOT_ACCESS_REQUEST_REJECTED", error: "Check the submitted details and try again." },
        { status: 400, headers: noStore }
      );
    }
  }
  return NextResponse.json(
    { code: "PILOT_ACCESS_UNAVAILABLE", error: "Pilot access is temporarily unavailable. Please try again." },
    { status: 503, headers: noStore }
  );
}

export async function GET() {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  try {
    return NextResponse.json(await loadPilotAccessState(auth.supabase), { headers: noStore });
  } catch (error) {
    return pilotAccessErrorResponse(error);
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
  const rateLimited = await enforceRateLimit(auth.supabase, request, "pilot_access_submit");
  if (rateLimited) return rateLimited;

  const command = submitPilotAccessSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
  if (!command.success) {
    return NextResponse.json(
      { code: "PILOT_ACCESS_REQUEST_INVALID", error: "Enter a valid name and optional international phone number." },
      { status: 400, headers: noStore }
    );
  }
  try {
    const result = await submitPilotAccessRequest(auth.supabase, command.data);
    return NextResponse.json(result, {
      status: result.status === "already_creator" ? 200 : 201,
      headers: noStore,
    });
  } catch (error) {
    return pilotAccessErrorResponse(error);
  }
}
