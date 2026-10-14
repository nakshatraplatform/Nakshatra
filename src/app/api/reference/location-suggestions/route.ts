import { NextResponse } from "next/server";
import { locationSearchRequestSchema } from "@/features/location/location.contract";
import {
  LocationProviderError,
  resolveGooglePlace,
  searchLocationSuggestions,
} from "@/features/location/server/location-provider.service";
import { enforceRateLimit } from "@/features/security/server/rate-limit.service";
import { apiAuthFailureResponse } from "@/lib/api/auth-response";
import {
  AUTH_BODY_LIMIT,
  RequestSecurityError,
  readJsonBody,
  requestSecurityErrorResponse,
  requireSameOrigin,
} from "@/lib/api/request-security";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = locationSearchRequestSchema.safeParse(await readJsonBody(request, AUTH_BODY_LIMIT));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "LOCATION_QUERY_INVALID", error: "Enter a valid city, ZIP code, or PIN code." },
        { status: 400, headers: noStore }
      );
    }

    const auth = await getApiUser();
    let supabase;
    if (auth.status === "authenticated") {
      supabase = auth.supabase;
      if (parsed.data.portfolioToken) {
        const { data, error } = await supabase.rpc("resolve_public_portfolio", {
          p_share_token: parsed.data.portfolioToken,
        });
        if (error || !data) {
          return NextResponse.json(
            { code: "PORTFOLIO_NOT_FOUND", error: "This portfolio is not available." },
            { status: 404, headers: noStore }
          );
        }
      } else {
        const { data, error } = await supabase
          .from("portfolios")
          .select("id")
          .eq("user_id", auth.user.id)
          .limit(1)
          .maybeSingle();
        if (error || !data) {
          return NextResponse.json(
            { code: "LOCATION_SEARCH_FORBIDDEN", error: "Location search is not available for this account." },
            { status: 403, headers: noStore }
          );
        }
      }
    } else if (auth.status === "missing_session" && parsed.data.portfolioToken) {
      supabase = await createClient();
      const { data, error } = await supabase.rpc("resolve_public_portfolio", {
        p_share_token: parsed.data.portfolioToken,
      });
      if (error || !data) {
        return NextResponse.json(
          { code: "PORTFOLIO_NOT_FOUND", error: "This portfolio is not available." },
          { status: 404, headers: noStore }
        );
      }
    } else {
      return apiAuthFailureResponse(auth);
    }

    const rateLimited = await enforceRateLimit(supabase, request, "location_search");
    if (rateLimited) return rateLimited;

    if (parsed.data.action === "search") {
      try {
        const options = await searchLocationSuggestions(parsed.data);
        return NextResponse.json({ options }, { headers: noStore });
      } catch (error) {
        if (error instanceof LocationProviderError) {
          return NextResponse.json({ options: [], fallback: true }, { headers: noStore });
        }
        throw error;
      }
    }

    try {
      const location = await resolveGooglePlace(parsed.data.placeId, parsed.data.sessionToken);
      return NextResponse.json({ location }, { headers: noStore });
    } catch (error) {
      if (error instanceof LocationProviderError) {
        return NextResponse.json(
          {
            code: "LOCATION_RESOLUTION_UNAVAILABLE",
            error: "We could not confirm this location. Enter it manually instead.",
          },
          { status: error.reason === "invalid" ? 422 : 503, headers: noStore }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof RequestSecurityError) return requestSecurityErrorResponse(error);
    return NextResponse.json(
      { code: "LOCATION_REFERENCE_UNAVAILABLE", error: "Location suggestions are temporarily unavailable." },
      { status: 503, headers: noStore }
    );
  }
}
