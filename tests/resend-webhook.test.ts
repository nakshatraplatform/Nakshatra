import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/resend/route";
const database = vi.hoisted(() => ({ rpc: vi.fn(), factory: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: (...args: unknown[]) => { database.factory(...args); return database; } }));
const key = Buffer.from("synthetic-only-webhook-key-32-bytes");
const secret = `whsec_${key.toString("base64")}`;
const providerId = "56761188-7520-42d8-8898-ff6fc54ce618";
const deliveryId = "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794";
// Provider-documented envelope; private fields must be stripped at the boundary.
const payload = (type = "email.delivered") => JSON.stringify({ type, created_at: new Date().toISOString(), data: {
  email_id: providerId, from: "VivIntro <notifications@example.test>", to: ["private@example.test"],
  subject: "Private subject", html: "private action https://example.test/token", tags: { vivintro_delivery: deliveryId },
} });
function request(body = payload(), { age = 0, id = "msg_documented_event", headers = {}, signedBody = body } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${signedBody}`).digest("base64");
  return new Request("https://app.test/api/webhooks/resend", { method: "POST", body,
    headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}`, ...headers } });
}
beforeEach(() => { vi.stubEnv("RESEND_WEBHOOK_SECRET", secret); database.factory.mockReset(); database.rpc.mockReset().mockResolvedValue({ data: true, error: null }); });
afterEach(() => vi.unstubAllEnvs());
describe("signed Resend route", () => {
  it.each(["sent", "delivered", "bounced", "complained", "suppressed", "failed", "delivery_delayed"])("normalizes %s, excluding private provider fields", async type => {
    const response = await POST(request(payload(`email.${type}`)));
    expect(response.status).toBe(202); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(database.rpc).toHaveBeenCalledWith("record_resend_delivery_event", {
      p_event_id: "msg_documented_event", p_event_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_provider_message_id: providerId, p_status: type === "delivery_delayed" ? "delayed" : type,
      p_delivery_id: deliveryId, p_occurred_at: expect.any(String),
    });
    expect(JSON.stringify(database.rpc.mock.calls)).not.toMatch(/private@|Private subject|https:|html/);
  });
  it("preserves whitespace in signed raw bytes", async () => {
    const body = ` \n${payload()}\n `;
    expect((await POST(request(body))).status).toBe(202);
    expect((await POST(request(body.trim(), { signedBody: body }))).status).toBe(401);
  });
  it.each([301, -301])("rejects stale or future signature age %s", async age => {
    expect((await POST(request(payload(), { age }))).status).toBe(401);
    expect(database.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { "svix-id": "" }, { "svix-timestamp": "" }, { "svix-signature": "v1,forged" },
    { "svix-signature": "x".repeat(2049) }, { "svix-id": "x".repeat(129) },
  ])("rejects malformed authentication before persistence", async headers => {
    expect((await POST(request(payload(), { headers }))).status).toBe(401);
    expect(database.rpc).not.toHaveBeenCalled();
  });
  it("accepts signature rotation candidates through Svix", async () => {
    const original = request();
    const signature = original.headers.get("svix-signature");
    original.headers.set("svix-signature", `v1,old-key-signature ${signature}`);
    expect((await POST(original)).status).toBe(202);
  });
  it.each(["", "wrong", "whsec_"])("fails closed for missing signing configuration", async secret => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", secret);
    expect((await POST(request())).status).toBe(503); expect(database.rpc).not.toHaveBeenCalled();
  });
  it("ignores authenticated unsupported events without persisting payloads", async () => {
    expect((await POST(request(payload("email.opened")))).status).toBe(202);
    expect(database.rpc).not.toHaveBeenCalled();
  });
  it("supports known delivery events without correlation tags", async () => {
    const body = JSON.parse(payload()); delete body.data.tags;
    expect((await POST(request(JSON.stringify(body)))).status).toBe(202);
    expect(database.rpc.mock.calls[0][1]).not.toHaveProperty("p_delivery_id");
  });
  it.each([{}, { type: "email.sent", created_at: "bad", data: {} },
    { type: "email.sent", created_at: new Date(Date.now() + 600_000).toISOString(), data: { email_id: providerId } },
  ])("rejects malformed signed events", async body => {
    expect((await POST(request(JSON.stringify(body)))).status).toBe(400); expect(database.rpc).not.toHaveBeenCalled();
  });
  it("bounds declared and streamed bodies", async () => {
    expect((await POST(request(payload(), { headers: { "content-length": "65537" } }))).status).toBe(413);
    expect((await POST(request("x".repeat(65537)))).status).toBe(413);
    expect(database.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid UTF-8 even when bytes were signed", async () => {
    const raw = Buffer.from([0xff, 0xfe]); const id = "msg_utf8"; const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", key).update(`${id}.${timestamp}.`).update(raw).digest("base64");
    const req = new Request("https://app.test/api/webhooks/resend", { method: "POST", body: raw,
      headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` } });
    expect((await POST(req)).status).toBe(401); expect(database.rpc).not.toHaveBeenCalled();
  });
  it("acknowledges durable duplicates and retries database failures without leaks", async () => {
    database.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await POST(request())).status).toBe(202);
    for (const result of [{ data: true, error: { message: "private database detail" } }, { data: null, error: null }]) {
      database.rpc.mockResolvedValueOnce(result);
      const response = await POST(request()); expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private");
    }
    database.rpc.mockRejectedValueOnce(new Error("private exception"));
    expect((await POST(request())).status).toBe(503);
  });
});

it("rejects added BOM bytes when only the original JSON was signed", async () => {
  const body = payload();
  expect((await POST(request(`\uFEFF${body}`, { signedBody: body }))).status).toBe(401);
  expect(database.rpc).not.toHaveBeenCalled();
});
it("bounds actual webhook database transport and preserves caller cancellation", async () => {
  await POST(request());
  const transport = database.factory.mock.calls[0][0] as typeof fetch;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  try {
    const aborted = new AbortController(); aborted.abort();
    await transport("https://database.test", { signal: aborted.signal });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await transport("https://database.test");
    expect(fetcher.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
  } finally { vi.unstubAllGlobals(); }
});

it.each([`\uFEFF${payload()}`, "{"])("rejects authenticated malformed JSON without writes", async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(database.rpc).not.toHaveBeenCalled();
});
