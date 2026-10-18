import { afterEach, describe, expect, it, vi } from "vitest";
import { completeBrokerdeskMfa } from "@/features/organization-access/client/brokerdesk-mfa.api";
import { startBrokerdeskActionSecurity } from "@/features/organization-access/client/brokerdesk-reauth.api";

describe("BrokerDesk MFA client API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("completes MFA through the same-origin reauthentication endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ next: "/brokerdesk" }, { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(completeBrokerdeskMfa()).resolves.toEqual({ next: "/brokerdesk" });
    expect(fetch).toHaveBeenCalledWith("/api/v1/brokerdesk/reauth/complete", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it("returns the safe server error and falls back safely for malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      Response.json({ error: "The security check expired." }, { status: 401 })
    ));
    await expect(completeBrokerdeskMfa()).rejects.toThrow("The security check expired.");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })));
    await expect(completeBrokerdeskMfa()).rejects.toThrow(
      "We could not complete the security check. Please try again."
    );
  });
});

describe("BrokerDesk action security client API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts a purpose-bound same-origin check with an encoded workspace reference", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ sent: true }, { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(startBrokerdeskActionSecurity("wrk/fixture", "email", "team_invite"))
      .resolves.toEqual({ sent: true });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/brokerdesk/workspaces/wrk%2Ffixture/reauth/start",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "email", purpose: "team_invite" }),
      }
    );
  });

  it("uses the safe server message and fallback for failed starts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      Response.json({ error: "Recent authentication is required." }, { status: 401 })
    ));
    await expect(startBrokerdeskActionSecurity("wrk_fixture", "google", "team_suspend"))
      .rejects.toThrow("Recent authentication is required.");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })));
    await expect(startBrokerdeskActionSecurity("wrk_fixture", "google", "team_suspend"))
      .rejects.toThrow("The security check is temporarily unavailable.");
  });
});
