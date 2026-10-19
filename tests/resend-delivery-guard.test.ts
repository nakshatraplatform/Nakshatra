import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { sendTrackedEmail } from "@/features/notifications/server/delivery.runtime.mjs";
const admin = vi.hoisted(() => ({ rpc: vi.fn(), factory: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: (...args: unknown[]) => { admin.factory(...args); return admin; } }));
const input = { deliveryId: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794", to: "Recipient@Example.test", subject: "Hello", text: "Private message https://example.test/token" };
const key = "synthetic-independent-key-32-characters";
const providerId = "56761188-7520-42d8-8898-ff6fc54ce618";
const claimToken = "ce62bb93-6d12-44bb-98ef-3accf613d582";
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-key"); vi.stubEnv("RESEND_FROM_EMAIL", "notifications@example.test");
  vi.stubEnv("RESEND_REPLY_TO_EMAIL", ""); vi.stubEnv("EMAIL_RECIPIENT_HMAC_KEY", key);
  admin.rpc.mockReset(); admin.factory.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("shared delivery guard", () => {
  it.each([["suppressed", "EMAIL_RECIPIENT_SUPPRESSED", false], ["conflict", "EMAIL_IDEMPOTENCY_CONFLICT", false],
    ["expired", "EMAIL_RETRY_WINDOW_EXPIRED", false], ["busy", "EMAIL_DELIVERY_GUARD_UNAVAILABLE", true]])("never calls Resend for %s preparation", async (status, code, retryable) => {
    admin.rpc.mockResolvedValue({ data: { status }, error: null });
    const transport = vi.fn<typeof fetch>();
    expect(await sendResendEmail(input, transport)).toEqual({ status: "failed", code, retryable });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["", "short", "x".repeat(513)])("fails closed for invalid independent key", async key => {
    vi.stubEnv("EMAIL_RECIPIENT_HMAC_KEY", key);
    const transport = vi.fn<typeof fetch>();
    expect(await sendResendEmail(input, transport)).toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    expect(transport).not.toHaveBeenCalled(); expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("rejects untrusted inputs before persistence", async () => {
    expect(await sendResendEmail({ ...input, from: "attacker@example.test" })).toMatchObject({ code: "EMAIL_INPUT_INVALID" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("stores only keyed metadata, dispatches once, then binds provider ID with fenced token", async () => {
    admin.rpc.mockResolvedValueOnce({ data: { status: "ready", claimToken }, error: null }).mockResolvedValueOnce({ data: true, error: null });
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: providerId }));
    expect(await sendResendEmail(input, transport)).toEqual({ status: "accepted", providerMessageId: providerId });
    expect(admin.rpc).toHaveBeenNthCalledWith(1, "prepare_application_email", {
      p_delivery_id: input.deliveryId,
      p_recipient_hash: createHmac("sha256", key).update("recipient-v1\nrecipient@example.test").digest("hex"),
      p_message_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(admin.rpc.mock.calls)).not.toMatch(/Recipient|Private message|example.test|https/);
    expect(admin.rpc).toHaveBeenNthCalledWith(2, "finish_application_email", {
      p_delivery_id: input.deliveryId, p_claim_token: claimToken, p_provider_message_id: providerId, p_error_code: null, p_retryable: false,
    });
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({ to: ["recipient@example.test"], tags: [{ name: "vivintro_delivery", value: input.deliveryId }] });
  });
  it("uses the same recipient hash for canonical case, but not plaintext SHA and not the content digest", async () => {
    admin.rpc.mockResolvedValue({ data: { status: "suppressed" }, error: null });
    await sendResendEmail(input); await sendResendEmail({ ...input, to: input.to.toLowerCase() });
    expect(admin.rpc.mock.calls[0][1]).toEqual(admin.rpc.mock.calls[1][1]);
    expect(admin.rpc.mock.calls[0][1].p_recipient_hash).not.toBe(admin.rpc.mock.calls[0][1].p_message_digest);
  });
  it("returns known acceptance without repeating provider I/O", async () => {
    admin.rpc.mockResolvedValue({ data: { status: "accepted", providerMessageId: providerId }, error: null });
    const transport = vi.fn<typeof fetch>();
    expect(await sendResendEmail(input, transport)).toEqual({ status: "accepted", providerMessageId: providerId });
    expect(transport).not.toHaveBeenCalled(); expect(admin.rpc).toHaveBeenCalledOnce();
  });
  it.each([{ data: null, error: null }, { data: { status: "ready" }, error: null }, { data: { status: "suppressed" }, error: { message: "private detail" } }])("fails closed for unavailable/malformed preparation", async data => {
    admin.rpc.mockResolvedValue(data); const transport = vi.fn<typeof fetch>();
    expect(await sendResendEmail(input, transport)).toEqual({ status: "failed", code: "EMAIL_DELIVERY_GUARD_UNAVAILABLE", retryable: true });
    expect(transport).not.toHaveBeenCalled();
  });
  it("fences retryable provider failure and conceals exception detail", async () => {
    admin.rpc.mockResolvedValueOnce({ data: { status: "ready", claimToken }, error: null }).mockResolvedValueOnce({ data: true, error: null });
    expect(await sendResendEmail(input, vi.fn().mockRejectedValue(new Error("private transport detail")))).toEqual({ status: "failed", code: "EMAIL_PROVIDER_UNAVAILABLE", retryable: true });
    expect(admin.rpc).toHaveBeenLastCalledWith("finish_application_email", expect.objectContaining({ p_provider_message_id: null, p_error_code: "EMAIL_PROVIDER_UNAVAILABLE", p_retryable: true }));
  });
  it.each([{ data: false, error: null }, { data: true, error: { message: "private database detail" } }])("never reports acceptance after failed persistence", async completion => {
    admin.rpc.mockResolvedValueOnce({ data: { status: "ready", claimToken }, error: null }).mockResolvedValueOnce(completion);
    expect(await sendResendEmail(input, vi.fn().mockResolvedValue(Response.json({ id: providerId })))).toEqual({ status: "failed", code: "EMAIL_DELIVERY_GUARD_UNAVAILABLE", retryable: true });
  });
  it("conceals thrown database/configuration errors", async () => {
    admin.rpc.mockRejectedValueOnce(new Error("private detail"));
    expect(await sendResendEmail(input)).toMatchObject({ code: "EMAIL_DELIVERY_GUARD_UNAVAILABLE" });
    admin.factory.mockImplementationOnce(() => { throw new Error("private credentials"); });
    expect(await sendResendEmail(input)).toMatchObject({ code: "EMAIL_DELIVERY_GUARD_UNAVAILABLE" });
  });
  it("accepts the worker's injected database, with native fetch defaults", async () => {
    const db = { rpc: vi.fn().mockResolvedValueOnce({ data: { status: "ready", claimToken }, error: null }).mockResolvedValueOnce({ data: true, error: null }) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: providerId })));
    expect(await sendTrackedEmail(input, db)).toMatchObject({ status: "accepted" });
    expect(admin.factory).not.toHaveBeenCalled();
    db.rpc.mockResolvedValue({ data: { status: "suppressed" }, error: null });
    expect(await sendResendEmail(input, undefined, db as never)).toMatchObject({ code: "EMAIL_RECIPIENT_SUPPRESSED" });
    expect(admin.factory).not.toHaveBeenCalled();
  });
  it("bounds the service client HTTP transport and retains cancellation", async () => {
    admin.rpc.mockResolvedValue({ data: { status: "suppressed" }, error: null });
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}));
    await sendResendEmail(input, transport);
    const databaseFetch = admin.factory.mock.calls[0][0] as typeof fetch;
    const abort = new AbortController(); abort.abort();
    await databaseFetch("https://example.test", { signal: abort.signal });
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await databaseFetch("https://example.test");
    expect(transport.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
it("missing sender configuration never freezes a request digest before first send", async () => {
  vi.stubEnv("RESEND_FROM_EMAIL", "");
  expect(await sendResendEmail(input)).toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
  expect(admin.rpc).not.toHaveBeenCalled();
});
