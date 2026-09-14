import { describe, expect, it, vi } from "vitest";
import {
  loadPilotAccessState,
  listPilotAccessRequests,
  reviewPilotAccessRequest,
  submitPilotAccessRequest,
} from "../src/features/pilot-access/server/pilot-access.service";

describe("pilot access service", () => {
  it("parses the minimum current-account projection", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { canCreatePortfolio: false, isPilotAdministrator: false, application: null },
      error: null,
    });
    await expect(loadPilotAccessState({ rpc } as never)).resolves.toEqual({
      canCreatePortfolio: false,
      isPilotAdministrator: false,
      application: null,
    });
  });

  it("never sends an email or client-selected status to the database", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        requestRef: `par_${"a".repeat(32)}`,
        status: "pending",
        submittedAt: "2026-09-12T12:00:00Z",
        reviewedAt: null,
      },
      error: null,
    });
    await submitPilotAccessRequest({ rpc } as never, {
      displayName: "Pilot Applicant",
      phoneE164: null,
      contactConsentVersion: "launch_waitlist_v1",
      idempotencyKey: "pilot-submit:00000001",
    });
    expect(rpc).toHaveBeenCalledWith("submit_pilot_access_request", {
      p_display_name: "Pilot Applicant",
      p_phone_e164: null,
      p_contact_consent_version: "launch_waitlist_v1",
      p_idempotency_key: "pilot-submit:00000001",
    });
  });

  it("reports an unapplied migration without leaking database details", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function was not found" },
    });
    await expect(loadPilotAccessState({ rpc } as never)).rejects.toMatchObject({
      reason: "database_update_required",
      databaseCode: "PGRST202",
    });
  });

  it("classifies a database-enforced missing verified email", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "verified email required" },
    });
    await expect(loadPilotAccessState({ rpc } as never)).rejects.toMatchObject({
      reason: "verified_email_required",
      databaseCode: "42501",
    });
  });

  it("recognizes an already-entitled applicant without requiring an application row", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "already_creator" }, error: null });
    await expect(submitPilotAccessRequest({ rpc } as never, {
      displayName: "Existing Creator",
      phoneE164: null,
      contactConsentVersion: "launch_waitlist_v1",
      idempotencyKey: "pilot-submit:already01",
    })).resolves.toEqual({ status: "already_creator" });
  });

  it("fails closed for malformed administrator projections and decisions", async () => {
    const malformedList = { rpc: vi.fn().mockResolvedValue({ data: [{ request_ref: "unsafe" }], error: null }) };
    await expect(listPilotAccessRequests(malformedList as never, "all")).rejects.toMatchObject({ reason: "unavailable" });
    const malformedDecision = { rpc: vi.fn().mockResolvedValue({ data: { status: "approved" }, error: null }) };
    await expect(reviewPilotAccessRequest(malformedDecision as never, {
      requestRef: `par_${"f".repeat(32)}`,
      decision: "approve",
      reviewNote: null,
      idempotencyKey: "pilot-review:malformed1",
    })).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("maps private database row names for an authorized administrator", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        request_ref: `par_${"b".repeat(32)}`,
        display_name: "Aditi Rao",
        verified_email: "aditi@example.com",
        phone_e164: null,
        status: "pending",
        submitted_at: "2026-09-12T12:00:00Z",
        reviewed_at: null,
        review_note: null,
      }],
      error: null,
    });
    await expect(listPilotAccessRequests({ rpc } as never, "pending")).resolves.toEqual([
      expect.objectContaining({ displayName: "Aditi Rao", verifiedEmail: "aditi@example.com" }),
    ]);
    expect(rpc).toHaveBeenCalledWith("list_pilot_access_requests", { p_status: "pending", p_limit: 100 });
  });

  it("sends an idempotent administrator decision to the transactional function", async () => {
    const result = {
      requestRef: `par_${"c".repeat(32)}`,
      status: "approved",
      submittedAt: "2026-09-12T12:00:00Z",
      reviewedAt: "2026-09-12T13:00:00Z",
    };
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    await expect(reviewPilotAccessRequest({ rpc } as never, {
      requestRef: result.requestRef,
      decision: "approve",
      reviewNote: "Pilot cohort one",
      idempotencyKey: "pilot-review:00000001",
    })).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith("review_pilot_access_request", {
      p_request_ref: result.requestRef,
      p_decision: "approve",
      p_review_note: "Pilot cohort one",
      p_idempotency_key: "pilot-review:00000001",
    });
  });
});
