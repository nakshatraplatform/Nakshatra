// @ts-check
import { sentryEnvironment, sentryIngestOrigin } from "./sentry-config.runtime.mjs";
import { getCurrentScope } from "@sentry/core";
import { approvedOperation, approvedCode, approvedReference } from "./operation-contract.mjs";

export const VERIFICATION_MESSAGE = "VivIntro Sentry verification error";
const errorTypes = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError"]);
const segments = new Set(["api", "account", "admin", "auth", "access", "dashboard", "edit", "preview", "approved-preview", "p", "verify", "verification", "result", "link", "start", "status", "cancel", "reconcile", "identity-verification", "media", "photos", "horoscope", "portfolio", "interest", "interests", "requests", "consent", "publication", "notifications", "internal", "production-maintenance", "relationship-notifications", "brokerdesk", "w", "settings", "team", "login", "signup", "reset-password", "about", "privacy", "terms", "trust", "demo", "brokers", "join", "customer", "invite", "pilot-access", "onboarding-feedback", "received-a-link", "waitlist"]);

/** Keep static route labels, never a name, token, query, fragment or external host. */
/** @param {string | undefined} value */
export function telemetryRoute(value) {
  if (!value) return "/[redacted]";
  try {
    const path = new URL(value.replace(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/, ""), "https://telemetry.invalid").pathname;
    return path.split("/").slice(0, 16).map(segment => !segment || segments.has(segment) ? segment : "[redacted]").join("/");
  } catch {
    return "/[redacted]";
  }
}

