import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), mail: vi.fn(), admin: vi.fn(), network: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: mocks.admin }));
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail: mocks.mail }));
vi.mock("@/features/security/server/rate-limit.service", () => ({ anonymousSubjectHash: mocks.network }));

import { POST } from "@/app/api/interest/guest/route";

const challengeId = "11111111-1111-4111-8111-111111111111";
const location = { country: "United States", state: "Massachusetts", city: "Boston", countryCode: "US",
  subdivisionCode: "US-MA", postalCode: "02108", locationSource: "manual" };
const details = { portfolioToken: "guest-portfolio", name: "Mira Rao", profileFor: "self", phone: "+1 617 555 0199",
  email: "Mira@example.test", familyContext: "Our family values kindness, honesty and mutual respect.",
  message: "I enjoyed your introduction and would like to learn more about your family, interests and plans for the future.",
  ...location, location, useExistingProfile: false };
function request(body: unknown, origin = "https://vivintro.test") {
  return new Request(`${origin}/api/interest/guest`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GUEST_INTEREST_OTP_SECRET", "synthetic-guest-interest-key-32-characters-long");
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.network.mockResolvedValue("c".repeat(64));
  mocks.rpc.mockResolvedValue({ data: challengeId, error: null });
  mocks.mail.mockResolvedValue({ status: "accepted" });
});

describe("accountless interest verification route", () => {
  it("starts a service-only challenge and sends a code without touching Auth", async () => {
    const response = await POST(request({ action: "start", details }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true, challengeId });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("begin_guest_interest_verification", expect.objectContaining({
      p_details: expect.objectContaining({ email: "Mira@example.test", profileFor: "self" }),
      p_code_digest: expect.stringMatching(/^[a-f0-9]{64}$/), p_email_subject_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_network_subject_hash: "c".repeat(64),
    }));
    expect(mocks.mail).toHaveBeenCalledWith(expect.objectContaining({ to: "mira@example.test", deliveryId: challengeId,
      text: expect.stringContaining("does not sign you in or create an account") }));
    expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain("admin_create_user");
  });

  it("rejects malformed details before issuing a code", async () => {
    const response = await POST(request({ action: "start", details: { ...details, phone: "abc" } }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.mail).not.toHaveBeenCalled();
  });

  it("cancels a challenge if email delivery fails", async () => {
    mocks.mail.mockResolvedValue({ status: "failed", code: "EMAIL_NOT_CONFIGURED", retryable: true });
    const response = await POST(request({ action: "start", details }));
    expect(response.status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_guest_interest_verification", { p_id: challengeId });
  });

  it("finishes only after the database accepts the code", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "submitted", shareToken: "guest-portfolio" }, error: null });
    const response = await POST(request({ action: "complete", challengeId, email: "Mira@example.test", code: "123456" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ submitted: true });
    expect(mocks.rpc).toHaveBeenCalledWith("complete_guest_interest_and_remember", expect.objectContaining({
      p_id: challengeId, p_network_subject_hash: "c".repeat(64), p_code_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_proof_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Path=/p/guest-portfolio");
    expect(response.headers.get("set-cookie")).not.toContain("sb-");
    expect(mocks.mail).not.toHaveBeenCalled();
  });

  it.each([["invalid_code", 400], ["expired", 410], ["existing_request", 409], ["unavailable", 404], ["rate_limited", 429]] as const)(
    "maps %s to a bounded client response", async (outcome, status) => {
      mocks.rpc.mockResolvedValue({ data: { status: outcome }, error: null });
      const response = await POST(request({ action: "complete", challengeId, email: "mira@example.test", code: "123456" }));
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain("stack");
    },
  );

  it("rejects cross-origin requests before any database call", async () => {
    const response = await POST(new Request("https://vivintro.test/api/interest/guest", { method: "POST", headers: {
      Origin: "https://attacker.test", "Content-Type": "application/json",
    }, body: JSON.stringify({ action: "start", details }) }));
    expect(response.status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
