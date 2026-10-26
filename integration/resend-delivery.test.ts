import { createServer, type Server } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = new URL(process.env.EMAIL_TEST_SUPABASE_URL ?? "http://invalid.test");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.protocol !== "http:" || !url.port) {
  throw new Error("Email integration requires an explicit disposable loopback Supabase URL");
}
const serviceKey = process.env.EMAIL_TEST_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("Email integration requires the local service-role key");
const nativeFetch = globalThis.fetch;
const database = createClient(url.href, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signingKey = Buffer.from("synthetic-local-signing-key-32-bytes");
let server: Server;
let endpoint: string;
let providerCalls = 0;
let providerId: string;
let onSend: (() => Promise<void>) | undefined;
const input = () => ({ deliveryId: randomUUID(), to: `${randomUUID()}@example.test`, subject: "Synthetic delivery check", text: "Synthetic content; no customer data." });
function signed(body: string, id = `msg_${randomUUID()}`, age = 0) {
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  return { "svix-id": id, "svix-timestamp": timestamp,
    "svix-signature": `v1,${createHmac("sha256", signingKey).update(`${id}.${timestamp}.${body}`).digest("base64")}` };
}
async function event(type: string, deliveryId?: string, id?: string) {
  const body = JSON.stringify({ type: `email.${type}`, created_at: new Date().toISOString(), data: {
    email_id: providerId, to: ["untrusted-body-address@example.test"], subject: "Must never be stored",
    ...(deliveryId ? { tags: { vivintro_delivery: deliveryId } } : {}),
  } });
  return nativeFetch(endpoint, { method: "POST", body, headers: signed(body, id) });
}
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = url.href;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-not-used";
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${signingKey.toString("base64")}`;
  process.env.EMAIL_RECIPIENT_HMAC_KEY = "synthetic-local-independent-key-32-plus-characters";
  process.env.RESEND_API_KEY = "synthetic-no-provider-credential";
  process.env.RESEND_FROM_EMAIL = "notifications@example.test";
  process.env.RESEND_REPLY_TO_EMAIL = "";
  globalThis.fetch = async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (target.href === "https://api.resend.com/emails") {
      providerCalls++;
      expect(new Headers(init?.headers).get("idempotency-key")).toMatch(/^notification\//);
      const payload = JSON.parse(String(init?.body));
      expect(payload.tags[0].name).toBe("vivintro_delivery");
      if (onSend) await onSend();
      return Response.json({ id: providerId });
    }
    if (target.origin !== url.origin) throw new Error("Unexpected non-local network target in integration test");
    return nativeFetch(input, init);
  };
  const { POST } = await import("../src/app/api/webhooks/resend/route");
  server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(",") : value);
      const response = await POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", body: Buffer.concat(chunks), headers }));
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("HTTP listener unavailable");
  endpoint = `http://127.0.0.1:${address.port}/api/webhooks/resend`;
});
afterAll(async () => { globalThis.fetch = nativeFetch; if (server) await new Promise<void>(resolve => server.close(() => resolve())); });

it("traces actual guarded dispatch, signed HTTP receipt, suppression and no resend", async () => {
  const { sendResendEmail } = await import("../src/features/notifications/server/resend.provider");
  const message = input(); providerId = randomUUID();
  expect(await sendResendEmail(message)).toEqual({ status: "accepted", providerMessageId: providerId });
  expect((await event("delivered")).status).toBe(202);
  const id = `msg_${randomUUID()}`;
  const replies = await Promise.all([event("bounced", undefined, id), event("bounced", undefined, id)]);
  expect(replies.map(reply => reply.status)).toEqual([202, 202]);
  const count = providerCalls;
  expect(await sendResendEmail({ ...message, deliveryId: randomUUID() })).toMatchObject({ code: "EMAIL_RECIPIENT_SUPPRESSED", retryable: false });
  expect(providerCalls).toBe(count);
  const health = await database.rpc("email_delivery_health");
  expect(health.error).toBeNull(); expect(health.data).toMatchObject({ healthy: false });
});
it("retains an early terminal webhook when it arrives before acceptance persistence", async () => {
  const { sendResendEmail } = await import("../src/features/notifications/server/resend.provider");
  const message = input(); providerId = randomUUID();
  onSend = async () => { expect((await event("complained", message.deliveryId)).status).toBe(202); };
  expect(await sendResendEmail(message)).toMatchObject({ status: "accepted" }); onSend = undefined;
  const count = providerCalls;
  expect(await sendResendEmail({ ...message, deliveryId: randomUUID() })).toMatchObject({ code: "EMAIL_RECIPIENT_SUPPRESSED" });
  expect(providerCalls).toBe(count);
});
it("fences actual concurrent preparation and atomically deduplicates receipt transactions", async () => {
  const preparation = { p_delivery_id: randomUUID(), p_recipient_hash: randomUUID().replaceAll("-", "").repeat(2), p_message_digest: "b".repeat(64) };
  const [a, b] = await Promise.all([database.rpc("prepare_application_email", preparation), database.rpc("prepare_application_email", preparation)]);
  expect(a.error).toBeNull(); expect(b.error).toBeNull();
  expect([a.data.status, b.data.status].sort()).toEqual(["busy", "ready"]);
  const record = { p_event_id: `msg_${randomUUID()}`, p_event_digest: "d".repeat(64),
    p_provider_message_id: randomUUID(), p_status: "delivered", p_occurred_at: new Date().toISOString(), p_delivery_id: preparation.p_delivery_id };
  const results = await Promise.all([database.rpc("record_resend_delivery_event", record), database.rpc("record_resend_delivery_event", record)]);
  expect(results.map(result => result.error)).toEqual([null, null]);
  expect(results.map(result => result.data).sort()).toEqual([false, true]);
});
it("rejects forged and stale HTTP requests and never changes the database", async () => {
  const before = await database.rpc("email_delivery_health");
  const body = JSON.stringify({ type: "email.complained", created_at: new Date().toISOString(), data: { email_id: providerId } });
  expect((await nativeFetch(endpoint, { method: "POST", body, headers: { ...signed(body), "svix-signature": "v1,forged" } })).status).toBe(401);
  expect((await nativeFetch(endpoint, { method: "POST", body, headers: signed(body, undefined, 600) })).status).toBe(401);
  const after = await database.rpc("email_delivery_health");
  expect(after.data).toEqual(before.data);
});
