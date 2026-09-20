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
    expect(rpc).toHaveBeenLastCalledWith("complete_notification_outbox", expect.objectContaining({ p_succeeded: true }));
  });

  it("does nothing when no relationship notifications are due", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    await expect(processRelationshipNotifications(client as never)).resolves.toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(sendResendEmail).not.toHaveBeenCalled();
  });
});
