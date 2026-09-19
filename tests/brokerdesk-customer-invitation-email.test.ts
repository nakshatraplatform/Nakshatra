import { beforeEach, describe, expect, it, vi } from "vitest";

const sendResendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail }));

import { sendCustomerPortfolioInvitationEmail } from "@/features/broker-relationships/server/customer-invitation-email";

const invitation = {
  invitationRef: "inv_11111111111141118111111111111111",
  recipientEmail: "customer@example.com",
  invitationUrl: `https://vivintro.com/join/customer#token=${"a".repeat(43)}`,
  expiresAt: "2026-09-26T12:00:00.000Z",
};

describe("customer portfolio invitation email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendResendEmail.mockResolvedValue({
      status: "accepted",
      providerMessageId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("sends one stable, customer-ownership-first setup message", async () => {
    await expect(sendCustomerPortfolioInvitationEmail(invitation)).resolves.toEqual({ status: "sent" });
    expect(sendResendEmail).toHaveBeenCalledWith({
      deliveryId: "11111111-1111-4111-8111-111111111111",
      to: "customer@example.com",
      subject: "Create your VivIntro portfolio",
      text: expect.stringContaining("Your broker cannot create or edit your portfolio"),
    });
    expect(sendResendEmail.mock.calls[0][0].text).toContain(invitation.invitationUrl);
  });

  it("returns a safe fallback state for invalid input and provider failure", async () => {
    await expect(sendCustomerPortfolioInvitationEmail({ ...invitation, recipientEmail: "bad" }))
      .resolves.toEqual({ status: "unavailable" });
    expect(sendResendEmail).not.toHaveBeenCalled();
    sendResendEmail.mockResolvedValueOnce({ status: "failed", code: "EMAIL_NOT_CONFIGURED", retryable: false });
    await expect(sendCustomerPortfolioInvitationEmail(invitation))
      .resolves.toEqual({ status: "unavailable" });
  });
});
