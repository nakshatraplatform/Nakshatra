import { afterEach, describe, expect, it, vi } from "vitest";
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));
import {
  cancelAccountDeletionRequest,
  clearLocalAccountSession,
  downloadAccountExportRequest,
  requestAccountDeletionRequest,
  revokeOtherSessionsRequest,
  saveAccountProfileRequest,
  startAccountDeletionReauthRequest,
} from "../src/features/account/client/account.api";

afterEach(() => vi.unstubAllGlobals());

describe("account browser API", () => {
  it("clears the local Supabase credentials after account deletion", async () => {
    signOut.mockResolvedValue({ error: null });
    await clearLocalAccountSession();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("returns an export blob and uses explicit methods", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await downloadAccountExportRequest();
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/account/export", { method: "GET" });
  });

  it("maps server and network failures without exposing internals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: "ACCOUNT_EXPORT_FAILED", error: "Export unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )));
    await expect(downloadAccountExportRequest()).resolves.toMatchObject({
      ok: false,
      code: "ACCOUNT_EXPORT_FAILED",
      message: "Export unavailable",
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private network detail")));
    await expect(revokeOtherSessionsRequest()).resolves.toMatchObject({
      ok: false,
      code: "NETWORK_UNAVAILABLE",
    });
  });

  it("calls the deletion and session endpoints with the expected verbs", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetch);

    await revokeOtherSessionsRequest();
    await requestAccountDeletionRequest();
    await cancelAccountDeletionRequest();
    expect(fetch.mock.calls).toEqual([
      ["/api/account/sessions", { method: "DELETE" }],
      ["/api/account/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      }],
      ["/api/account/deletion", { method: "DELETE" }],
    ]);
  });

  it("validates the saved account profile returned by the server", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        firstName: "Aditi",
        middleName: "",
        lastName: "Rao",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ firstName: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetch);

    const profile = { firstName: "Aditi", middleName: "", lastName: "Rao" };
    await expect(saveAccountProfileRequest(profile)).resolves.toEqual({ ok: true, data: profile });
    await expect(saveAccountProfileRequest(profile)).resolves.toMatchObject({
      ok: false,
      code: "PROFILE_RESPONSE_INVALID",
      status: 502,
    });
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
  });

  it("starts deletion reauthentication with only the selected method", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetch);

    await expect(startAccountDeletionReauthRequest("email")).resolves.toEqual({
      ok: true,
      data: { sent: true },
    });
    expect(fetch).toHaveBeenCalledWith("/api/account/reauth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "email" }),
    });
  });

  it("uses neutral fallbacks when account endpoints return malformed bodies", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("not json", { status: 503 }))
      .mockResolvedValueOnce(new Response("not json", { status: 503 })));

    await expect(revokeOtherSessionsRequest()).resolves.toEqual({
      ok: false,
      code: "ACCOUNT_REQUEST_FAILED",
      message: "We could not complete that account action.",
      status: 503,
    });
    await expect(downloadAccountExportRequest()).resolves.toEqual({
      ok: false,
      code: "ACCOUNT_EXPORT_FAILED",
      message: "We could not prepare your account export.",
      status: 503,
    });
  });
});
