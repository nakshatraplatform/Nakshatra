import { afterEach, expect, it, vi } from "vitest";
import { verificationResponse } from "@/features/identity-verification/server/verification-diagnostics";
afterEach(() => vi.restoreAllMocks());
it("correlates safe error classes without logging the body, URL or identifiers", async () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const response = await verificationResponse("resume", async () => Response.json({ code: "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID", error: "private provider payload", managementUrl: "private capability" }, { status: 503 }));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const reference = response.headers.get("X-Request-Id");
  expect(reference).toMatch(/^[0-9a-f-]{36}$/);
  expect(log).toHaveBeenCalledWith("identity_verification_request_failed", { operation: "resume", code: "IDENTITY_VERIFICATION_PROVIDER_CONTRACT_INVALID", status: 503, reference });
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});
it("sanitizes unexpected errors and unknown codes", async () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const response = await verificationResponse("start", async () => { throw new Error("sensitive upstream details"); });
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  await verificationResponse("cancel", async () => Response.json({ code: "secret-shaped-message" }, { status: 400 }));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/sensitive|secret-shaped/);
});
it("leaves successes and Retry-After intact", async () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const success = await verificationResponse("current", async () => Response.json({ state: "active" }));
  expect(await success.json()).toEqual({ state: "active" }); expect(log).not.toHaveBeenCalled();
  const limited = await verificationResponse("start", async () => Response.json({ code: "RATE_LIMIT_EXCEEDED" }, { status: 429, headers: { "Retry-After": "30" } }));
  expect(limited.headers.get("Retry-After")).toBe("30");
});
