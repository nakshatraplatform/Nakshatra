import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const searchLocationSuggestions = vi.hoisted(() => vi.fn());
const resolveGooglePlace = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", () => ({ getApiUser }));
vi.mock("../src/lib/supabase/server", () => ({ createClient }));
vi.mock("../src/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("../src/features/location/server/location-provider.service", () => ({
  LocationProviderError: class LocationProviderError extends Error { constructor(public reason: string) { super(reason); } },
  searchLocationSuggestions,
  resolveGooglePlace,
}));

import { POST } from "../src/app/api/reference/location-suggestions/route";

const request = (body: unknown, origin = "http://local") => new Request("http://local/api/reference/location-suggestions", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body),
});

function editorClient(data: unknown = { id: "portfolio-1" }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const limit = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })) };
}

describe("location suggestions route", () => {
  beforeEach(() => { vi.clearAllMocks(); enforceRateLimit.mockResolvedValue(null); });

  it("requires a same-origin authenticated request or active public portfolio token", async () => {
    expect((await POST(request({}, "https://evil.example"))).status).toBe(403);
    getApiUser.mockResolvedValue({ status: "missing_session" });
    expect((await POST(request({ action: "search", query: "Boston", countryCode: "US", sessionToken: crypto.randomUUID() }))).status).toBe(401);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    createClient.mockResolvedValue({ rpc });
    expect((await POST(request({ action: "search", query: "Boston", countryCode: "US", sessionToken: crypto.randomUUID(), portfolioToken: "public-token" }))).status).toBe(404);

    getApiUser.mockResolvedValue({ status: "authenticated", user: { id: "viewer" }, supabase: editorClient(null) });
    expect((await POST(request({ action: "search", query: "Boston", countryCode: "US", sessionToken: crypto.randomUUID() }))).status).toBe(403);
  });

  it("returns normalized suggestions and resolved locations", async () => {
    getApiUser.mockResolvedValue({ status: "authenticated", user: { id: "editor" }, supabase: editorClient() });
    searchLocationSuggestions.mockResolvedValue([{ id: "place_123", label: "Boston", provider: "google_places", requiresResolution: true }]);
    resolveGooglePlace.mockResolvedValue({ country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", locationSource: "google_places" });
    const token = crypto.randomUUID();
    const search = await POST(request({ action: "search", query: "Boston", countryCode: "US", sessionToken: token }));
    expect(search.status).toBe(200);
    expect((await search.json()).options).toHaveLength(1);
    const resolve = await POST(request({ action: "resolve", provider: "google_places", placeId: "place_123", sessionToken: token }));
    expect(resolve.status).toBe(200);
    expect(await resolve.json()).toMatchObject({ location: { subdivisionCode: "US-MA" } });
  });

  it("accepts an active public portfolio token and enforces the shared rate limit", async () => {
    getApiUser.mockResolvedValue({ status: "missing_session" });
    const anonymousClient = { rpc: vi.fn().mockResolvedValue({ data: { portfolio: true }, error: null }) };
    createClient.mockResolvedValue(anonymousClient);
    enforceRateLimit.mockResolvedValueOnce(new Response(JSON.stringify({ code: "RATE_LIMITED" }), { status: 429 }));
    const response = await POST(request({
      action: "search", query: "Boston", countryCode: "US", sessionToken: crypto.randomUUID(), portfolioToken: "public-token",
    }));
    expect(response.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith(anonymousClient, expect.any(Request), "location_search");
    expect(searchLocationSuggestions).not.toHaveBeenCalled();
  });
});
