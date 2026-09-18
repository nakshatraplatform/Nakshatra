import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";

const input = {
  deliveryId: "91000000-0000-4000-8000-000000000001",
  to: "recipient@example.test",
  subject: "An update is available",
  text: "Open your dashboard to view the update.",
};
const providerId = "91000000-0000-4000-8000-000000000002";
const success = () => Response.json({ id: providerId });

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-test-credential");
  vi.stubEnv("RESEND_FROM_EMAIL", "notifications@example.test");
  vi.stubEnv("RESEND_REPLY_TO_EMAIL", "support@example.test");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server-only Resend API connection", () => {
  it("sends a bounded request with configured sender and stable idempotency", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(success());
    expect(await sendResendEmail(input, transport)).toEqual({ status: "accepted", providerMessageId: providerId });
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(`notification/${input.deliveryId}`);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer synthetic-test-credential");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(options?.body))).toEqual({
      from: "notifications@example.test", reply_to: "support@example.test", to: [input.to],
      subject: input.subject, text: input.text,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("accepts trusted HTML with mandatory plain text, and optional reply-to", async () => {
    vi.stubEnv("RESEND_REPLY_TO_EMAIL", "");
    const transport = vi.fn<typeof fetch>().mockResolvedValue(success());
    await sendResendEmail({ ...input, html: "<p>Open your dashboard.</p>" }, transport);
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({
      from: "notifications@example.test", to: [input.to], subject: input.subject, text: input.text,
      html: "<p>Open your dashboard.</p>",
    });
  });

  it.each([
    ["RESEND_API_KEY", ""], ["RESEND_API_KEY", "contains\nnewline"],
    ["RESEND_FROM_EMAIL", ""], ["RESEND_FROM_EMAIL", "bad-address"],
    ["RESEND_REPLY_TO_EMAIL", "bad-address"],
  ])("fails safely for invalid configuration %s", async (key, value) => {
    vi.stubEnv(key, value);
    const transport = vi.fn<typeof fetch>();
    expect(await sendResendEmail(input, transport)).toEqual({ status: "failed", code: "EMAIL_NOT_CONFIGURED", retryable: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it("loads configuration at dispatch, including credential rotation", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => success());
    expect(await sendResendEmail(input, transport)).toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    vi.stubEnv("RESEND_API_KEY", "rotated-synthetic-credential");
    expect(await sendResendEmail(input, transport)).toMatchObject({ status: "accepted" });
    expect(new Headers(transport.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer rotated-synthetic-credential");
  });

  it("uses the runtime fetch by default without module-time configuration", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.resetModules();
    const provider = await import("@/features/notifications/server/resend.provider");
    vi.stubEnv("RESEND_API_KEY", "synthetic-test-credential");
    const transport = vi.fn<typeof fetch>().mockResolvedValue(success());
    vi.stubGlobal("fetch", transport);
    expect(await provider.sendResendEmail(input)).toMatchObject({ status: "accepted" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("preserves the exact request and idempotency key across identical attempts", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => success());
    await sendResendEmail(input, transport);
    await sendResendEmail(input, transport);
    expect(transport.mock.calls[0][1]?.body).toEqual(transport.mock.calls[1][1]?.body);
    expect(transport.mock.calls[0][1]?.headers).toEqual(transport.mock.calls[1][1]?.headers);
  });

  it.each([
    { to: "not-email" }, { to: [input.to, "other@example.test"] }, { to: "a@example.test\r\nBcc: other@example.test" },
    { subject: "line\nbreak" }, { subject: " " }, { subject: "a".repeat(201) },
    { text: "" }, { text: "a".repeat(32_769) }, { html: "a".repeat(65_537) },
    { deliveryId: "recipient@example.test" }, { from: "override@example.test" },
    { headers: { Bcc: "other@example.test" } }, { cc: "other@example.test" },
  ])("rejects invalid or unsupported message fields (case %#) without I/O", async (override) => {
    const transport = vi.fn<typeof fetch>();
    expect(await sendResendEmail({ ...input, ...override }, transport)).toEqual({ status: "failed", code: "EMAIL_INPUT_INVALID", retryable: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    [400, "validation_error", "EMAIL_REJECTED", false],
    [401, "invalid_api_key", "EMAIL_CREDENTIALS_REJECTED", false],
    [403, "validation_error", "EMAIL_CREDENTIALS_REJECTED", false],
    [422, "validation_error", "EMAIL_REJECTED", false],
    [409, "invalid_idempotent_request", "EMAIL_IDEMPOTENCY_CONFLICT", false],
    [409, "concurrent_idempotent_requests", "EMAIL_PROVIDER_UNAVAILABLE", true],
    [429, "rate_limit_exceeded", "EMAIL_RATE_LIMITED", true],
    [500, "application_error", "EMAIL_PROVIDER_UNAVAILABLE", true],
    [503, "service_unavailable", "EMAIL_PROVIDER_UNAVAILABLE", true],
    [408, "request_timeout", "EMAIL_PROVIDER_UNAVAILABLE", true],
  ])("normalizes HTTP %i %s without leaking provider errors or retrying", async (status, name, code, retryable) => {
    const log = vi.spyOn(console, "error");
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ name, message: "private provider details" }, { status }));
    expect(await sendResendEmail(input, transport)).toEqual({ status: "failed", code, retryable });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([{}, { id: "" }, { id: "private@example.test" }])("rejects malformed success %j", async (body) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    expect(await sendResendEmail(input, transport)).toEqual({ status: "failed", code: "EMAIL_RESPONSE_INVALID", retryable: true });
  });

  it("normalizes network exceptions without attaching sensitive causes", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error("private credentials and recipient"));
    expect(await sendResendEmail(input, transport)).toEqual({ status: "failed", code: "EMAIL_PROVIDER_UNAVAILABLE", retryable: true });
  });

  it.each(["not-json", "", "{\"id\":"])("fails closed for invalid response JSON (case %#)", async (body) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    expect(await sendResendEmail(input, transport)).toMatchObject({ code: "EMAIL_RESPONSE_INVALID" });
  });

  it("handles an absent response body", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await sendResendEmail(input, transport)).toMatchObject({ code: "EMAIL_RESPONSE_INVALID" });
  });

  it("fails closed for unrecognized conflict bodies", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 409 }));
    expect(await sendResendEmail(input, transport)).toMatchObject({ code: "EMAIL_IDEMPOTENCY_CONFLICT", retryable: false });
  });

  it("bounds a stalled response body and cancels it on timeout", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const pending = sendResendEmail(input, transport);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ status: "failed", code: "EMAIL_TIMEOUT", retryable: true });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled request at ten seconds and does not retry", async () => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = sendResendEmail(input, transport);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ status: "failed", code: "EMAIL_TIMEOUT", retryable: true });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects oversized streamed responses and cancels the reader", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(16_385)); }, cancel,
    }));
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await sendResendEmail(input, transport)).toMatchObject({ code: "EMAIL_RESPONSE_INVALID" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
