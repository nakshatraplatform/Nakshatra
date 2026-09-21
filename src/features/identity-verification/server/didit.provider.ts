import "server-only";

import { z } from "zod/v4";

const diditConfigSchema = z.object({
  DIDIT_API_KEY: z.string().trim().min(1, "DIDIT_API_KEY is required"),
  DIDIT_WORKFLOW_ID: z.uuid("DIDIT_WORKFLOW_ID must be a UUID"),
});

const diditSessionSchema = z.object({
  session_id: z.string().min(8).max(128),
  url: z.url(),
}).passthrough();

const diditHostedOrigin = "https://verify.didit.me";
const providerRequestTimeoutMs = 10_000;

export type DiditProviderDiagnosticCode =
  | "configuration_invalid"
  | "details_invalid"
  | "request_failed"
  | "request_timeout"
  | "request_rejected"
  | "credentials_rejected"
  | "rate_limited"
  | "provider_unavailable"
  | "response_invalid"
  | "host_invalid";

export class DiditProviderError extends Error {
  constructor(
    readonly diagnosticCode: DiditProviderDiagnosticCode,
    readonly code = "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE"
  ) {
    super(code);
    this.name = "DiditProviderError";
  }
}

function getDiditConfig() {
  const parsed = diditConfigSchema.safeParse({
    DIDIT_API_KEY: process.env.DIDIT_API_KEY,
    DIDIT_WORKFLOW_ID: process.env.DIDIT_WORKFLOW_ID,
  });
  if (!parsed.success) throw new DiditProviderError("configuration_invalid");
  return parsed.data;
}

function expectedName(legalName: string) {
  const names = legalName.trim().split(/\s+/).filter(Boolean);
  const firstName = names.shift();
  if (!firstName) {
    throw new DiditProviderError("details_invalid", "IDENTITY_VERIFICATION_DETAILS_UNAVAILABLE");
  }
  return { first_name: firstName, ...(names.length > 0 ? { last_name: names.join(" ") } : {}) };
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerRequestTimeoutMs);
  try {
    const response = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.DIDIT_API_KEY },
      body: JSON.stringify({
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
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new DiditProviderError(classifyProviderStatus(response.status));

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DiditProviderError(controller.signal.aborted ? "request_timeout" : "response_invalid");
    }
    const parsed = diditSessionSchema.safeParse(payload);
    if (!parsed.success) throw new DiditProviderError("response_invalid");
    if (new URL(parsed.data.url).origin !== diditHostedOrigin) throw new DiditProviderError("host_invalid");
    return { sessionId: parsed.data.session_id, url: parsed.data.url };
  } catch (error) {
    if (error instanceof DiditProviderError) throw error;
    throw new DiditProviderError(controller.signal.aborted ? "request_timeout" : "request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

function classifyProviderStatus(status: number): DiditProviderDiagnosticCode {
  if (status === 403) return "credentials_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "request_rejected";
}
