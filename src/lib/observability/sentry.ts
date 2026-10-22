import type { ErrorEvent, EventHint, Integration, StackFrame, StreamedSpanJSON } from "@sentry/core";
import { sentryEnvironment, sentryIngestOrigin } from "./sentry-config";

export const VERIFICATION_MESSAGE = "VivIntro Sentry verification error";
const errorTypes = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError"]);
const segments = new Set(["api", "account", "admin", "auth", "access", "dashboard", "edit", "preview", "approved-preview", "p", "verify", "verification", "result", "link", "start", "status", "cancel", "reconcile", "identity-verification", "media", "photos", "horoscope", "portfolio", "interest", "interests", "requests", "consent", "publication", "notifications", "internal", "production-maintenance", "relationship-notifications", "brokerdesk", "w", "settings", "team", "login", "signup", "reset-password", "about", "privacy", "terms", "trust", "demo", "brokers", "join", "customer", "invite", "pilot-access", "onboarding-feedback", "received-a-link", "waitlist"]);

/** Keep static route labels, never a name, token, query, fragment or external host. */
export function telemetryRoute(value: string | undefined): string {
  if (!value) return "/[redacted]";
  try {
    const path = new URL(value.replace(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/, ""), "https://telemetry.invalid").pathname;
    return path.split("/").slice(0, 16).map(segment => !segment || segments.has(segment) ? segment : "[redacted]").join("/");
  } catch {
    return "/[redacted]";
  }
}

function diagnosticFrame(frame: StackFrame): StackFrame {
  // Retain artifact-relative paths for symbolication, without local user directories.
  const filename = frame.filename?.split(/[?#]/, 1)[0];
  const match = filename?.match(/(?:^|\/)((?:src|node_modules|_next|\.next)\/[^\s]*)$/);
  return {
    filename: match ? `app:///${match[1]}` : "app:///[redacted]",
    function: frame.function && /^[\w.$<> /-]{1,160}$/.test(frame.function) ? frame.function : undefined,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
    debug_id: frame.debug_id,
  };
}

/** Rebuild rather than denylist: new SDK context fields must not silently expose data. */
export function privateErrorEvent(event: ErrorEvent, hint: EventHint): ErrorEvent {
  hint.attachments = [];
  const trace = event.contexts?.trace;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: event.platform,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta ? { images: event.debug_meta.images?.flatMap(image => image.type === "sourcemap"
      ? [{ type: "sourcemap" as const, debug_id: image.debug_id, code_file: diagnosticFrame({ filename: image.code_file }).filename! }] : []) } : undefined,
    transaction: telemetryRoute(event.transaction),
    request: event.request ? { url: telemetryRoute(event.request.url), method: event.request.method } : undefined,
    contexts: trace ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id, parent_span_id: trace.parent_span_id } } : undefined,
    exception: event.exception ? { values: event.exception.values?.slice(-5).map(exception => ({
      type: errorTypes.has(exception.type ?? "") ? exception.type : "Error",
      value: exception.value === VERIFICATION_MESSAGE ? VERIFICATION_MESSAGE : "Application error (message redacted)",
      mechanism: exception.mechanism ? { type: "generic", handled: exception.mechanism.handled } : undefined,
      stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.slice(-50).map(diagnosticFrame) } : undefined,
    })) } : undefined,
  };
}

export function privateSpan(span: StreamedSpanJSON): StreamedSpanJSON {
  const attributes: StreamedSpanJSON["attributes"] = {
    "sentry.environment": sentryEnvironment(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT, process.env.NODE_ENV),
    ...(process.env.NEXT_PUBLIC_SENTRY_RELEASE ? { "sentry.release": process.env.NEXT_PUBLIC_SENTRY_RELEASE } : {}),
  };
  for (const key of ["http.response.status_code", "http.status_code", "sentry.sample_rate"]) {
    if (typeof span.attributes[key] === "number") attributes[key] = span.attributes[key];
  }
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
    name: name.startsWith("/") || /^https?:\/\//.test(name) ? telemetryRoute(name) : String(attributes["sentry.op"] ?? "application.operation"),
    attributes,
  };
}

/** DSC names and attachments bypass beforeSend; constrain the final SDK envelope too. */
const privacyIntegration: Integration = {
  name: "VivIntroPrivacy",
  setup(client) {
    client.on("beforeEnvelope", envelope => {
      const trace = envelope[0].trace;
      if (trace && typeof trace === "object") {
        const context = trace as Record<string, unknown>;
        envelope[0].trace = {
          trace_id: typeof context.trace_id === "string" && /^[a-f0-9]{32}$/.test(context.trace_id) ? context.trace_id : undefined,
          public_key: client.getDsn()?.publicKey,
          sampled: context.sampled === "true" || context.sampled === "false" ? context.sampled : undefined,
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
  return {
    dsn: sentryIngestOrigin(dsn) ? dsn : undefined,
    enabled: Boolean(sentryIngestOrigin(dsn)),
    environment: sentryEnvironment(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT, process.env.NODE_ENV),
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
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
}
