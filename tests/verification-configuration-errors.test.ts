import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { close, flush, init, wrapRouteHandlerWithSentry } from "@sentry/nextjs";
import type { Envelope, ErrorEvent } from "@sentry/core";

// A valid URL rejected by the actual Supabase constructor, before any network I/O.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "ftp://synthetic.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "PRIVATE_CONFIGURATION_SENTINEL";
});
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => undefined }) }));

import { sentryOptions } from "@/lib/observability/sentry.runtime.mjs";
import { POST as status, DELETE as withdraw } from "@/app/api/identity-verification/status/route";
import { POST as retry } from "@/app/api/identity-verification/retry/route";
import { AUTH_BODY_LIMIT } from "@/lib/api/request-security";
import { candidateVerificationConsentVersion } from "@/features/identity-verification/identity-verification.types";

const routes = [
  { action: "status", method: "POST", handler: status, path: "status" },
  { action: "withdraw", method: "DELETE", handler: withdraw, path: "status" },
  { action: "retry", method: "POST", handler: retry, path: "retry" },
] as const;
const sent: Envelope[] = [];
beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456");
  init({ ...sentryOptions(), transport: () => ({ send: async (envelope: Envelope) => { sent.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
});
beforeEach(() => { sent.length = 0; vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await close(2000); vi.unstubAllEnvs(); });

async function invoke(route: typeof routes[number], { origin = "http://local", token = "a".repeat(43), oversized = false } = {}) {
  const wrapped = wrapRouteHandlerWithSentry(route.handler, {
    method: route.method, parameterizedRoute: `/api/identity-verification/${route.path}`, headers: new Headers(),
  });
  const response = await wrapped(new Request(`http://local/api/identity-verification/${route.path}`, {
    method: route.method, headers: { Origin: origin, "Content-Type": "application/json" },
    body: oversized ? "x".repeat(AUTH_BODY_LIMIT + 1) : JSON.stringify({ token,
      ...(route.action === "retry" ? { consent: true, consentVersion: candidateVerificationConsentVersion } : {}),
    }),
  }));
  await flush(2000);
  const events: ErrorEvent[] = [];
  for (const [, items] of sent) for (const [header, payload] of items) if (header.type === "event") events.push(payload as ErrorEvent);
  return { response, events };
}

it.each(routes)("captures one safe internal configuration failure for $action", async route => {
  const { response, events } = await invoke(route);
  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toMatchObject({ code: "IDENTITY_VERIFICATION_REQUEST_FAILED" });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(events).toHaveLength(1);
  expect(events[0].tags).toMatchObject({
    "vivintro.operation": `verification.${route.action}`, "vivintro.code": "IDENTITY_VERIFICATION_REQUEST_FAILED",
    "vivintro.reference": response.headers.get("X-Request-Id"),
  });
  expect(JSON.stringify(sent)).not.toContain("synthetic.invalid");
  expect(JSON.stringify(sent)).not.toContain("PRIVATE_CONFIGURATION_SENTINEL");
});

for (const [name, options, expected] of [
  ["invalid token", { token: "invalid" }, 400],
  ["cross-site request", { origin: "https://other.test" }, 403],
  ["oversized body", { oversized: true }, 413],
] as const) {
  it.each(routes)(`preserves ${name} exclusion for $action`, async route => {
    const { response, events } = await invoke(route, options);
    expect(response.status).toBe(expected);
    expect(events).toHaveLength(0);
  });
}