/** @param {import("@sentry/core").StackFrame} frame @param {Map<string, string>} aliases @returns {import("@sentry/core").StackFrame} */
function diagnosticFrame(frame, aliases) {
  // Retain artifact-relative paths for symbolication, without local user directories.
  const filename = frame.filename?.split(/[?#]/, 1)[0];
  const match = filename?.match(/(?:^|\/)((?:src|node_modules|_next|\.next)\/[^\s]*)$/);
  return {
    filename: match ? `app:///${match[1]}` : artifactAlias(filename, aliases),
    function: frame.function && /^[\w.$<> /-]{1,160}$/.test(frame.function) ? frame.function : undefined,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
    debug_id: frame.debug_id,
  };
}

/** Unknown files use their debug ID, or an event-local identity. Neither exposes the original path.
 * @param {string | undefined} filename @param {Map<string, string>} aliases
 */
function artifactAlias(filename, aliases) {
  if (!filename) return "app:///[redacted]";
  if (!aliases.has(filename)) aliases.set(filename, `app:///artifact/unknown-${aliases.size + 1}.js`);
  return aliases.get(filename);
}

/** Rebuild rather than denylist: new SDK context fields must not silently expose data. */
/** @param {import("@sentry/core").ErrorEvent} event @param {import("@sentry/core").EventHint} hint @returns {import("@sentry/core").ErrorEvent} */
export function privateErrorEvent(event, hint) {
  hint.attachments = [];
  const trace = event.contexts?.trace;
  const aliases = new Map();
  for (const image of event.debug_meta?.images ?? []) {
    if (image.type === "sourcemap" && image.code_file && /^[a-f0-9-]{36}$/i.test(image.debug_id ?? "")) {
      aliases.set(image.code_file.split(/[?#]/, 1)[0], `app:///artifact/${image.debug_id}.js`);
    }
  }
  const operation = approvedOperation(event.tags?.["vivintro.operation"]);
  const code = approvedCode(event.tags?.["vivintro.code"]);
  const reference = approvedReference(event.tags?.["vivintro.reference"]);
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: event.platform,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    ...(operation ? { tags: { "vivintro.operation": operation, "vivintro.code": code, ...(reference ? { "vivintro.reference": reference } : {}) },
      fingerprint: ["{{ default }}", operation, code] } : {}),
    debug_meta: event.debug_meta ? { images: event.debug_meta.images?.flatMap(image => image.type === "sourcemap"
      ? [{ type: /** @type {const} */ ("sourcemap"), debug_id: image.debug_id, code_file: diagnosticFrame({ filename: image.code_file }, aliases).filename ?? "app:///[redacted]" }] : []) } : undefined,
    transaction: telemetryRoute(event.transaction),
    request: event.request ? { url: telemetryRoute(event.request.url), method: event.request.method } : undefined,
    contexts: trace ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id, parent_span_id: trace.parent_span_id } } : undefined,
    exception: event.exception ? { values: event.exception.values?.slice(-5).map(exception => ({
      type: errorTypes.has(exception.type ?? "") ? exception.type : "Error",
      value: exception.value === VERIFICATION_MESSAGE ? VERIFICATION_MESSAGE : "Application error (message redacted)",
      mechanism: exception.mechanism ? { type: "generic", handled: exception.mechanism.handled } : undefined,
      stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.slice(-50).map(frame => diagnosticFrame(frame, aliases)) } : undefined,
    })) } : undefined,
  };
}

/** @param {import("@sentry/core").StreamedSpanJSON} span @returns {import("@sentry/core").StreamedSpanJSON} */
export function privateSpan(span) {
  /** @type {import("@sentry/core").StreamedSpanJSON["attributes"]} */
  const attributes = {
    "sentry.environment": sentryEnvironment(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT, process.env.NODE_ENV || "production"),
    ...((process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || process.env.GITHUB_SHA) ? { "sentry.release": process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || process.env.GITHUB_SHA } : {}),
  };
  for (const key of ["http.response.status_code", "http.status_code", "sentry.sample_rate"]) {
    if (typeof span.attributes[key] === "number") attributes[key] = span.attributes[key];
  }
  const operation = approvedOperation(span.attributes["vivintro.operation"]);
  if (operation) attributes["vivintro.operation"] = operation;
  const op = span.attributes["sentry.op"];
  if (typeof op === "string" && /^(http\.(client|server)|pageload|navigation|resource\.(script|css|img|fetch|other)|ui\.(click|react\.render)|function|db|middleware|nextjs\.[a-z.]+)$/.test(op)) {
    attributes["sentry.op"] = op;
  }
  // Names can include SQL, DOM text or concrete URLs; preserve only normalized route names.
  const name = span.name.replace(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/, "");
  return {
    trace_id: span.trace_id, span_id: span.span_id, parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp, end_timestamp: span.end_timestamp,
    status: span.status, is_segment: span.is_segment,
    name: operation ?? (name.startsWith("/") || /^https?:\/\//.test(name) ? telemetryRoute(name) : String(attributes["sentry.op"] ?? "application.operation")),
    attributes,
  };
}

/** DSC names and attachments bypass beforeSend; constrain the final SDK envelope too. */
/** @type {import("@sentry/core").Integration} */
const privacyIntegration = {
  name: "VivIntroPrivacy",
  setup(client) {
    client.on("prepareSpanScope", ({ scope }) => {
      // Node/Next OTel remaps remote parents onto a cloned scope before sampling.
      scope.setPropagationContext({ ...scope.getPropagationContext(), sampleRand: Math.random() });
    });
    client.on("beforeSampling", () => {
      // SDK 11.8 otherwise uses the remote baggage sample_rand even with a local sampler.
      const scope = getCurrentScope();
      scope.setPropagationContext({ ...scope.getPropagationContext(), sampleRand: Math.random() });
    });
    client.on("beforeEnvelope", envelope => {
      const trace = envelope[0].trace;
      if (trace && typeof trace === "object") {
        const context = /** @type {Record<string, unknown>} */ (trace);
        envelope[0].trace = {
          trace_id: typeof context.trace_id === "string" && /^[a-f0-9]{32}$/.test(context.trace_id) ? context.trace_id : undefined,
          public_key: client.getDsn()?.publicKey,
          sampled: envelope[1].some(([header]) => header.type === "span") ? "true"
            : context.sampled === "true" || context.sampled === "false" ? context.sampled : undefined,
          sample_rate: typeof context.sample_rate === "string" && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(context.sample_rate) ? context.sample_rate : undefined,
        };
      }
      for (let i = envelope[1].length - 1; i >= 0; i--) {
        const type = envelope[1][i][0].type;
        if (type !== "event" && type !== "span") envelope[1].splice(i, 1);
      }
    });
  },
};

export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  /** @satisfies {import("@sentry/node").NodeOptions} */
  const options = {
    dsn: sentryIngestOrigin(dsn) ? dsn : undefined,
    enabled: Boolean(sentryIngestOrigin(dsn)),
    environment: sentryEnvironment(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT, process.env.NODE_ENV || "production"),
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || process.env.GITHUB_SHA || undefined,
    tracesSampler: () => process.env.NODE_ENV === "development" ? 1 : 0.1,
    tracePropagationTargets: [],
    sendClientReports: false,
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
      urlQueryParams: false, graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false }, databaseQueryData: false,
      queues: false, stackFrameVariables: false, frameContextLines: 0,
    },
    integrations: [privacyIntegration],
    beforeSend: privateErrorEvent,
    beforeSendSpan: privateSpan,
    beforeBreadcrumb: () => null,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
  };
  return options;
}
