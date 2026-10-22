import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeClient, defaultStackParser, init, continueTrace, startSpan, flush, close } from "@sentry/nextjs";
import type { Envelope, EventEnvelope, ErrorEvent, StreamedSpanJSON } from "@sentry/core";
import { sentryEnvironment, sentryIngestOrigin } from "../src/lib/observability/sentry-config";
import { privateErrorEvent, privateSpan, sentryOptions, telemetryRoute, VERIFICATION_MESSAGE } from "../src/lib/observability/sentry";

const dsn = "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456";
const secret = "PRIVATE_SENTINEL_CANDIDATE_918273";
afterEach(() => vi.unstubAllEnvs());

describe("Sentry destination and runtime configuration", () => {
  it("allows only a valid Sentry SaaS DSN, never arbitrary egress", () => {
    expect(sentryIngestOrigin(dsn)).toBe("https://o123.ingest.us.sentry.io");
    for (const invalid of [undefined, "", "not a url", dsn.replace("https:", "http:"), dsn.replace(".io", ".io.attacker.example"), dsn + "?secret=value", dsn + "#fragment", dsn.replace("@", ":password@"), dsn.replace(".io/", ".io:444/"), "https://example.com"]) {
      expect(sentryIngestOrigin(invalid)).toBeUndefined();
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", invalid);
      expect(sentryOptions().enabled).toBe(false);
      expect(sentryOptions().dsn).toBeUndefined();
    }
  });

  it("distinguishes deployment environments and bounds production trace volume", () => {
    expect(sentryEnvironment("preview", "production")).toBe("preview");
    expect(sentryEnvironment("malformed/value", "production")).toBe("production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "preview");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_RELEASE", "abcdef1234");
    vi.stubEnv("NODE_ENV", "production");
    expect(sentryOptions()).toMatchObject({ enabled: true, dsn, environment: "preview", release: "abcdef1234", tracesSampleRate: 0.1, tracePropagationTargets: [] });
    vi.stubEnv("NODE_ENV", "development");
    expect(sentryOptions().tracesSampleRate).toBe(1);
    expect(sentryOptions().beforeBreadcrumb()).toBeNull();
    expect(sentryOptions().beforeSendLog()).toBeNull();
    expect(sentryOptions().beforeSendMetric()).toBeNull();
  });
});

