import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import {
  readJsonBody,
  requestSecurityErrorResponse,
  requireSameOrigin,
} from "@/lib/api/request-security";
import { publicationProgressActionSchema } from "@/features/portfolio/server/publication-readiness.contract";
import {
  PublicationProgressError,
  updatePublicationProgress,
} from "@/features/portfolio/server/publication-readiness.service";

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }
  const auth = await getApiUser();
  if (auth.status !== "authenticated") return apiAuthFailureResponse(auth);
  const rateLimited = await enforceRateLimit(auth.supabase, request, "dashboard_save");
  if (rateLimited) return rateLimited;
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return requestSecurityErrorResponse(error);
  }
  const parsed = publicationProgressActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "PUBLICATION_PROGRESS_INVALID", error: "That publication step is invalid." }, { status: 400 });
  }
  try {
    const readiness = await updatePublicationProgress(auth.supabase, parsed.data);
    return NextResponse.json({ ok: true, readiness });
  } catch (error) {
    const known = error instanceof PublicationProgressError ? error : null;
    return NextResponse.json(
      { code: known?.code || "PUBLICATION_PROGRESS_FAILED", error: known?.message || "We could not save your publication progress." },
      { status: known?.status || 500 }
    );
  }
}
