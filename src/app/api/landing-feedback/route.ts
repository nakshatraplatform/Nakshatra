import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { readJsonBody, requestSecurityErrorResponse, requireSameOrigin } from "@/lib/api/request-security";
import { anonymousSubjectHash } from "@/features/security/server/rate-limit.service";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const feedbackSchema = z.object({
  audience: z.enum(["creator", "viewer", "family", "other"]),
  experience: z.string().trim().min(10).max(800),
  improvement: z.string().trim().max(800),
  creditName: z.string().trim().max(80),
  contactEmail: z.union([z.email().max(254), z.literal("")]),
  contactPermission: z.boolean(),
  website: z.string().max(100),
}).strict().refine(input => input.contactPermission ? Boolean(input.contactEmail) : !input.contactEmail && !input.creditName);

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try { requireSameOrigin(request); } catch (error) { return requestSecurityErrorResponse(error); }
  let input: unknown;
  try { input = await readJsonBody(request, 4096); } catch (error) { return requestSecurityErrorResponse(error); }
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Please check your answers and try again." }, { status: 400, headers });
  // A honeypot catches simple automated submissions without exposing whether
  // a record was stored. It is not a substitute for the database quota.
  if (parsed.data.website) return NextResponse.json({ status: "received" }, { headers });
  try {
    const client = createServiceRoleClient();
    const { data, error } = await client.rpc("submit_landing_feedback", {
      p_audience: parsed.data.audience,
      p_experience: parsed.data.experience,
      p_improvement: parsed.data.improvement || null,
      p_credit_name: parsed.data.creditName || null,
      p_contact_email: parsed.data.contactEmail || null,
      p_contact_permission: parsed.data.contactPermission,
      p_subject_hash: await anonymousSubjectHash(request),
    });
    if (error) throw error;
    if (data?.status === "rate_limited") return NextResponse.json({ error: "Too many submissions. Please try again tomorrow." }, { status: 429, headers });
    if (data?.status !== "saved") throw new Error("Feedback save failed");
    return NextResponse.json({ status: "received" }, { headers });
  } catch {
    return NextResponse.json({ error: "We could not save your feedback. Please try again later." }, { status: 503, headers });
  }
}
