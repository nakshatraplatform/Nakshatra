import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { decideInterestRequest } from "@/features/interest/server/interest-decision.service";
import {
  readJsonBody,
  requestSecurityErrorResponse,
  requireSameOrigin,
} from "@/lib/api/request-security";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { interestDetailsSchema } from "@/features/interest/server/interest-dashboard.contract";

/** Exact-ID owner-only read; no dependency on dashboard queue limits. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const rateLimited = await enforceRateLimit(auth.supabase, request, "interest_decision");
  if (rateLimited) return rateLimited;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Interest not found." }, { status: 404 });
  const { data, error } = await Promise.resolve(auth.supabase.rpc("get_interest_details", { p_request_id: id })).catch(() => ({ data: null, error: { code: "NETWORK_FAILURE" } }));
  const parsed = interestDetailsSchema.safeParse(data);
  if (error) return NextResponse.json({ error: "We could not load these details. Try again." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (!parsed.success) return NextResponse.json({ error: "Interest not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ details: parsed.data }, { headers: { "Cache-Control": "private, no-store" } });
}

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "reopened"]),
  revision: z.string().regex(/^[a-f0-9]{32}$/).optional(),
}).refine(value => value.decision !== "approved" || Boolean(value.revision), "Review the current published details before sharing.");

/** Lets a portfolio owner approve identity-bound Complete Portfolio access or decline an interest. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const rateLimited = await enforceRateLimit(auth.supabase, request, "interest_decision");
  if (rateLimited) return rateLimited;

  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }
  const parsed = decisionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INTEREST_DECISION_INVALID", error: "Choose approve, decline, or reopen. To share details, open the current disclosure confirmation first." },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const requestId = z.string().uuid().safeParse(id);
  if (!requestId.success) {
    return NextResponse.json({ code: "INTEREST_NOT_FOUND", error: "This interest could not be found." }, { status: 404 });
  }
  const result = await decideInterestRequest(auth.supabase, requestId.data, parsed.data.decision, parsed.data.revision)
    .catch(() => "failed" as const);

  if (result === "not_found") {
    return NextResponse.json({ code: "INTEREST_NOT_FOUND", error: "This interest could not be found." }, { status: 404 });
  }
  if (result === "review_changed") return NextResponse.json({ code: "SHARING_REVIEW_CHANGED", error: "Published details changed. Close this confirmation and review them again before sharing." }, { status: 409 });
  if (result === "signin_required") {
    return NextResponse.json(
      { code: "INTEREST_SIGNIN_REQUIRED", error: "Ask this viewer to sign in and verify their email before approving access." },
      { status: 409 }
    );
  }
  if (result === "verification_required") {
    return NextResponse.json(
      { code: "INTEREST_VERIFICATION_REQUIRED", error: "Ask this viewer to verify their email before approving access." },
      { status: 409 }
    );
  }
  if (result === "unauthorized") {
    return NextResponse.json({ code: "INTEREST_FORBIDDEN", error: "You cannot manage this interest." }, { status: 403 });
  }
  if (result === "invalid_transition") {
    return NextResponse.json(
      { code: "INTEREST_INVALID_TRANSITION", error: "Reopen this request before approving it again." },
      { status: 409 }
    );
  }
  if (result === "failed") {
    return NextResponse.json({ code: "INTEREST_DECISION_FAILED", error: "This interest could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: result });
}
