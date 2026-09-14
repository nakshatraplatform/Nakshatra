import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { pilotAdminFilterSchema } from "@/features/pilot-access/server/pilot-access.contract";
import {
  listPilotAccessRequests,
  PilotAccessServiceError,
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

export async function POST() {
  return NextResponse.json(
    { code: "WAITLIST_READ_ONLY", error: "Waitlist entries do not grant product access." },
    { status: 405, headers: { ...noStore, Allow: "GET" } }
  );
}
