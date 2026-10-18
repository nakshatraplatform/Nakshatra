import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveGooglePlace, searchLocationSuggestions } from "../src/features/location/server/location-provider.service";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_PLACES_API_KEY;
});

describe("location provider normalization", () => {
  it("returns no paid-provider suggestions when Google is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchLocationSuggestions({ query: "Boston", countryCode: "US", sessionToken: crypto.randomUUID() })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Zippopotam for a five-digit US ZIP without retaining coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      "post code": "02108",
      country: "United States",
      "country abbreviation": "US",
      places: [{
        "place name": "Boston",
        state: "Massachusetts",
        "state abbreviation": "MA",
        latitude: "42.357",
        longitude: "-71.064",
      }],
    })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchLocationSuggestions({ query: "02108", countryCode: "US", sessionToken: crypto.randomUUID() });

    expect(result).toEqual([{
      id: "zippopotam:02108:0",
      label: "Boston, Massachusetts 02108",
      provider: "zippopotam",
      country: "United States",
      countryCode: "US",
      state: "Massachusetts",
      subdivisionCode: "US-MA",
      city: "Boston",
      postalCode: "02108",
      locationSource: "zippopotam",
    }]);
    expect(result[0]).not.toHaveProperty("latitude");
    expect(result[0]).not.toHaveProperty("longitude");
    expect(fetchMock).toHaveBeenCalledWith("https://api.zippopotam.us/us/02108", expect.any(Object));
  });

  it("normalizes ZIP+4 to the five-digit matching boundary before Zippopotam lookup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      "post code": "02108",
      country: "United States",
      "country abbreviation": "US",
      places: [{ "place name": "Boston", state: "Massachusetts", "state abbreviation": "MA" }],
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchLocationSuggestions({ query: "02108-1234", countryCode: "US", sessionToken: crypto.randomUUID() }))
      .resolves.toEqual([expect.objectContaining({ postalCode: "02108", locationSource: "zippopotam" })]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.zippopotam.us/us/02108", expect.any(Object));
  });

  it("preserves multiple Zippopotam places and rejects mismatched provider data", async () => {
    const validResponse = {
      "post code": "10001",
      country: "United States",
      "country abbreviation": "US",
      places: [
        { "place name": "New York", state: "New York", "state abbreviation": "NY" },
        { "place name": "Manhattan", state: "New York", "state abbreviation": "NY" },
      ],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validResponse)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...validResponse, "post code": "10002" })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchLocationSuggestions({ query: "10001", countryCode: "US", sessionToken: crypto.randomUUID() }))
      .resolves.toEqual([
        expect.objectContaining({ city: "New York", subdivisionCode: "US-NY" }),
        expect.objectContaining({ city: "Manhattan", subdivisionCode: "US-NY" }),
      ]);
    await expect(searchLocationSuggestions({ query: "10001", countryCode: "US", sessionToken: crypto.randomUUID() }))
      .resolves.toEqual([]);
  });

  it("uses PostalPincode for a six-digit Indian PIN and normalizes ISO subdivision codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      Status: "Success",
      PostOffice: [{ Name: "Bangalore G.P.O.", District: "Bangalore", Block: "Bangalore North", State: "Karnataka", Country: "India", Pincode: "560001" }],
    }])));
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchLocationSuggestions({ query: "560001", countryCode: "IN", sessionToken: crypto.randomUUID() });
    expect(result[0]).toMatchObject({
      countryCode: "IN",
      subdivisionCode: "IN-KA",
      city: "Bangalore",
      postalCode: "560001",
      locationSource: "postalpincode",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.postalpincode.in/pincode/560001", expect.any(Object));
  });

  it("restricts Google autocomplete to supported countries and resolves address components without coordinates", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ suggestions: [{ placePrediction: { placeId: "place_123", text: { text: "Boston, MA, USA" } } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ addressComponents: [
        { longText: "United States", shortText: "US", types: ["country"] },
        { longText: "Massachusetts", shortText: "MA", types: ["administrative_area_level_1"] },
        { longText: "Boston", shortText: "Boston", types: ["locality"] },
        { longText: "02108", shortText: "02108", types: ["postal_code"] },
      ] })));
    vi.stubGlobal("fetch", fetchMock);
    const token = crypto.randomUUID();
    await expect(searchLocationSuggestions({ query: "Boston", countryCode: "US", sessionToken: token })).resolves.toEqual([
      expect.objectContaining({ id: "place_123", provider: "google_places", requiresResolution: true }),
    ]);
    await expect(resolveGooglePlace("place_123", token)).resolves.toEqual({
      country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA",
      city: "Boston", postalCode: "02108", locationSource: "google_places",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ includedRegionCodes: ["us"], includedPrimaryTypes: ["(regions)"] });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ "X-Goog-FieldMask": "addressComponents" });
  });

  it("normalizes Indian Google places to the same district boundary as PostalPincode", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ addressComponents: [
      { longText: "Yelahanka", shortText: "Yelahanka", types: ["locality"] },
      { longText: "Bangalore", shortText: "Bangalore", types: ["administrative_area_level_2"] },
      { longText: "Karnataka", shortText: "KA", types: ["administrative_area_level_1"] },
      { longText: "India", shortText: "IN", types: ["country"] },
      { longText: "560092", shortText: "560092", types: ["postal_code"] },
    ] }))));

    await expect(resolveGooglePlace("place_india", crypto.randomUUID())).resolves.toMatchObject({
      countryCode: "IN",
      subdivisionCode: "IN-KA",
      city: "Bangalore",
      postalCode: "560092",
    });
  });

  it("rejects oversized upstream responses before parsing them", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {
      headers: { "Content-Length": String(256 * 1024) },
    })));
    await expect(resolveGooglePlace("place_123", crypto.randomUUID())).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("falls back to Google when a postal provider fails and skips incomplete predictions", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-key";
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("postal provider offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ suggestions: [
        {},
        { placePrediction: { placeId: "place_123", text: { text: "Bangalore, Karnataka" } } },
      ] })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchLocationSuggestions({ query: "560001", countryCode: "IN", sessionToken: crypto.randomUUID() }))
      .resolves.toEqual([{ id: "place_123", label: "Bangalore, Karnataka", provider: "google_places", requiresResolution: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps ambiguous Indian localities distinct and falls back from an absent district", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      Status: "Success", PostOffice: [
        { Name: "First Office", District: "NA", Block: "North Block", State: "Karnataka", Pincode: "560001" },
        { Name: "Second Office", District: null, Block: "NA", State: "Unknown State", Pincode: "560001" },
      ],
    }]))));
    await expect(searchLocationSuggestions({ query: "560001", sessionToken: crypto.randomUUID() }))
      .resolves.toEqual([
        expect.objectContaining({ city: "North Block", subdivisionCode: "IN-KA" }),
        expect.objectContaining({ city: "Second Office", state: "Unknown State", subdivisionCode: undefined }),
      ]);
  });

  it("returns manual fallback for empty or malformed postal responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ Status: "Error", PostOffice: null }])))
      .mockResolvedValueOnce(new Response("not json"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ unexpected: true })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchLocationSuggestions({ query: "560001", countryCode: "IN", sessionToken: crypto.randomUUID() })).resolves.toEqual([]);
    await expect(searchLocationSuggestions({ query: "560001", countryCode: "IN", sessionToken: crypto.randomUUID() })).resolves.toEqual([]);
    await expect(searchLocationSuggestions({ query: "02108", countryCode: "US", sessionToken: crypto.randomUUID() })).resolves.toEqual([]);
  });

  it("rejects missing and streamed oversized provider bodies", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null))
      .mockResolvedValueOnce(new Response("x".repeat(128 * 1024 + 1)));
    vi.stubGlobal("fetch", fetchMock);
    await expect(resolveGooglePlace("missing_body", crypto.randomUUID())).rejects.toMatchObject({ reason: "unavailable" });
    await expect(resolveGooglePlace("large_body", crypto.randomUUID())).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("rejects unsupported and incomplete Google place resolutions", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "server-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ addressComponents: [
        { longText: "Canada", shortText: "CA", types: ["country"] },
      ] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ addressComponents: [
        { longText: "United States", shortText: "US", types: ["country"] },
        { longText: "Massachusetts", shortText: "MA", types: ["administrative_area_level_1"] },
      ] })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(resolveGooglePlace("unsupported", crypto.randomUUID())).rejects.toMatchObject({ reason: "invalid" });
    await expect(resolveGooglePlace("no_city", crypto.randomUUID())).rejects.toMatchObject({ reason: "invalid" });
  });

  it("preserves a provider state label when no ISO subdivision can be mapped", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      "post code": "02108", country: "United States", "country abbreviation": "US",
      places: [{ "place name": "Boston", state: "Unknown State", "state abbreviation": "ZZ" }],
    }))));
    await expect(searchLocationSuggestions({ query: "02108", countryCode: "US", sessionToken: crypto.randomUUID() }))
      .resolves.toEqual([expect.objectContaining({ state: "Unknown State", subdivisionCode: undefined })]);
  });
});
