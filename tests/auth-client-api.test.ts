// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  continueToAuthProvider,
  startAuthentication,
  updateRecoveredPassword,
  verifyAuthenticationCode,
} from "../src/features/auth/client/auth.api";

afterEach(() => vi.unstubAllGlobals());

describe("auth client API", () => {
  it("posts authentication requests only to the same-origin gateway", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(startAuthentication({
      method: "password_signin",
      email: "reader@example.com",
      password: "Wedding2026",
      redirect: "/dashboard",
    })).resolves.toEqual({ ok: true, body: { authenticated: true } });
    expect(fetch).toHaveBeenCalledWith("/api/auth/start", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        method: "password_signin",
        email: "reader@example.com",
        password: "Wedding2026",
        redirect: "/dashboard",
      }),
    }));
  });

  it("handles a non-JSON gateway failure safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(startAuthentication({ method: "google", redirect: "/dashboard" }))
      .resolves.toEqual({ ok: false, body: null });
  });

  it("turns a network failure into a safe retryable response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network details")));
    await expect(startAuthentication({ method: "google", redirect: "/dashboard" }))
      .resolves.toEqual({
        ok: false,
        body: {
          code: "AUTH_NETWORK_ERROR",
          error: "We could not connect. Check your internet connection and try again.",
        },
      });
  });

  it("uses the dedicated same-origin gateways for verification and password recovery", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ verified: true }, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ updated: true }, { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(verifyAuthenticationCode({
      purpose: "owner_signup",
      email: "owner@example.test",
      token: "123456",
      redirect: "/dashboard",
    })).resolves.toEqual({ ok: true, body: { verified: true } });
    await expect(updateRecoveredPassword("ReplacementPassword1"))
      .resolves.toEqual({ ok: true, body: { updated: true } });

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/verify", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        purpose: "owner_signup",
        email: "owner@example.test",
        token: "123456",
        redirect: "/dashboard",
      }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/auth/password", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ password: "ReplacementPassword1" }),
    }));
  });

  it("continues only with the provider URL returned by the auth gateway caller", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    continueToAuthProvider("https://accounts.google.test/oauth");

    expect(assign).toHaveBeenCalledWith("https://accounts.google.test/oauth");
  });
});
