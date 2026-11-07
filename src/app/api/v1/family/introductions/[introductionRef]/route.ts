import { NextResponse } from "next/server";
import { familyIntroductionAssetSchema } from "@/features/family-viewers/server/family-introduction.contract";
import { readFamilyIntroductionAsset, resolveFamilyIntroduction } from "@/features/family-viewers/server/family-introduction.service";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { privateIntroductionResponse } from "@/features/broker-introductions/server/introduction-workspace.http";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import { getApiUser } from "@/lib/auth";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const unavailable = () => NextResponse.json({ available: false }, { status: 404, headers });

export async function GET(request: Request, context: { params: Promise<{ introductionRef: string }> }) {
  try {
    const ref = brokerIntroductionRouteRefSchema.safeParse((await context.params).introductionRef);
    const params = [...new URL(request.url).searchParams];
    const asset = familyIntroductionAssetSchema.safeParse(params[0]?.[1]);
    if (!ref.success || (params.length && (params.length !== 1 || params[0][0] !== "asset" || !asset.success))) return unavailable();
    const auth = await getApiUser();
    if (auth.status !== "authenticated") return privateIntroductionResponse(apiAuthFailureResponse(auth));
    const limited = await enforceRateLimit(auth.supabase, request, "broker_introduction_read");
    if (limited) return privateIntroductionResponse(limited);

    if (asset.success) {
      const file = await readFamilyIntroductionAsset(auth.user, ref.data, asset.data);
      if (!file) return unavailable();
      const fileHeaders = new Headers(headers);
      fileHeaders.set("Content-Type", file.contentType);
      if (file.fileName) fileHeaders.set("Content-Disposition", `attachment; filename="${file.fileName}"`);
      return new Response(file.body, { headers: fileHeaders });
    }
    const result = await resolveFamilyIntroduction(auth.supabase, ref.data);
    return result.available ? NextResponse.json(result, { headers }) : unavailable();
  } catch {
    return unavailable();
  }
}
