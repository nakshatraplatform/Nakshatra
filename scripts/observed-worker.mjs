import http from "node:http";
import https from "node:https";
import { close, init, makeNodeTransport } from "@sentry/node";
import { sentryOptions } from "../src/lib/observability/sentry.runtime.mjs";
import { sentryEnvironment } from "../src/lib/observability/sentry-config.runtime.mjs";
import { observeOperation, reportOperationFailure } from "../src/lib/observability/operations.mjs";

/** Bound the actual request, including DNS/TLS and response-body stalls, not just SDK flush. */
export function workerTransport(options) {
  const nativeHttp = new URL(options.url).protocol === "https:" ? https : http;
  return makeNodeTransport({ ...options, keepAlive: false, httpModule: {
    request(requestOptions, callback) {
      // Own the direct socket: a proxy agent can hide an unfinished CONNECT socket from destroy().
      const request = nativeHttp.request({ ...requestOptions, agent: false }, callback);
      const deadline = setTimeout(() => request.destroy(new Error("TELEMETRY_TIMEOUT")), 1500);
      request.once("close", () => clearTimeout(deadline));
      return request;
    },
  } });
}

/** Shared native-Node lifecycle. The optional transport is for isolated boundary tests. */
export async function runObservedWorker(operation, run, { transport } = {}) {
  try {
    init({ ...sentryOptions(),
      environment: sentryEnvironment(process.env.SENTRY_ENVIRONMENT, "production"),
      release: process.env.SENTRY_RELEASE || process.env.GITHUB_SHA || undefined,
      transport: transport ?? workerTransport,
    });
  } catch { /* Monitoring must not prevent required cleanup work. */ }
  try {
    return await observeOperation(operation, run);
  } catch (error) {
    reportOperationFailure(operation, error, { code: error instanceof Error ? error.message : undefined });
    throw error;
  } finally {
    try { await close(2000); } catch { /* Preserve the job's original result. */ }
  }
}
