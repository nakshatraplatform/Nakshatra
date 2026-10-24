import { afterEach, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { close, continueTrace, flush, init, startSpan, wrapRouteHandlerWithSentry } from "@sentry/nextjs";
import type { Envelope, ErrorEvent } from "@sentry/core";
import { privateErrorEvent, sentryOptions } from "@/lib/observability/sentry.runtime.mjs";
import { verificationResponse } from "@/features/identity-verification/server/verification-diagnostics";

const dsn = "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456";
const privateValue = "PRIVATE_CANDIDATE_SENTINEL_918273";
afterEach(async () => { await close(2000); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function setup() {
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
  const sent: Envelope[] = [];
  init({ ...sentryOptions(), transport: () => ({ send: async (envelope: Envelope) => { sent.push(envelope); return { statusCode: 200 }; }, flush: async () => true }) });
  return sent;
}
const errors = (sent: Envelope[]): ErrorEvent[] => {
  const result: ErrorEvent[] = [];
  for (const [, items] of sent) for (const [header, payload] of items) if (header.type === "event") result.push(payload as ErrorEvent);
  return result;
};
const spanCount = (sent: Envelope[]) => {
  let count = 0;
  for (const [, items] of sent) for (const [header] of items) if (header.type === "span") count++;
  return count;
};

it("captures handled verification failures through the actual SDK route wrapper with a safe reference", async () => {
  const sent = setup();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const wrapped = wrapRouteHandlerWithSentry((request: Request) => { void request; return verificationResponse("check-result", async () => {
    throw new Error(privateValue);
  }); }, { method: "POST", parameterizedRoute: "/api/identity-verification/check-result", headers: new Headers() });
  const response = await wrapped(new Request("https://app.test/api/identity-verification/check-result"));
  await flush(2000);
  expect(response.status).toBe(503);
  expect(errors(sent)).toHaveLength(1);
  expect(errors(sent)[0]).toMatchObject({ tags: {
    "vivintro.operation": "verification.check-result", "vivintro.code": "IDENTITY_VERIFICATION_REQUEST_FAILED",
    "vivintro.reference": response.headers.get("X-Request-Id"),
  } });
  expect(JSON.stringify(sent)).not.toContain(privateValue);
});

it("keeps successful and expected client failures out of error monitoring", async () => {
  const sent = setup();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const status of [200, 400, 401, 403, 409, 429]) {
    await verificationResponse("start", async () => Response.json({ code: privateValue }, { status }));
  }
  await flush(2000);
  expect(errors(sent)).toHaveLength(0);
});

it("preserves distinct unsupported artifact identities and matching debug images without private paths", () => {
  const filenames = [`app:///server/chunks/${privateValue}/one.js`, `app:///server/chunks/${privateValue}/two.js`];
  const result = privateErrorEvent({ type: undefined, exception: { values: [{ type: "Error", stacktrace: { frames: filenames.map(filename => ({ filename, lineno: 10, colno: 2 })) } }] },
    debug_meta: { images: filenames.map((code_file, i) => ({ type: "sourcemap" as const, code_file, debug_id: `${i + 1}1111111-1111-4111-8111-111111111111` })) } }, {});
  const frames = result.exception!.values![0].stacktrace!.frames!;
  expect(new Set(frames.map(frame => frame.filename)).size).toBe(2);
  expect(result.debug_meta!.images!.map(image => image.type === "sourcemap" && image.code_file)).toEqual(frames.map(frame => frame.filename));
  expect(JSON.stringify(result)).not.toContain(privateValue);
});

it.each([
  { localRandom: 0.9, incoming: "1", baggageRandom: "0", expected: 0 },
  { localRandom: 0.01, incoming: "0", baggageRandom: "1", expected: 1 },
])("uses a local sampling decision despite parent $incoming and baggage random $baggageRandom", async ({ localRandom, incoming, baggageRandom, expected }) => {
  vi.stubEnv("NODE_ENV", "production");
  const sent = setup();
  vi.spyOn(Math, "random").mockReturnValue(localRandom);
  await continueTrace({ sentryTrace: `${"a".repeat(32)}-${"b".repeat(16)}-${incoming}`,
    baggage: `sentry-trace_id=${"a".repeat(32)},sentry-public_key=${"a".repeat(32)},sentry-sample_rand=${baggageRandom},sentry-sample_rate=1,sentry-sampled=${incoming === "1"}` },
  () => startSpan({ name: "/account", op: "http.server" }, () => undefined));
  await flush(2000);
  expect(spanCount(sent)).toBe(expected);
  if (expected) expect(sent.find(([, items]) => items.some(([header]) => header.type === "span"))?.[0].trace).toMatchObject({ sampled: "true", sample_rate: "0.1" });
});

it.each([
  { localRandom: 0.9, incoming: "1", baggageRandom: "0", expected: 0 },
  { localRandom: 0.01, incoming: "0", baggageRandom: "1", expected: 1 },
])("applies local sampling to Next's real OTel remote-parent scope (parent=$incoming)", ({ localRandom, incoming, baggageRandom, expected }) => {
  const runtime = new URL("../src/lib/observability/sentry.runtime.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module"], { encoding: "utf8", timeout: 15_000,
    env: { PATH: process.env.PATH, NODE_ENV: "production", NEXT_PUBLIC_SENTRY_DSN: dsn },
    input: `
      import Sentry from "@sentry/nextjs";
      import {context,trace,ROOT_CONTEXT} from "@opentelemetry/api";
      import {SentryPropagator} from "@sentry/opentelemetry";
      import {sentryOptions} from ${JSON.stringify(runtime)};
      const sent=[];
      Sentry.init({...sentryOptions(), transport:()=>({send:async e=>{sent.push(e);return {statusCode:200}},flush:async()=>true})});
      Math.random=()=>${localRandom};
      const carrier={"sentry-trace":"${"a".repeat(32)}-${"b".repeat(16)}-${incoming}",
        baggage:"sentry-trace_id=${"a".repeat(32)},sentry-public_key=${"a".repeat(32)},sentry-sample_rand=${baggageRandom},sentry-sample_rate=1,sentry-sampled=${incoming === "1"}"};
      const remote=new SentryPropagator().extract(ROOT_CONTEXT,carrier,{get:(c,k)=>c[k],keys:c=>Object.keys(c)});
      context.with(remote,()=>trace.getTracer("next-request-fixture").startActiveSpan("/account",span=>span.end()));
      await Sentry.close(2000);
      console.log(JSON.stringify(sent));
    `,
  });
  expect(child.error).toBeUndefined();
  expect(child.status, child.stderr).toBe(0);
  const sent: Envelope[] = JSON.parse(child.stdout.trim());
  expect(spanCount(sent)).toBe(expected);
  if (expected) expect(sent[0][0].trace).toMatchObject({ sampled: "true", sample_rate: "0.1" });
});
