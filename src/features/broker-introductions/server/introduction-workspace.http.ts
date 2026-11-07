import { NextResponse } from "next/server";
import { RequestSecurityError, requestSecurityErrorResponse } from "@/lib/api/request-security";
import { BrokerIntroductionError } from "./broker-introduction.service";
import { getRequestId, logServerError } from "@/lib/security/logging";

export const introductionPrivateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export function privateIntroductionResponse(response: NextResponse) {
  for (const [key, value] of Object.entries(introductionPrivateHeaders)) response.headers.set(key, value);
  return response;
}

/** Shared only by the workspace routes so every outcome retains private headers. */
export function introductionWorkspaceFailure(error: unknown, request: Request) {
  if (error instanceof RequestSecurityError) return privateIntroductionResponse(requestSecurityErrorResponse(error));
  if (error instanceof BrokerIntroductionError) {
    return NextResponse.json({ available: false, error: error.message }, { status: error.status, headers: introductionPrivateHeaders });
  }
  logServerError("broker.introduction_workspace.failed", getRequestId(request), error);
  return NextResponse.json({ available: false }, { status: 503, headers: introductionPrivateHeaders });
}