describe("Sentry privacy boundary", () => {
  it("retains route labels but strips names, tokens, query strings and fragments", () => {
    for (const value of [`https://www.vivintro.com/p/${secret}?email=${secret}#${secret}`, `/p/${secret}`]) {
      expect(telemetryRoute(value)).toBe("/p/[redacted]");
    }
    expect(telemetryRoute(`GET /api/identity-verification/status?token=${secret}`)).toBe("/api/identity-verification/status");
    expect(telemetryRoute(`//${secret}.example/account`)).toBe("/account");
    expect(telemetryRoute(undefined)).toBe("/[redacted]");
  });

  it("removes sensitive error fields, nested causes and arbitrary context while retaining source coordinates", () => {
    const input: ErrorEvent = {
      type: undefined, event_id: "a".repeat(32), timestamp: 1, level: "error", platform: "javascript",
      release: "commit123", environment: "preview", transaction: `/p/${secret}`,
      user: { email: secret, id: secret, ip_address: secret }, message: secret, logentry: { message: secret },
      extra: { detail: { value: secret } }, tags: { candidate: secret }, server_name: secret, fingerprint: [secret],
      request: { url: `/p/${secret}?code=${secret}`, method: "GET", headers: { authorization: secret }, cookies: { session: secret }, data: secret },
      breadcrumbs: [{ message: secret, data: { url: secret } }],
      contexts: { arbitrary: { data: secret }, trace: { trace_id: "b".repeat(32), span_id: "c".repeat(16), data: { user: secret } } },
      exception: { values: [{ type: "TypeError", value: secret, mechanism: { type: "auto", data: { secret } }, stacktrace: { frames: [{ filename: `/Users/${secret}/repo/src/app/account/page.tsx?token=${secret}`, lineno: 41, colno: 3, function: "loadAccount", vars: { secret }, context_line: secret }] } }] },
      debug_meta: { images: [{ type: "sourcemap", debug_id: "debug123", code_file: `/Users/${secret}/repo/src/app/account/page.tsx` }] },
    };
    const hint = { attachments: [{ filename: "profile.txt", data: secret }] };
    const result = privateErrorEvent(input, hint);
    expect(JSON.stringify(input)).toContain(secret); // Negative control: unfiltered data would fail.
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.exception?.values?.[0]).toMatchObject({ type: "TypeError", value: "Application error (message redacted)", stacktrace: { frames: [{ filename: "app:///src/app/account/page.tsx", lineno: 41, colno: 3, function: "loadAccount" }] } });
    expect(result.debug_meta?.images?.[0]).toEqual({ type: "sourcemap", debug_id: "debug123", code_file: "app:///src/app/account/page.tsx" });
    expect(hint.attachments).toEqual([]);
    expect(result.request).toEqual({ method: "GET", url: "/p/[redacted]" });
    expect(result.user).toBeUndefined();
    expect(result.contexts?.trace?.data).toBeUndefined();
    expect(privateErrorEvent({ type: undefined, exception: { values: [{ value: VERIFICATION_MESSAGE }] } }, {}).exception?.values?.[0].value).toBe(VERIFICATION_MESSAGE);
  });

  it("removes span attributes and links that contain private data", () => {
    const input: StreamedSpanJSON = { trace_id: "a".repeat(32), span_id: "b".repeat(16), name: `GET https://vivintro.com/p/${secret}?code=${secret}`, start_timestamp: 1, end_timestamp: 2, is_segment: true, status: "ok", attributes: { "sentry.op": "http.server", "http.response.status_code": 200, "url.full": secret, "db.query.text": secret }, links: [{ trace_id: "a".repeat(32), span_id: "b".repeat(16), attributes: { secret } }] };
    expect(privateSpan(input)).toMatchObject({ name: "/p/[redacted]", start_timestamp: 1, end_timestamp: 2, attributes: { "sentry.op": "http.server", "http.response.status_code": 200 } });
    expect(JSON.stringify(privateSpan(input))).not.toContain(secret);
    expect(privateSpan({ ...input, name: `SELECT ${secret}`, attributes: { "sentry.op": secret } }).name).toBe("application.operation");
  });

  it("filters the real SDK envelope including DSC and attachments before transport", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    const sent: Envelope[] = [];
    const client = new NodeClient({ ...sentryOptions(), stackParser: defaultStackParser, transport: () => ({ send: async envelope => { sent.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
    client.init();
    client.captureEvent({ message: secret, exception: { values: [{ type: "Error", value: secret }] }, user: { email: secret }, sdkProcessingMetadata: { dynamicSamplingContext: { transaction: secret, trace_id: "a".repeat(32), public_key: "a".repeat(32) } } }, { attachments: [{ filename: "private.txt", data: secret }] });
    await client.flush(2000);
    expect(sent.length).toBeGreaterThan(0);
    expect(JSON.stringify(sent)).not.toContain(secret);
    expect(sent.map(([, items]) => items.map(([header]) => header.type)).flat()).toEqual(["event"]);
    const envelope: EventEnvelope = [{ event_id: "c".repeat(32), sent_at: new Date().toISOString(), trace: { transaction: secret, trace_id: "a".repeat(32), public_key: "b".repeat(32) } }, [[{ type: "event" }, {}], [{ type: "attachment", filename: "private.txt", length: secret.length }, secret]]];
    await client.sendEnvelope(envelope);
    expect(sent[1][0].trace).not.toHaveProperty("transaction");
    expect(sent[1][1].map(([header]) => header.type)).toEqual(["event"]);
    expect(JSON.stringify(sent)).not.toContain(secret);
    await client.close(2000);
  });

  it("does not forward hostile inbound baggage into real streamed-span envelopes", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    const sent: Envelope[] = [];
    init({ ...sentryOptions(), tracesSampleRate: 1, transport: () => ({ send: async (envelope: Envelope) => { sent.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
    await continueTrace({ sentryTrace: `${"a".repeat(32)}-${"b".repeat(16)}-1`, baggage: `sentry-trace_id=${"a".repeat(32)},sentry-public_key=${secret}%40example.invalid,sentry-sampled=${secret},sentry-sample_rate=${secret},sentry-transaction=${secret}` }, async () => {
      await startSpan({ name: "/account", op: "http.server" }, async () => undefined);
    });
    await flush(2000);
    const spanEnvelope = sent.find(([, items]) => items.some(([header]) => header.type === "span"));
    expect(spanEnvelope).toBeDefined();
    expect(spanEnvelope?.[0].trace).toMatchObject({ trace_id: "a".repeat(32), public_key: "a".repeat(32) });
    expect(JSON.stringify(sent)).not.toContain(secret);
    for (const [header] of sent) {
      if (header.trace) expect(header.trace).toMatchObject({ public_key: "a".repeat(32) });
    }
    await close(2000);
  });
});
