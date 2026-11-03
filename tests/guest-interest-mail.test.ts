import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/server/resend.provider", () => ({ sendResendEmail: send }));
import { processGuestInterestMail } from "@/features/notifications/server/guest-interest-mail.service";

const job = { id: "11111111-1111-4111-8111-111111111111", interest_request_id: "22222222-2222-4222-8222-222222222222",
  lease_token: "33333333-3333-4333-8333-333333333333", kind: "approved_contact", recipient_email: "guest@example.test",
  contact_payload: { contact_person: "Chosen contact", email: "chosen@example.test", phone: "+1 617 555 0101" }, attempt_count: 1 };

let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  rpc = vi.fn(async (name: string) => ({ data: name === "claim_guest_interest_mail" ? [job] : true, error: null }));
  send.mockResolvedValue({ status: "accepted" });
});

describe("guest interest mail worker", () => {
  it("emails only the chosen contact details after a current approval", async () => {
    const result = await processGuestInterestMail({ rpc } as never);
    expect(result).toEqual({ claimed: 1, failed: 0 });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: job.id, to: "guest@example.test",
      subject: "Contact details shared through VivIntro",
      text: expect.stringContaining("chosen@example.test") }), undefined, expect.anything());
    const sentText = send.mock.calls[0][0].text as string;
    expect(sentText).toContain("does not give you access to private introduction details");
    expect(sentText).not.toContain("15 days");
    expect(rpc).toHaveBeenCalledWith("complete_guest_interest_mail", expect.objectContaining({ p_sent: true, p_retryable: false }));
  });

  it("delivers a phone-only published contact with a blank email", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, contact_payload: { contact_person: "Chosen contact", phone: "+91 9876543210", email: "" } }] : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 0 });
    expect(send.mock.calls[0][0].text).toContain("+91 9876543210");
    expect(rpc).toHaveBeenCalledWith("complete_guest_interest_mail", expect.objectContaining({ p_sent: true }));
  });

  it("delivers an additional phone-only contact without a name", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, contact_payload: { contacts: [{ phone: "+91 9876543210", email: "" }] } }] : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 0 });
    expect(send.mock.calls[0][0].text).toContain("+91 9876543210");
  });

  it("delivers a published email within the editor's 254-character limit", async () => {
    const longEmail = `${"a".repeat(60)}@${"b".repeat(60)}.${"c".repeat(60)}.example`;
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, contact_payload: { email: longEmail } }] : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 0 });
    expect(send.mock.calls[0][0].text).toContain(longEmail);
  });

  it.each(["receipt", "declined"] as const)("never puts contacts in a %s email", async kind => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, kind }] : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 0 });
    const text = send.mock.calls[0][0].text as string;
    expect(text).not.toContain("chosen@example.test");
    expect(text).not.toContain("+1 617 555 0101");
  });

  it("does not send contacts when the decision has changed", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail" ? [job]
      : name === "guest_interest_mail_is_current" ? false : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("complete_guest_interest_mail", expect.objectContaining({
      p_sent: false, p_error_code: "GUEST_MAIL_STALE", p_retryable: false,
    }));
  });

  it("never sends malformed private contact data", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, contact_payload: { email: "invalid" } }] : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("complete_guest_interest_mail", expect.objectContaining({
      p_sent: false, p_error_code: "CONTACT_PAYLOAD_INVALID", p_retryable: false,
    }));
  });

  it("defers provider failures without losing the queued message", async () => {
    send.mockResolvedValue({ status: "failed", code: "EMAIL_UNAVAILABLE", retryable: true });
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 1 });
    expect(rpc).toHaveBeenCalledWith("complete_guest_interest_mail", expect.objectContaining({
      p_sent: false, p_error_code: "EMAIL_UNAVAILABLE", p_retryable: true,
    }));
  });
  it("sends an approval URL without copying private portfolio contents into email", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.vivintro.com");
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, kind: "approved_access", contact_payload: { grantId: job.interest_request_id, shareToken: "guest-portfolio", expiresAt: "2026-11-16T12:00:00+00:00" } }] : true, error: null }));
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 0 });
    const email = send.mock.calls[0][0];
    expect(email.text).toContain("https://www.vivintro.com/p/guest-portfolio/view");
    expect(email.text).toContain("same email");
    expect(email.text).not.toContain("chosen@example.test");
    vi.unstubAllEnvs();
  });
  it.each(["http://www.vivintro.com", "ftp://example.test", "not-a-url"])("refuses an unsafe configured approval-email origin (%s)", async origin => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, kind: "approved_access", contact_payload: { grantId: job.interest_request_id, shareToken: "guest-portfolio", expiresAt: "2026-11-16T12:00:00+00:00" } }] : true, error: null }));
    try {
      expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 1 });
      expect(send).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith("complete_guest_interest_mail", expect.objectContaining({ p_sent: false, p_retryable: true }));
    } finally { vi.unstubAllEnvs(); }
  });
  it("does not email a malformed approval payload", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.vivintro.com");
    rpc.mockImplementation(async (name: string) => ({ data: name === "claim_guest_interest_mail"
      ? [{ ...job, kind: "approved_access", contact_payload: { shareToken: "guest-portfolio" } }] : true, error: null }));
    try {
      expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 1 });
      expect(send).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
  it("reports permanent provider failures instead of marking maintenance healthy", async () => {
    send.mockResolvedValue({ status: "failed", code: "EMAIL_CREDENTIALS_REJECTED", retryable: false });
    expect(await processGuestInterestMail({ rpc } as never)).toEqual({ claimed: 1, failed: 1 });
  });
});
