import { afterEach, expect, it, vi } from "vitest";
import { close, flush, init, setTag, startSpan } from "@sentry/nextjs";
import type { Envelope } from "@sentry/core";
import { sentryOptions, privateErrorEvent } from "@/lib/observability/sentry.runtime.mjs";
import { observeOperation, reportOperationFailure } from "@/lib/observability/operations.mjs";
import { candidateDiditRequest } from "@/features/identity-verification/server/didit-candidate-contract.mjs";
import { sendResendEmail } from "@/features/notifications/server/resend.runtime.mjs";

const secret = "PRIVATE_OPERATION_SENTINEL";
afterEach(async () => { await close(2000); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function setup() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456");
  const sent: Envelope[] = [];
  init({ ...sentryOptions(), tracesSampler: () => 1,
    transport: () => ({ send: async (envelope: Envelope) => { sent.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
  return sent;
}

it("retains only approved operational tags and cannot forward arbitrary reference/code values", async () => {
  const sent = setup();
  setTag("user-content", secret);
  reportOperationFailure("portfolio.draft.save", new Error(secret), { code: secret, reference: secret });
  await flush(2000);
  expect(JSON.stringify(sent)).not.toContain(secret);
  expect(JSON.stringify(sent)).toContain('"vivintro.operation":"portfolio.draft.save"');
  expect(JSON.stringify(sent)).toContain('"vivintro.code":"OPERATION_FAILED"');
  const filtered = privateErrorEvent({ type: undefined, tags: { "vivintro.operation": secret, "vivintro.reference": secret }, fingerprint: [secret] }, {});
  expect(filtered.tags).toBeUndefined(); expect(filtered.fingerprint).toBeUndefined();
});

it("labels real Didit and Resend transport spans without mixing concurrent operation scopes", async () => {
  const sent = setup();
  vi.stubEnv("RESEND_API_KEY", secret); vi.stubEnv("RESEND_FROM_EMAIL", "notify@example.test");
  const transport = (status: number) => vi.fn(async () => {
    await startSpan({ name: secret, op: "http.client", attributes: { "http.response.status_code": status } }, async () => new Promise(resolve => setTimeout(resolve, 5)));
    return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
  });
  await Promise.all([
    candidateDiditRequest(`https://verification.didit.me/v3/session/${secret}/decision/`, { apiKey: secret, fetchImpl: transport(201) }),
    sendResendEmail({ deliveryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", to: "recipient@example.test", subject: "Synthetic test", text: secret }, transport(202)),
    observeOperation("portfolio.dashboard.load", () => startSpan({ name: secret, op: "http.client", attributes: { "http.response.status_code": 203 } }, async () => undefined)),
  ]);
  await flush(2000);
  const names: string[] = [];
  const childNames: Record<string, string> = {};
  for (const [, items] of sent) for (const [header, payload] of items) if (header.type === "span") {
    const container = payload as { items: { name: string; attributes: Record<string, { value: string | number }> }[] };
    for (const span of container.items) {
      names.push(span.name);
      const status = span.attributes["http.response.status_code"]?.value;
      if (status) childNames[String(status)] = span.name;
    }
  }
  expect(names).toContain("provider.didit.request");
  expect(names).toContain("provider.resend.send");
  expect(names).toContain("portfolio.dashboard.load");
  expect(childNames).toEqual({ "201": "provider.didit.request", "202": "provider.resend.send", "203": "portfolio.dashboard.load" });
  expect(JSON.stringify(sent)).not.toContain(secret);
});
