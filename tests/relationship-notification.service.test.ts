import { beforeEach, describe, expect, it, vi } from "vitest";

const sendResendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail }));

import { processRelationshipNotifications } from "@/features/notifications/server/relationship-notification.service";

describe("relationship notification delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vivintro.test");
    sendResendEmail.mockResolvedValue({ status: "accepted", providerMessageId: "11111111-1111-4111-8111-111111111111" });
  });

  it("sends an identity-bound Complete Portfolio link and completes the outbox job", async () => {
    const grantId = "22222222-2222-4222-8222-222222222222";
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_33333333333343338333333333333333",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: "full_view_approved",
        attempt_count: 1,
        interest_request_id: "55555555-5555-4555-8555-555555555555",
        grant_id: grantId,
        payload: {},
      }], error: null })
      .mockResolvedValueOnce({ data: "sent", error: null });
    const rows = {
      reveal_grants: { data: { id: grantId, expires_at: "2026-10-05T12:00:00.000Z", portfolio_id: "66666666-6666-4666-8666-666666666666", revoked_at: null }, error: null },
      portfolios: { data: { draft_data: { personal: { name: "Aditi Rao" } } }, error: null },
    };
    const from = vi.fn((table: keyof typeof rows) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn().mockResolvedValue(rows[table]),
      };
      return chain;
    });
    const client = {
      rpc,
      from,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "viewer@example.com" } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(sendResendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "viewer@example.com",
      subject: "You can now view the Complete Portfolio",
      text: expect.stringContaining(`https://vivintro.test/access/${grantId}`),
    }));
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({
      p_attempt_count: 1,
      p_succeeded: true,
      p_retryable: false,
    }));
  });

  it("does nothing when no relationship notifications are due", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(sendResendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["new_introduction", "A new verified introduction is waiting", "/dashboard"],
    ["introduction_declined", "Update on your VivIntro introduction", "not sharing"],
    ["full_view_revoked", "Your Complete Portfolio access has ended", "no longer open"],
    ["full_view_access_expiring", "Complete Portfolio access expires soon", "/dashboard"],
  ])("renders %s without loading an access grant", async (notificationType, subject, copy) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: notificationType,
        attempt_count: 1,
        interest_request_id: null,
        grant_id: null,
        payload: {},
      }], error: null })
      .mockResolvedValueOnce({ data: "sent", error: null });
    const from = vi.fn();
    const client = {
      rpc,
      from,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: " Viewer@Example.com " } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(from).not.toHaveBeenCalled();
    expect(sendResendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "viewer@example.com",
      subject,
      text: expect.stringContaining(copy),
    }));
  });

  it.each([
    ["broker_introduction_ready", "A broker introduction is ready", "/introductions/bir_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["broker_mutual_interest", "Mutual interest is confirmed", "30 days"],
    ["broker_introduction_revoked", "A broker introduction has ended", "no longer available"],
    ["broker_introduction_expired", "A broker introduction has closed", "response window has ended"],
    ["broker_complete_access_expired", "Complete Portfolio access has ended", "Protected Contact is no longer available"],
  ])("renders safe customer %s mail from an opaque Introduction reference", async (notificationType, subject, copy) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: notificationType,
        attempt_count: 1,
        interest_request_id: null,
        grant_id: null,
        broker_introduction_id: "77777777-7777-4777-8777-777777777777",
        payload: {
          introductionRef: "bir_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          audience: "source",
        },
      }], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: "sent", error: null });
    const client = {
      rpc,
      from: vi.fn(),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "customer@example.com" } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 1, failed: 0 });
    const message = sendResendEmail.mock.calls[0][0];
    expect(message).toEqual(expect.objectContaining({ to: "customer@example.com", subject }));
    expect(message.text).toContain(copy);
    expect(message.text).not.toMatch(/phone|email address|accepted|declined|biometric|identity document/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("notifies only the creating broker that a customer responded without putting the decision in email", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_ffffffffffffffffffffffffffffffff",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: "broker_introduction_response",
        attempt_count: 1,
        interest_request_id: null,
        grant_id: null,
        broker_introduction_id: "77777777-7777-4777-8777-777777777777",
        payload: {
          introductionRef: "bir_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          workspaceRef: "wrk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          audience: "broker",
        },
      }], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: "sent", error: null });
    const client = {
      rpc,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "broker@example.com" } }, error: null }) } },
    };

    await processRelationshipNotifications(client as never);
    const message = sendResendEmail.mock.calls[0][0];
    expect(message.subject).toBe("A customer responded to an introduction");
    expect(message.text).toContain("/brokerdesk/w/wrk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/dashboard");
    expect(message.text).not.toMatch(/accepted|declined|comment/i);
  });

  it.each([
    ["full_view_renewed", "Your Complete Portfolio access was renewed", "renewed"],
    ["full_view_expiring", "Your Complete Portfolio access expires soon", "expires on"],
  ])("renders %s from the active grant", async (notificationType, subject, copy) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: notificationType,
        attempt_count: 1,
        interest_request_id: null,
        grant_id: "22222222-2222-4222-8222-222222222222",
        payload: {},
      }], error: null })
      .mockResolvedValueOnce({ data: "sent", error: null });
    const rows = {
      reveal_grants: { data: { id: "22222222-2222-4222-8222-222222222222", expires_at: "2026-10-05T12:00:00.000Z", portfolio_id: "66666666-6666-4666-8666-666666666666", revoked_at: null }, error: null },
      portfolios: { data: { draft_data: {} }, error: null },
    };
    const from = vi.fn((table: keyof typeof rows) => {
      const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn().mockResolvedValue(rows[table]) };
      return chain;
    });
    const client = {
      rpc,
      from,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "viewer@example.com" } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(sendResendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject, text: expect.stringContaining(copy) }));
  });

  it("records a retryable failure when recipient or grant data is unavailable", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_cccccccccccccccccccccccccccccccc",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: "full_view_approved",
        attempt_count: 1,
        interest_request_id: null,
        grant_id: null,
        payload: {},
      }], error: null })
      .mockResolvedValueOnce({ data: "failed", error: null });
    const client = {
      rpc,
      from: vi.fn(),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "viewer@example.com" } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({
      p_attempt_count: 1,
      p_succeeded: false,
      p_error_code: "GRANT_UNAVAILABLE",
      p_retryable: false,
    }));
  });

  it("preserves provider failure codes and rejects claim/completion database errors", async () => {
    sendResendEmail.mockResolvedValue({ status: "failed", code: "EMAIL_RATE_LIMITED", retryable: true });
    const job = {
      notification_ref: "ntf_dddddddddddddddddddddddddddddddd",
      recipient_user_id: "44444444-4444-4444-8444-444444444444",
      notification_type: "introduction_declined",
      attempt_count: 1,
      interest_request_id: null,
      grant_id: null,
      payload: {},
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [job], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("completion failed") });
    const client = {
      rpc,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "viewer@example.com" } }, error: null }) } },
    };
    await expect(processRelationshipNotifications(client as never)).rejects.toThrow("completion failed");
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({
      p_attempt_count: 1,
      p_error_code: "EMAIL_RATE_LIMITED",
      p_retryable: true,
    }));

    const claimError = new Error("claim failed");
    await expect(processRelationshipNotifications({ rpc: vi.fn().mockResolvedValue({ data: null, error: claimError }) } as never))
      .rejects.toThrow("claim failed");
  });

  it("marks an unconfigured provider failure as non-retryable so it can be recovered after setup", async () => {
    sendResendEmail.mockResolvedValue({ status: "failed", code: "EMAIL_NOT_CONFIGURED", retryable: false });
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_99999999999949998999999999999999",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: "broker_introduction_ready",
        attempt_count: 1,
        interest_request_id: null,
        grant_id: null,
        broker_introduction_id: "77777777-7777-4777-8777-777777777777",
        payload: { introductionRef: "bir_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", audience: "recipient" },
      }], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: "failed", error: null });
    const client = {
      rpc,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "customer@example.com" } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({
      p_attempt_count: 1,
      p_error_code: "EMAIL_NOT_CONFIGURED",
      p_retryable: false,
    }));
  });

  it("does not resolve an email or send when the stored recipient is no longer current", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_88888888888848888888888888888888",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: "broker_introduction_ready",
        attempt_count: 1,
        interest_request_id: null,
        grant_id: null,
        broker_introduction_id: "77777777-7777-4777-8777-777777777777",
        payload: { introductionRef: "bir_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", audience: "source" },
      }], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: "failed", error: null });
    const getUserById = vi.fn();
    const client = { rpc, auth: { admin: { getUserById } } };

    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(getUserById).not.toHaveBeenCalled();
    expect(sendResendEmail).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({
      p_attempt_count: 1,
      p_error_code: "BROKER_RECIPIENT_STALE",
      p_retryable: false,
    }));
  });

  it("surfaces a fenced completion instead of reporting an uncommitted provider result", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{
        notification_ref: "ntf_77777777777747778777777777777777",
        recipient_user_id: "44444444-4444-4444-8444-444444444444",
        notification_type: "introduction_declined",
        attempt_count: 2,
        interest_request_id: null,
        grant_id: null,
        payload: {},
      }], error: null })
      .mockResolvedValueOnce({ data: "unavailable", error: null });
    const client = {
      rpc,
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "viewer@example.com" } }, error: null }) } },
    };

    await expect(processRelationshipNotifications(client as never)).rejects.toThrow(
      "notification completion was unavailable; expected sent",
    );
    expect(rpc).toHaveBeenLastCalledWith("complete_relationship_notification_outbox", expect.objectContaining({
      p_attempt_count: 2,
      p_succeeded: true,
    }));
  });
});
