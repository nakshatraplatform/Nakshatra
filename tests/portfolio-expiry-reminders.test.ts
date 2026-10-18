import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail: send }));
import { processRelationshipNotifications } from "@/features/notifications/server/relationship-notification.service";

function fixture(kind = "full_view_expiring", prepare: string | { error: object } = "ready") {
  const job = { notification_ref: "ntf_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", recipient_user_id: "11111111-1111-4111-8111-111111111111",
    notification_type: kind, attempt_count: 1, interest_request_id: null,
    grant_id: "22222222-2222-4222-8222-222222222222",
    payload: { schemaVersion: 1, audience: kind === "full_view_expiring" ? "viewer" : "owner", expiresAt: "2026-10-19T03:00:00+00:00", portfolioId: "33333333-3333-4333-8333-333333333333" } };
  const rpc = vi.fn<(name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>>(async name => name === "claim_relationship_notification_outbox" ? { data: [job], error: null }
    : name === "prepare_full_view_expiry_email" ? typeof prepare === "string" ? { data: prepare, error: null } : { data: null, error: prepare.error }
      : { data: "sent", error: null });
  const client = { rpc, from: vi.fn(), auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "Viewer@Example.test" } }, error: null }) } } };
  return { client, job, rpc };
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vivintro.test");
  send.mockReset().mockResolvedValue({ status: "accepted", providerMessageId: "44444444-4444-4444-8444-444444444444" });
});
describe("personal portfolio expiry dispatch", () => {
  it.each(["full_view_expiring", "full_view_access_expiring"])("prepares current-state and content proof before sending %s", async kind => {
    const { client, rpc } = fixture(kind);
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(client.from).not.toHaveBeenCalled();
    const message = send.mock.calls[0][0];
    expect(message.text).toContain("October 19, 2026");
    expect(message.text).toContain("UTC");
    expect(rpc).toHaveBeenCalledWith("prepare_full_view_expiry_email", {
      p_notification_ref: "ntf_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", p_attempt_count: 1,
      p_recipient_email_hash: createHash("sha256").update("viewer@example.test").digest("hex"),
      p_message_digest: createHash("sha256").update(JSON.stringify({ to: message.to, subject: message.subject, text: message.text })).digest("hex"),
    });
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(send.mock.invocationCallOrder[0]);
  });
  it.each(["full_view_expiring", "full_view_access_expiring"])("does not send or report failure for an obsolete %s", async kind => {
    const { client, rpc } = fixture(kind, "skipped");
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("complete_relationship_notification_outbox", expect.anything());
  });
});

describe("expiry dispatch failures and stable retries", () => {
  it("persists a retryable preparation outage without calling the provider", async () => {
    const { client, rpc } = fixture("full_view_expiring", { error: { code: "NETWORK" } });
    rpc.mockImplementation(async (name: string) => name === "claim_relationship_notification_outbox" ? { data: [fixture().job], error: null }
      : name === "prepare_full_view_expiry_email" ? { data: null, error: { code: "NETWORK" } } : { data: "queued", error: null });
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({ p_error_code: "REMINDER_PREPARE_FAILED", p_retryable: true }));
  });
  it("does not complete someone else's lost lease", async () => {
    const { client, rpc } = fixture("full_view_expiring", "unavailable");
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("complete_relationship_notification_outbox", expect.anything());
  });
  it.each(["bad expiry", "wrong audience", "missing grant"])("rejects %s context before provider I/O", async mode => {
    const { client, job, rpc } = fixture();
    if (mode === "bad expiry") job.payload.expiresAt = "not a date";
    if (mode === "wrong audience") job.payload.audience = "owner";
    if (mode === "missing grant") Object.assign(job, { grant_id: null });
    rpc.mockImplementation(async (name: string) => name === "claim_relationship_notification_outbox" ? { data: [job], error: null } : { data: "failed", error: null });
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({ p_error_code: "REMINDER_CONTEXT_INVALID", p_retryable: false }));
  });
  it("fails closed for an invalid preparation response", async () => {
    const { client, rpc } = fixture("full_view_access_expiring", "unexpected");
    rpc.mockImplementation(async (name: string) => name === "claim_relationship_notification_outbox" ? { data: [fixture("full_view_access_expiring").job], error: null }
      : name === "prepare_full_view_expiry_email" ? { data: "unexpected", error: null } : { data: "queued", error: null });
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
  });
  it("keeps provider ID, recipient and rendered request stable between attempts", async () => {
    const { client, job, rpc } = fixture();
    send.mockResolvedValueOnce({ status: "failed", code: "EMAIL_TIMEOUT", retryable: true });
    let completion = "queued";
    rpc.mockImplementation(async (name: string) => name === "claim_relationship_notification_outbox" ? { data: [job], error: null }
      : name === "prepare_full_view_expiry_email" ? { data: "ready", error: null } : { data: completion, error: null });
    await processRelationshipNotifications(client as never);
    job.attempt_count = 2; completion = "sent";
    await processRelationshipNotifications(client as never);
    expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
    const digests = rpc.mock.calls.filter(([name]) => name === "prepare_full_view_expiry_email").map(call => call[1]);
    expect(digests).toEqual([expect.objectContaining({ p_attempt_count: 1 }), expect.objectContaining({ p_attempt_count: 2 })]);
  });
});
