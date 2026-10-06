import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const limit = vi.hoisted(() => vi.fn());
const current = vi.hoisted(() => vi.fn());
const resume = vi.hoisted(() => vi.fn());
const cancel = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: limit }));
vi.mock("@/features/identity-verification/server/candidate-recovery.service", () => ({ getCurrentCandidateVerification: current, resumeCandidateVerification: resume, cancelCandidateVerification: cancel }));
import { GET } from "@/app/api/identity-verification/current/route";
import { POST as resumeRoute } from "@/app/api/identity-verification/resume/route";
import { POST as cancelRoute } from "@/app/api/identity-verification/cancel/route";
import { IdentityVerificationSessionError } from "@/features/identity-verification/server/session.service";
const id = "11111111-1111-4111-8111-111111111111";
const supabase = {};
function request(body: unknown, origin = "http://local") { return new Request("http://local/api/identity-verification/resume", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ status: "authenticated", supabase }); limit.mockResolvedValue(null); current.mockResolvedValue({ state: "active" }); resume.mockResolvedValue({ url: "https://verify.didit.me/session" }); cancel.mockResolvedValue({ state: "cleanup_pending" }); });
it("reads guarded status with no-store", async () => {
  const response = await GET(new Request(`http://local/api/identity-verification/current?candidateId=${id}`));
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); expect(current).toHaveBeenCalledWith(supabase, id);
});
it.each([resumeRoute, cancelRoute])("dispatches a strictly bounded owner mutation", async route => {
  expect((await route(request({ candidateId: id, attemptId: id }))).status).toBe(200);
  expect((await route(request({ candidateId: id, attemptId: id, extra: true }))).status).toBe(400);
  expect((await route(request({ candidateId: id, attemptId: id }, "https://evil.test"))).status).toBe(403);
});
it("rejects unauthenticated recovery before service calls", async () => {
  auth.mockResolvedValue({ status: "missing_session" });
  expect((await resumeRoute(request({ candidateId: id, attemptId: id }))).status).toBe(401); expect(resume).not.toHaveBeenCalled();
});
it("preserves recovery cooldown", async () => {
  limit.mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "30" } }));
  const response = await cancelRoute(request({ candidateId: id, attemptId: id }));
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30"); expect(cancel).not.toHaveBeenCalled();
});
it("returns actionable conflicts without private provider evidence", async () => {
  resume.mockRejectedValue(new IdentityVerificationSessionError("Refresh status", "IDENTITY_VERIFICATION_STATE_CONFLICT", 409));
  expect((await resumeRoute(request({ candidateId: id, attemptId: id }))).status).toBe(409);
});
it("rejects an invalid status query", async () => { expect((await GET(new Request("http://local/api/identity-verification/current?candidateId=invalid"))).status).toBe(400); });
