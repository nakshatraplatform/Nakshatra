import "server-only";

import { z } from "zod/v4";

const diditConfigSchema = z.object({
  DIDIT_API_KEY: z.string().min(1, "DIDIT_API_KEY is required"),
  DIDIT_WORKFLOW_ID: z.uuid("DIDIT_WORKFLOW_ID must be a UUID"),
});

const diditSessionSchema = z.object({
  session_id: z.string().min(8).max(128),
  url: z.url(),
}).passthrough();

const candidateSessionSchema = diditSessionSchema.extend({
  session_id: z.uuid(),
  workflow_id: z.uuid(),
  workflow_version: z.number().int().positive(),
});

const DIDIT_TIMEOUT_MS = 10_000;

const diditHostedOrigin = "https://verify.didit.me";

export class DiditProviderError extends Error {
  constructor(readonly code = "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE") {
    super(code);
  }
}

/** A created provider session still needs deletion. Keep its recovery handle out of serialized errors. */
export class DiditProviderCleanupError extends DiditProviderError {
  #sessionId: string;

  constructor(sessionId: string) {
    super("IDENTITY_VERIFICATION_PROVIDER_CLEANUP_FAILED");
    this.#sessionId = sessionId;
  }

  get sessionId() {
    return this.#sessionId;
  }
}

function getDiditConfig() {
  const parsed = diditConfigSchema.safeParse({
    DIDIT_API_KEY: process.env.DIDIT_API_KEY,
    DIDIT_WORKFLOW_ID: process.env.DIDIT_WORKFLOW_ID,
  });
  if (!parsed.success) throw new DiditProviderError("IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE");
  return parsed.data;
}

function expectedName(legalName: string) {
  const names = legalName.trim().split(/\s+/).filter(Boolean);
  const firstName = names.shift();
  if (!firstName) throw new DiditProviderError("IDENTITY_VERIFICATION_DETAILS_UNAVAILABLE");
  return { first_name: firstName, ...(names.length > 0 ? { last_name: names.join(" ") } : {}) };
}

export function getCandidateVerificationConfig() {
  const parsed = z.uuid().safeParse(process.env.DIDIT_WORKFLOW_ID?.trim());
  if (!parsed.success) throw new DiditProviderError("IDENTITY_VERIFICATION_CONFIGURATION_INVALID");
  return { ...getDiditConfigForKey(), workflowId: parsed.data };
}

function getDiditConfigForKey() {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  if (!apiKey) throw new DiditProviderError("IDENTITY_VERIFICATION_CONFIGURATION_INVALID");
  return { apiKey };
}

