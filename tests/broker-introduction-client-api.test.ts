import { afterEach, describe, expect, it, vi } from "vitest";
import { createIntroduction, flagPortfolioUpdate, markIntroductionShared, revokeIntroduction } from "@/features/broker-introductions/client/broker-introduction.api";

describe("broker introduction client API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends bounded commands to relationship-scoped endpoints", async () => {
    const fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      void url; void init;
      return new Response(JSON.stringify({ available: true, status: "shared", rowVersion: 2 }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetch);
    await markIntroductionShared("wrk_a", "bir_b", 1);
    await revokeIntroduction("wrk_a", "bir_b", 2);
    await flagPortfolioUpdate("wrk_a", "bcr_c", "bpn_d");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toContain("/introductions/bir_b/shared");
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });

  it("creates and surfaces neutral API errors", async () => {
    const result = { introductionRef: `bir_${"a".repeat(32)}`, introductionUrl: "https://app.test/introduction#pass=x", sourceName: "Arun", recipientLabel: "Priya", recipientEmailHint: null, expiresAt: "2026-10-01", versionNumber: 1, rowVersion: 1, status: "created" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(result), { status: 201, headers: { "Content-Type": "application/json" } })));
    await expect(createIntroduction("wrk_a", { relationshipRef: "bcr_b", recipientLabel: "Priya", idempotencyKey: "key" })).resolves.toEqual(result);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    await expect(createIntroduction("wrk_a", { relationshipRef: "bcr_b", recipientLabel: "Priya", idempotencyKey: "key" })).rejects.toThrow("Unavailable");
  });
});
