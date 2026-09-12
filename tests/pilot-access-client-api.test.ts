import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPilotAccessState,
  submitPilotAccess,
} from "../src/features/pilot-access/client/pilot-access.api";

afterEach(() => vi.unstubAllGlobals());

describe("pilot access client API", () => {
  it("distinguishes an unauthenticated state from an API failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: "AUTH_REQUIRED" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )));
    await expect(getPilotAccessState()).resolves.toMatchObject({
      ok: false,
      unauthenticated: true,
      state: null,
      failure: { code: "AUTH_REQUIRED" },
    });
  });

  it("returns state and sends a JSON submission", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        canCreatePortfolio: false,
        isPilotAdministrator: false,
        application: null,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getPilotAccessState()).ok).toBe(true);
    const command = {
      displayName: "Aditi Rao",
      phoneE164: null,
      contactConsentVersion: "pilot_access_v1" as const,
      idempotencyKey: "pilot-submit:00000001",
    };
    expect((await submitPilotAccess(command)).ok).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/pilot-access", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(command),
    }));
  });

  it("maps network failures to retryable copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await getPilotAccessState()).failure?.error).toMatch(/could not connect/i);
    expect((await submitPilotAccess({} as never)).failure?.error).toMatch(/could not connect/i);
  });
});