async function postSession(body: Record<string, unknown>, timeoutMs?: number) {
  // The existing ID route has no durable uncertain-create reconciliation yet.
  // Keep its pre-existing request behavior; the candidate adapter
  // uses a bounded create request with its durable recovery queue.
  const controller = timeoutMs === undefined ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": getDiditConfigForKey().apiKey },
      body: JSON.stringify(body),
      cache: "no-store",
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? "IDENTITY_VERIFICATION_PROVIDER_CREDENTIALS"
        : response.status === 429 ? "IDENTITY_VERIFICATION_PROVIDER_RATE_LIMITED"
        : "IDENTITY_VERIFICATION_PROVIDER_REJECTED";
      throw new DiditProviderError(code);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof DiditProviderError) throw error;
    throw new DiditProviderError(controller?.signal.aborted
      ? "IDENTITY_VERIFICATION_PROVIDER_TIMEOUT"
      : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function purgeUnattachedCandidateSession(sessionId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIDIT_TIMEOUT_MS);
  try {
    const response = await fetch(`https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/delete/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": getDiditConfigForKey().apiKey },
      body: JSON.stringify({ retain_face_embeddings: false }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status !== 200) throw new DiditProviderError();
    const outcome = await response.json();
    if (outcome?.session_id !== sessionId
      || !["deleted", "none"].includes(outcome?.face_retention_outcome)
      || outcome?.biometric_template_uuid != null) throw new DiditProviderError();
  } catch {
    throw new DiditProviderCleanupError(sessionId);
  } finally {
    clearTimeout(timeout);
  }
}

/** Starts the configured liveness-only workflow; Didit returns the session's actual version. */
export async function createDiditLivenessSession(input: {
  attemptId: string;
  providerSubjectRef: string;
  callbackUrl: string;
}) {
  const config = getCandidateVerificationConfig();
  const raw = await postSession({
    workflow_id: config.workflowId,
    vendor_data: `iv:${input.providerSubjectRef}:${input.attemptId}`,
    callback: input.callbackUrl,
    callback_method: "both",
    language: "en",
  }, DIDIT_TIMEOUT_MS);
  const parsed = candidateSessionSchema.safeParse(raw);
  const hostedOrigin = parsed.success ? new URL(parsed.data.url).origin : null;
  if (!parsed.success || parsed.data.workflow_id !== config.workflowId
    || hostedOrigin !== diditHostedOrigin) {
    const sessionId = z.uuid().safeParse((raw as { session_id?: unknown } | null)?.session_id);
    if (sessionId.success) await purgeUnattachedCandidateSession(sessionId.data);
    throw new DiditProviderError();
  }
  return {
    sessionId: parsed.data.session_id,
    url: parsed.data.url,
    workflowId: parsed.data.workflow_id,
    workflowVersion: parsed.data.workflow_version,
  };
}

/** Retrieves an existing hosted capability transiently; never creates or persists it. */
export async function retrieveDiditLivenessSession(input: {
  sessionId: string; workflowId: string; workflowVersion: number; vendorData: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIDIT_TIMEOUT_MS);
  try {
    const response = await fetch(`https://verification.didit.me/v3/session/${encodeURIComponent(input.sessionId)}/decision/`, {
      headers: { "x-api-key": getDiditConfigForKey().apiKey },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!response.ok) throw new DiditProviderError(response.status === 429
      ? "IDENTITY_VERIFICATION_PROVIDER_RATE_LIMITED" : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE");
    const reader = response.body?.getReader();
    if (!reader) throw new DiditProviderError();
    let text = ""; let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 262144) throw new DiditProviderError();
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel(); }
    const decision = z.object({ session_id: z.uuid(), workflow_id: z.uuid(), workflow_version: z.number().int().positive(),
      vendor_data: z.string(), status: z.string(), session_url: z.string().optional() }).parse(JSON.parse(text));
    if (decision.session_id !== input.sessionId || decision.workflow_id !== input.workflowId
      || decision.workflow_version !== input.workflowVersion || decision.vendor_data !== input.vendorData) throw new DiditProviderError();
    const status = decision.status.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (["APPROVED", "DECLINED", "EXPIRED", "ABANDONED", "KYC_EXPIRED", "IN_REVIEW"].includes(status)) return { awaitingResult: true as const };
    if (!["NOT_STARTED", "IN_PROGRESS", "CREATED"].includes(status)) throw new DiditProviderError();
    const url = new URL(decision.session_url ?? "");
    if (url.origin !== diditHostedOrigin || url.username || url.password) throw new DiditProviderError();
    return { awaitingResult: false as const, url: url.href };
  } catch (error) {
    if (error instanceof DiditProviderError) throw error;
    throw new DiditProviderError(controller.signal.aborted ? "IDENTITY_VERIFICATION_PROVIDER_TIMEOUT" : "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE");
  } finally { clearTimeout(timeout); }
}

/** Creates a Didit hosted session without retaining its session token or provider evidence. */
export async function createDiditVerificationSession(input: {
  attemptId: string;
  providerSubjectRef: string;
  legalName: string;
  birthDate: string;
  callbackUrl: string;
}) {
  const config = getDiditConfig();
  const raw = await postSession({
        workflow_id: config.DIDIT_WORKFLOW_ID,
        vendor_data: `iv:${input.providerSubjectRef}:${input.attemptId}`,
        callback: input.callbackUrl,
        callback_method: "both",
        language: "en",
        expected_details: {
          ...expectedName(input.legalName),
          date_of_birth: input.birthDate,
          id_country: "IND",
          expected_document_types: ["P", "ID"],
        },
  });
  const parsed = diditSessionSchema.safeParse(raw);
  if (!parsed.success || new URL(parsed.data.url).origin !== diditHostedOrigin) {
    throw new DiditProviderError();
  }
  return { sessionId: parsed.data.session_id, url: parsed.data.url };
}
