import { beforeEach, expect, it, vi } from "vitest";
import { emailMessageSchema } from "@/features/notifications/server/email-message.schema.mjs";

const send = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail: send }));
import { sendFamilyViewerInvitationEmail } from "@/features/family-viewers/server/family-viewer-email";

beforeEach(() => send.mockReset().mockImplementation(async input => emailMessageSchema.safeParse(input).success
  ? { status: "accepted" } : { status: "failed", code: "EMAIL_INPUT_INVALID" }));

it("uses a stable RFC-valid delivery ID even when invitation bytes are not a UUID", async () => {
  const input = {
    invitationRef: `fvi_${"b".repeat(32)}`,
    recipientEmail: "parent@example.com",
    invitationUrl: `https://vivintro.com/join/family#token=${"a".repeat(43)}`,
    expiresAt: "2026-11-12T12:00:00Z",
  };
  expect(await sendFamilyViewerInvitationEmail(input)).toEqual({ status: "sent" });
  const first = send.mock.calls[0][0].deliveryId;
  await sendFamilyViewerInvitationEmail(input);
  expect(send.mock.calls[1][0].deliveryId).toBe(first);
  await sendFamilyViewerInvitationEmail({ ...input, invitationRef: `fvi_${"a".repeat(32)}` });
  expect(send.mock.calls[2][0].deliveryId).not.toBe(first);
});

it("reports unavailable for provider failure or invalid invitation input", async () => {
  expect(await sendFamilyViewerInvitationEmail({})).toEqual({ status: "unavailable" });
  expect(send).not.toHaveBeenCalled();
  send.mockResolvedValue({ status: "failed", code: "EMAIL_NOT_CONFIGURED" });
  expect(await sendFamilyViewerInvitationEmail({
    invitationRef: `fvi_${"b".repeat(32)}`, recipientEmail: "parent@example.com",
    invitationUrl: "https://vivintro.com/join/family", expiresAt: "2026-11-12T12:00:00Z",
  })).toEqual({ status: "unavailable" });
});
