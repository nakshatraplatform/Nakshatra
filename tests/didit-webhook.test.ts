import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const repositoryRecord = vi.hoisted(() => vi.fn());
const createServiceRoleClient = vi.hoisted(() => vi.fn(() => ({ rpc: vi.fn() })));

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));
vi.mock("@/features/identity-verification/server/webhook.repository", () => ({
  IdentityVerificationWebhookRepository: class {
    record(event: unknown) {
      return repositoryRecord(event);
    }
  },
}));

import { POST } from "@/app/api/webhooks/didit/route";
import { verifyDiditWebhook } from "@/features/identity-verification/server/didit.webhook";

const now = new Date("2026-09-02T14:20:00.000Z");
const timestamp = String(Math.floor(now.getTime() / 1000));
const config = {
  applicationId: "11111111-1111-4111-8111-111111111111",
  workflowId: "22222222-2222-4222-8222-222222222222",
  webhookSecret: "test-webhook-secret",
};
const envelope = {
  application_id: config.applicationId,
  environment: "sandbox",
  event_id: "33333333-3333-4333-8333-333333333333",
  session_id: "44444444-4444-4444-8444-444444444444",
  status: "Approved",
  timestamp: Number(timestamp),
  vendor_data: "iv:55555555-5555-4555-8555-555555555555:66666666-6666-4666-8666-666666666666",
  webhook_type: "status.updated",
  workflow_id: config.workflowId,
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

function signedRequest(body: Record<string, unknown> = envelope, signature = true, requestTimestamp = timestamp) {
  const rawBody = JSON.stringify({ z: "Å", ...body });
  const canonical = JSON.stringify(canonicalize(JSON.parse(rawBody)));
  const headers = new Headers({ "Content-Type": "application/json", "X-Timestamp": requestTimestamp });
  if (signature) {
    headers.set("X-Signature-V2", createHmac("sha256", config.webhookSecret).update(canonical).digest("hex"));
  }
  return new Request("https://nakshatra.test/api/webhooks/didit", { method: "POST", headers, body: rawBody });
}

describe("Didit webhook verification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function configure() {
    vi.stubEnv("DIDIT_APPLICATION_ID", undefined);
    vi.stubEnv("DIDIT_ENVIRONMENT", undefined);
    vi.stubEnv("DIDIT_WEBHOOK_SECRET", config.webhookSecret);
    vi.stubEnv("DIDIT_WORKFLOW_ID", config.workflowId);
  }

  it("accepts only a current canonical V2 signature and returns safe persistence inputs", () => {
    configure();
    const request = signedRequest();
    const result = verifyDiditWebhook({
      rawBody: JSON.stringify({ z: "Å", ...envelope }),
      signature: request.headers.get("X-Signature-V2"),
      timestamp,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      attemptId: "66666666-6666-4666-8666-666666666666",
      providerSubjectRef: "55555555-5555-4555-8555-555555555555",
      providerSessionRef: envelope.session_id,
    }));
    expect(result.eventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.payloadDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects stale, unsigned, malformed, and wrong-workflow envelopes", () => {
    configure();
    const valid = signedRequest();
    expect(() => verifyDiditWebhook({ rawBody: JSON.stringify({ z: "Å", ...envelope }), signature: valid.headers.get("X-Signature-V2"), timestamp: "invalid", now }))
      .toThrow("DIDIT_WEBHOOK_UNAUTHORIZED");
    expect(() => verifyDiditWebhook({ rawBody: JSON.stringify(envelope), signature: null, timestamp, now }))
      .toThrow("DIDIT_WEBHOOK_UNAUTHORIZED");
    expect(() => verifyDiditWebhook({ rawBody: "{", signature: "a".repeat(64), timestamp, now }))
      .toThrow("DIDIT_WEBHOOK_INVALID");

    const wrongWorkflow = { ...envelope, workflow_id: "77777777-7777-4777-8777-777777777777" };
    const wrongRequest = signedRequest(wrongWorkflow);
    expect(() => verifyDiditWebhook({ rawBody: JSON.stringify({ z: "Å", ...wrongWorkflow }), signature: wrongRequest.headers.get("X-Signature-V2"), timestamp, now }))
      .toThrow("DIDIT_WEBHOOK_UNAUTHORIZED");

    const mismatchedTimestamp = { ...envelope, timestamp: Number(timestamp) - 301 };
    const mismatchedRequest = signedRequest(mismatchedTimestamp);
    expect(() => verifyDiditWebhook({ rawBody: JSON.stringify({ z: "Å", ...mismatchedTimestamp }), signature: mismatchedRequest.headers.get("X-Signature-V2"), timestamp, now }))
      .toThrow("DIDIT_WEBHOOK_UNAUTHORIZED");
  });

  function verify(body: Record<string, unknown>) {
    const request = signedRequest(body, true, String(body.timestamp));
    return verifyDiditWebhook({
      rawBody: JSON.stringify({ z: "Å", ...body }),
      signature: request.headers.get("X-Signature-V2"),
      timestamp: String(body.timestamp),
      now,
    });
  }

  function consoleEnvelope(): Record<string, unknown> {
    const body: Record<string, unknown> = { ...envelope, created_at: Number(timestamp) - 10 };
    delete body.application_id;
    delete body.environment;
    delete body.event_id;
    return body;
  }

  it("accepts the Console payload shape without application, environment, or event IDs", () => {
    configure();
    expect(verify(consoleEnvelope())).toEqual(expect.objectContaining({
      attemptId: "66666666-6666-4666-8666-666666666666",
      providerSessionRef: envelope.session_id,
      eventHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it("deduplicates deliveries with refreshed timestamps when an event ID is supplied", () => {
    configure();
    expect(verify(envelope).eventHash).toBe("f6222a1106eefe4f6b25302a9d963cfaba14bedfefacc2c311967e41c61cffe4");
    expect(verify(envelope).eventHash).toBe(verify({ ...envelope, timestamp: Number(timestamp) + 60 }).eventHash);
    expect(verify(envelope).eventHash).not.toBe(verify({ ...envelope, event_id: "77777777-7777-4777-8777-777777777777" }).eventHash);
  });

  it("deduplicates event-ID-free retries regardless of key order and dispatch time", () => {
    configure();
    const body = consoleEnvelope();
    const reordered = Object.fromEntries(Object.entries(body).reverse());
    expect(verify(body).eventHash).toBe(verify({ ...reordered, timestamp: Number(timestamp) + 60 }).eventHash);
    expect(verify(body).payloadDigest).not.toBe(verify({ ...reordered, timestamp: Number(timestamp) + 60 }).payloadDigest);
  });

  it("keeps distinct session changes and corrected decisions separate without event IDs", () => {
    configure();
    const body = consoleEnvelope();
    for (const change of [
      { status: "Declined" },
      { webhook_type: "data.updated" },
      { created_at: Number(timestamp) - 5 },
      { session_id: "77777777-7777-4777-8777-777777777777" },
      { decision: { status: "Approved", id_verifications: [{ first_name: "Corrected" }] } },
    ]) {
      expect(verify(body).eventHash).not.toBe(verify({ ...body, ...change }).eventHash);
    }
  });

  it("rejects tampered bodies and signatures from another destination before persistence", async () => {
    configure();
    const body = consoleEnvelope();
    const request = signedRequest(body);
    expect(() => verifyDiditWebhook({
      rawBody: JSON.stringify({ z: "Å", ...body, status: "Declined" }),
      signature: request.headers.get("X-Signature-V2"), timestamp, now,
    })).toThrow("DIDIT_WEBHOOK_UNAUTHORIZED");
    vi.stubEnv("DIDIT_WEBHOOK_SECRET", "another-destination-secret");
    const currentTimestamp = String(Math.floor(Date.now() / 1000));
    const response = await POST(signedRequest({ ...body, timestamp: Number(currentTimestamp) }, true, currentTimestamp));
    expect(response.status).toBe(401);
    expect(repositoryRecord).not.toHaveBeenCalled();
  });

  it.each([
    { vendor_data: "your-vendor-reference-id" },
    { session_id: "invalid" },
    { event_id: "invalid" },
    { webhook_type: "transaction.created" },
    { timestamp: Number(timestamp) + 301 },
  ])("rejects invalid session envelopes: %j", (change) => {
    configure();
    expect(() => verify({ ...consoleEnvelope(), ...change })).toThrow();
  });

  it.each(["DIDIT_WEBHOOK_SECRET", "DIDIT_WORKFLOW_ID"])("requires %s", (key) => {
    configure();
    vi.stubEnv(key, undefined);
    expect(() => verify(consoleEnvelope())).toThrow("DIDIT_WEBHOOK_UNAUTHORIZED");
  });

  it("acknowledges a Console-shaped event only after storing safe receipt inputs", async () => {
    configure();
    repositoryRecord.mockResolvedValue({ data: true, error: null });
    const currentTimestamp = String(Math.floor(Date.now() / 1000));
    const body = { ...consoleEnvelope(), timestamp: Number(currentTimestamp), decision: { private_evidence: "not-for-storage" } };
    const response = await POST(signedRequest(body, true, currentTimestamp));
    expect(response.status).toBe(202);
    expect(Object.keys(repositoryRecord.mock.calls[0][0]).sort()).toEqual([
      "attemptId", "eventHash", "payloadDigest", "providerSessionRef", "providerSubjectRef",
    ]);
    expect(JSON.stringify(repositoryRecord.mock.calls)).not.toContain("not-for-storage");
  });

  it.each([
    { data: null, error: { message: "storage unavailable" } },
    { data: null, error: null },
  ])("does not acknowledge unsuccessful persistence: %j", async (result) => {
    configure();
    repositoryRecord.mockResolvedValueOnce(result);
    const currentTimestamp = String(Math.floor(Date.now() / 1000));
    const response = await POST(signedRequest({ ...consoleEnvelope(), timestamp: Number(currentTimestamp) }, true, currentTimestamp));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ code: "DIDIT_WEBHOOK_UNAVAILABLE" });
  });

  it("acknowledges only after the private event receipt succeeds and never returns provider data", async () => {
    configure();
    repositoryRecord.mockResolvedValue({ data: true, error: null });
    const currentTimestamp = String(Math.floor(Date.now() / 1000));
    const currentEnvelope = { ...envelope, timestamp: Number(currentTimestamp) };
    const response = await POST(signedRequest(currentEnvelope, true, currentTimestamp));

    expect(repositoryRecord).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: "66666666-6666-4666-8666-666666666666",
      providerSessionRef: envelope.session_id,
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    repositoryRecord.mockResolvedValueOnce({ data: false, error: null });
    expect((await POST(signedRequest(currentEnvelope, true, currentTimestamp))).status).toBe(202);
    expect((await POST(signedRequest(currentEnvelope, false, currentTimestamp))).status).toBe(401);
  });
});
