import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiUser = vi.hoisted(() => vi.fn());
const enforceRateLimit = vi.hoisted(() => vi.fn());
const loadPilotAccessState = vi.hoisted(() => vi.fn());
const submitPilotAccessRequest = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/auth", () => ({ getApiUser }));
vi.mock("../src/features/security/server/rate-limit.service", () => ({ enforceRateLimit }));
vi.mock("../src/features/pilot-access/server/pilot-access.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/features/pilot-access/server/pilot-access.service")>();
  return { ...actual, loadPilotAccessState, submitPilotAccessRequest };
});

import { GET, POST } from "../src/app/api/pilot-access/route";
import { PilotAccessServiceError } from "../src/features/pilot-access/server/pilot-access.service";

const actor = {
  status: "authenticated",
  user: { id: "applicant", sessionId: "session" },
  supabase: {},
};
const command = {
  displayName: "Pilot Applicant",
  phoneE164: "+14155550100",
  contactConsentVersion: "launch_waitlist_v1",
  idempotencyKey: "pilot-submit:00000001",
};

function request(body: unknown, origin = "http://local") {
  return new Request("http://local/api/pilot-access", {
    method: "POST",
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": origin === "http://local" ? "same-origin" : "cross-site",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("pilot access route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiUser.mockResolvedValue(actor);
    enforceRateLimit.mockResolvedValue(null);
    loadPilotAccessState.mockResolvedValue({
      canCreatePortfolio: false,
      isPilotAdministrator: false,
      application: null,
    });
    submitPilotAccessRequest.mockResolvedValue({
      requestRef: `par_${"a".repeat(32)}`,
      status: "pending",
      submittedAt: "2026-09-12T12:00:00Z",
      reviewedAt: null,
    });
  });

  it("returns only the authenticated account's capability state", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(loadPilotAccessState).toHaveBeenCalledWith(actor.supabase);
  });

  it("rejects cross-site submissions before authentication", async () => {
    const response = await POST(request(command, "https://attacker.test"));
    expect(response.status).toBe(403);
    expect(getApiUser).not.toHaveBeenCalled();
    expect(submitPilotAccessRequest).not.toHaveBeenCalled();
  });

  it("requires a live authenticated session", async () => {
    getApiUser.mockResolvedValue({ status: "missing_session" });
    expect((await POST(request(command))).status).toBe(401);
    expect(submitPilotAccessRequest).not.toHaveBeenCalled();
  });

  it("rejects client-selected status and malformed phone values", async () => {
    const response = await POST(request({ ...command, phoneE164: "555-0100", status: "approved" }));
    expect(response.status).toBe(400);
    expect(submitPilotAccessRequest).not.toHaveBeenCalled();
  });

  it("rate limits and submits the validated command", async () => {
    const response = await POST(request(command));
    expect(response.status).toBe(201);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      actor.supabase,
      expect.any(Request),
      "pilot_access_submit"
    );
    expect(submitPilotAccessRequest).toHaveBeenCalledWith(actor.supabase, command);
  });

  it("fails closed when the database migration is absent", async () => {
    submitPilotAccessRequest.mockRejectedValue(
      new PilotAccessServiceError("database_update_required", "PGRST202")
    );
    const response = await POST(request(command));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "PILOT_DATABASE_UPDATE_REQUIRED",
    });
  });

  it("requires the database-confirmed email instead of a submitted email", async () => {
    const response = await POST(request({ ...command, email: "spoofed@example.com" }));
    expect(response.status).toBe(400);
    expect(submitPilotAccessRequest).not.toHaveBeenCalled();
  });
});
