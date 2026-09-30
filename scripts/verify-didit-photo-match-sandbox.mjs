import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const BASE = "https://verification.didit.me/v3/session";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function failure(code) {
  return new Error(code);
}

async function request(fetchImpl, url, options) {
  try {
    return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw failure("DIDIT_SANDBOX_REQUEST_FAILED");
  }
}

/** Proves a sandbox workflow accepts a supplied reference; always purges an issued session. */
export async function verifyPhotoMatchSandbox({ apiKey, workflowId, portrait, fetchImpl = fetch }) {
  if (!apiKey || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(workflowId ?? "")) {
    throw failure("DIDIT_SANDBOX_CONFIG_INVALID");
  }
  if (!Buffer.isBuffer(portrait) || portrait.length === 0 || portrait.length > MAX_IMAGE_BYTES) {
    throw failure("DIDIT_SANDBOX_REFERENCE_INVALID");
  }

  let sessionId;
  try {
    // A live Didit application rejects sandbox_scenario, preventing accidental live creation.
    const response = await request(fetchImpl, `${BASE}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: `nak60-sandbox:${randomUUID()}`,
        portrait_image: portrait.toString("base64"),
        sandbox_scenario: "approve",
      }),
    });
    if (response.status !== 201) throw failure("DIDIT_SANDBOX_CREATE_FAILED");
    const body = await response.json().catch(() => null);
    if (typeof body?.session_id === "string" && /^[a-zA-Z0-9-]{8,128}$/.test(body.session_id)) {
      sessionId = body.session_id;
    }
    if (!sessionId || body.workflow_id !== workflowId
      || !Number.isSafeInteger(body.workflow_version) || body.workflow_version < 1
      || typeof body.url !== "string" || new URL(body.url).origin !== "https://verify.didit.me") {
      throw failure("DIDIT_SANDBOX_RESPONSE_INVALID");
    }
    return { workflowVersion: body.workflow_version };
  } finally {
    if (sessionId) {
      let deleted;
      try {
        deleted = await request(fetchImpl, `${BASE}/${encodeURIComponent(sessionId)}/delete/`, {
          method: "DELETE",
          headers: { "x-api-key": apiKey },
        });
      } catch {
        throw failure("DIDIT_SANDBOX_PURGE_FAILED");
      }
      if (![204, 404].includes(deleted.status)) {
        throw failure("DIDIT_SANDBOX_PURGE_FAILED");
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [portraitPath] = process.argv.slice(2);
  try {
    if (!portraitPath) throw failure("DIDIT_SANDBOX_REFERENCE_PATH_REQUIRED");
    const portrait = await readFile(portraitPath);
    await verifyPhotoMatchSandbox({
      apiKey: process.env.DIDIT_SANDBOX_API_KEY,
      workflowId: process.env.DIDIT_SANDBOX_PHOTO_MATCH_WORKFLOW_ID,
      portrait,
    });
    process.stdout.write("Document-free Didit Sandbox create-and-delete contract passed.\n");
  } catch (error) {
    const code = error instanceof Error && /^DIDIT_SANDBOX_[A-Z_]+$/.test(error.message)
      ? error.message : "DIDIT_SANDBOX_CONTRACT_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
