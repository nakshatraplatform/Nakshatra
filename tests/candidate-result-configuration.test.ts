import { afterEach, expect, it, vi } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
const admin = vi.hoisted(() => ({ rpc: vi.fn() }));
const current = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getApiUser: async () => ({
  status: "authenticated", supabase: {}, user: {
    id: "11111111-1111-4111-8111-111111111111",
    sessionId: "11111111-1111-4111-8111-111111111111",
  },
}) }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => admin }));
vi.mock("@/features/identity-verification/server/candidate-recovery.service", () => ({ getCurrentCandidateVerification: current }));
// Keep the actual worker factory: mocking it hid the configuration/lease ordering defect.
import { POST } from "@/app/api/identity-verification/check-result/route";

afterEach(() => vi.unstubAllEnvs());

it.each(["active", "awaiting_result"])("returns a safe 503 for %s without claiming work or contacting Didit when the API key is missing", async state => {
  vi.stubEnv("DIDIT_API_KEY", "");
  const fetchProvider = vi.spyOn(globalThis, "fetch");
  current.mockResolvedValue({ state, attemptId: id });
  admin.rpc.mockResolvedValue({ data: {
    subject_type: "candidate", verification_method: "candidate_liveness_only",
    candidate_id: id, attempt_id: id, task_type: "reconcile", claim_token: id,
    provider_session_ref: id, provider_workflow_id: id, provider_workflow_version: 1,
    provider_vendor_data: "iv:fixture:attempt", work_attempts: 1,
  }, error: null });
  const response = await POST(new Request("http://local/api/identity-verification/check-result", {
    method: "POST", headers: { Origin: "http://local", "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId: id, attemptId: id }),
  }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: "IDENTITY_VERIFICATION_RECOVERY_UNAVAILABLE" });
  expect(admin.rpc).not.toHaveBeenCalled();
  expect(fetchProvider).not.toHaveBeenCalled();
});
