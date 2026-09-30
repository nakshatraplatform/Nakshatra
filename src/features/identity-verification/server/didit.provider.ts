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

const photoMatchSessionSchema = diditSessionSchema.extend({
  workflow_id: z.uuid(),
  workflow_version: z.number().int().positive(),
});

const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const DIDIT_TIMEOUT_MS = 10_000;

const diditHostedOrigin = "https://verify.didit.me";

export class DiditProviderError extends Error {
  constructor(readonly code = "IDENTITY_VERIFICATION_PROVIDER_UNAVAILABLE") {
    super(code);
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

function photoMatchConfig() {
  const parsed = z.uuid().safeParse(process.env.DIDIT_PHOTO_MATCH_WORKFLOW_ID?.trim());
  if (!parsed.success) throw new DiditProviderError();
  return { ...getDiditConfigForKey(), workflowId: parsed.data };
}

function getDiditConfigForKey() {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  if (!apiKey) throw new DiditProviderError();
  return { apiKey };
}

async function postSession(body: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIDIT_TIMEOUT_MS);
  try {
    const response = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": getDiditConfigForKey().apiKey },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new DiditProviderError();
    return await response.json();
  } catch {
    throw new DiditProviderError();
  } finally {
    clearTimeout(timeout);
  }
}

/** Starts an ID-free hosted workflow using only a server-supplied photo reference. */
export async function createDiditPhotoMatchSession(input: {
  attemptId: string;
  providerSubjectRef: string;
  callbackUrl: string;
  portraitImageBase64: string;
}) {
  const config = photoMatchConfig();
  const image = input.portraitImageBase64;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image)
    || image.length === 0
    || Buffer.from(image, "base64").length > MAX_REFERENCE_BYTES) {
    throw new DiditProviderError("IDENTITY_VERIFICATION_REFERENCE_UNAVAILABLE");
  }
  const raw = await postSession({
    workflow_id: config.workflowId,
    vendor_data: `iv:${input.providerSubjectRef}:${input.attemptId}`,
    callback: input.callbackUrl,
    callback_method: "both",
    language: "en",
    portrait_image: image,
  });
  const parsed = photoMatchSessionSchema.safeParse(raw);
  if (!parsed.success || parsed.data.workflow_id !== config.workflowId
    || new URL(parsed.data.url).origin !== diditHostedOrigin) {
    throw new DiditProviderError();
  }
  return {
    sessionId: parsed.data.session_id,
    url: parsed.data.url,
    workflowId: parsed.data.workflow_id,
    workflowVersion: parsed.data.workflow_version,
  };
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
