import { z } from "zod/v4";

// Runtime-neutral candidate boundary: Next's server adapter and the Node worker
// must request and validate the same metadata. Credentials belong to callers.
const BASE = "https://verification.didit.me/v3/session";
export const DIDIT_BODY_LIMIT = 262144;
export const DIDIT_SESSION_ABSENT = Symbol("Didit session absent");
const checkStatuses = new Set(["APPROVED", "DECLINED", "IN_REVIEW", "NOT_STARTED", "IN_PROGRESS", "RESUBMITTED", "EXPIRED", "ABANDONED", "KYC_EXPIRED"]);
const check = z.object({ status: z.string().transform(normalizeDiditStatus).refine(value => checkStatuses.has(value)) });
const checks = z.array(check).max(100).nullish();
const schema = z.object({
  session_id: z.uuid(), workflow_id: z.uuid(), workflow_version: z.number().int().positive().safe(),
  vendor_data: z.string().min(1).max(512), status: z.string(),
  session_kind: z.literal("user").optional(), session_url: z.string().max(4096).nullish(),
  features: z.array(z.union([z.string(), z.object({ feature: z.string() })])).max(100).optional(),
  liveness_checks: checks, ip_analyses: checks, id_verifications: checks, face_matches: checks,
});
const resumable = new Set(["NOT_STARTED", "IN_PROGRESS", "RESUBMITTED"]);
const terminalOrReview = new Set(["APPROVED", "DECLINED", "EXPIRED", "ABANDONED", "KYC_EXPIRED", "IN_REVIEW"]);

export class DiditCandidateError extends Error {
  constructor(code, httpStatus) { super(code); this.httpStatus = httpStatus; }
}

export function normalizeDiditStatus(value) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
}

/** Expanded decisions can contain camera evidence; discard everything not needed. */
export function parseCandidateDecision(raw, expected) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new DiditCandidateError("DIDIT_DECISION_INVALID");
  const decision = parsed.data;
  if (decision.session_id !== expected.sessionId || decision.workflow_id !== expected.workflowId
    || decision.vendor_data !== expected.vendorData
    || (expected.workflowVersion != null && decision.workflow_version !== expected.workflowVersion)) {
    throw new DiditCandidateError("DIDIT_DECISION_MISMATCH");
  }
  const status = normalizeDiditStatus(decision.status);
  if (!resumable.has(status) && !terminalOrReview.has(status)) {
    throw new DiditCandidateError("DIDIT_DECISION_STATUS_INVALID");
  }
  return { ...decision, status, features: decision.features?.map(value => typeof value === "string" ? value : value.feature) };
}

export function candidateHostedUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://verify.didit.me" || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new DiditCandidateError("DIDIT_HOSTED_URL_INVALID"); }
}

/** Shared finite transport; no raw response or nested error can escape this boundary. */
export async function candidateDiditRequest(url, { apiKey, fetchImpl = fetch, timeoutMs = 10000, allowMissing = false, expectedStatus = undefined, ...init }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    const response = await fetchImpl(url, { ...init,
      headers: { ...init.headers, Accept: "application/json", "x-api-key": apiKey },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    reader = response.body?.getReader();
    if (allowMissing && response.status === 404) return DIDIT_SESSION_ABSENT;
    if (response.ok && expectedStatus != null && response.status !== expectedStatus) throw new DiditCandidateError("DIDIT_PROVIDER_REJECTED", response.status);
    if (!response.ok && response.status !== 400) {
      const code = response.status === 401 || response.status === 403 ? "DIDIT_CREDENTIALS_INVALID"
        : response.status === 429 ? "DIDIT_RATE_LIMITED"
        : response.status === 404 ? "DIDIT_SESSION_MISSING" : "DIDIT_PROVIDER_REJECTED";
      // Do not parse/log arbitrary provider error text as an application message.
      throw new DiditCandidateError(code, response.status);
    }
    if (!reader) throw new DiditCandidateError("DIDIT_DECISION_INVALID");
    const decoder = new TextDecoder(); let text = ""; let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > DIDIT_BODY_LIMIT) throw new DiditCandidateError("DIDIT_RESPONSE_TOO_LARGE");
      text += decoder.decode(value, { stream: true });
    }
    let payload;
    try { payload = JSON.parse(text + decoder.decode()); }
    catch { throw new DiditCandidateError(response.ok ? "DIDIT_DECISION_INVALID" : "DIDIT_PROVIDER_REJECTED", response.status); }
    if (!response.ok) {
      // Only this known provider condition is classified; never forward its text.
      const credits = typeof payload?.detail === "string"
        && payload.detail.startsWith("You don't have enough credits to perform this request.");
      throw new DiditCandidateError(credits ? "DIDIT_CREDITS_UNAVAILABLE" : "DIDIT_PROVIDER_REJECTED", response.status);
    }
    return payload;
  } catch (error) {
    if (error instanceof DiditCandidateError) throw error;
    throw new DiditCandidateError(controller.signal.aborted ? "DIDIT_REQUEST_TIMEOUT" : "DIDIT_PROVIDER_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
    if (reader) void reader.cancel().catch(() => {});
  }
}

export async function fetchCandidateDecision(expected, options) {
  const raw = await candidateDiditRequest(`${BASE}/${encodeURIComponent(expected.sessionId)}/decision/?include=events`, options);
  return parseCandidateDecision(raw, expected);
}

export function candidateResumeResult(decision) {
  if (terminalOrReview.has(decision.status)) return { awaitingResult: true };
  return { awaitingResult: false, url: candidateHostedUrl(decision.session_url) };
}
