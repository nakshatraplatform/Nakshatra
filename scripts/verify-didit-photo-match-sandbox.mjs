import { randomUUID } from "node:crypto";
import { readFile, realpath, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE = "https://verification.didit.me/v3/session";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function failure(code) {
  return new Error(code);
}

async function request(fetchImpl, url, options) {
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(url, { ...options, signal, cache: "no-store" });
    return { response, body: await response.json().catch(() => null) };
  } catch {
    throw failure("DIDIT_SANDBOX_REQUEST_FAILED");
  }
}

/** Keeps the lookup correlation before POST, even when the provider response is lost. */
export function createSandboxRecoveryJournal(path) {
  if (!isAbsolute(path)) throw failure("DIDIT_SANDBOX_JOURNAL_INVALID");
  const file = resolve(path);
  const withinRepo = relative(REPO_ROOT, file);
  if (withinRepo === "" || (!withinRepo.startsWith(`..${sep}`) && withinRepo !== ".." && !isAbsolute(withinRepo))) {
    throw failure("DIDIT_SANDBOX_JOURNAL_INVALID");
  }
  async function validateLocation() {
    const parent = await realpath(dirname(file));
    const relativeParent = relative(REPO_ROOT, parent);
    const insideRepo = relativeParent === ""
      || (!relativeParent.startsWith(`..${sep}`) && relativeParent !== ".." && !isAbsolute(relativeParent));
    const info = await stat(parent);
    if (insideRepo || (info.mode & 0o077) !== 0
      || (typeof process.getuid === "function" && info.uid !== process.getuid())) {
      throw failure("DIDIT_SANDBOX_JOURNAL_INVALID");
    }
  }
  return {
    async record(entry) {
      await validateLocation();
      await writeFile(file, JSON.stringify(entry), { flag: "wx", mode: 0o600 });
    },
    async read() {
      await validateLocation();
      const info = await stat(file);
      if ((info.mode & 0o077) !== 0
        || (typeof process.getuid === "function" && info.uid !== process.getuid())) {
        throw failure("DIDIT_SANDBOX_JOURNAL_INVALID");
      }
      return JSON.parse(await readFile(file, "utf8"));
    },
    async complete() {
      await unlink(file);
    },
  };
}

/** Proves a sandbox workflow accepts a supplied reference; attempts purge of any issued session. */
export async function verifyPhotoMatchSandbox({ apiKey, workflowId, workflowVersion, portrait, journal, fetchImpl = fetch }) {
  if (!apiKey || !UUID_PATTERN.test(workflowId ?? "")
    || !Number.isSafeInteger(workflowVersion) || workflowVersion < 1) {
    throw failure("DIDIT_SANDBOX_CONFIG_INVALID");
  }
  if (!Buffer.isBuffer(portrait) || portrait.length === 0 || portrait.length > MAX_IMAGE_BYTES) {
    throw failure("DIDIT_SANDBOX_REFERENCE_INVALID");
  }
  if (typeof journal?.record !== "function" || typeof journal?.complete !== "function") {
    throw failure("DIDIT_SANDBOX_JOURNAL_REQUIRED");
  }

  const vendorData = `nak60-sandbox:${randomUUID()}`;
  await journal.record({ vendorData, workflowId, createdAt: new Date().toISOString() });
  let sessionId;
  try {
    // A live Didit application rejects sandbox_scenario, preventing accidental live creation.
    const { response, body } = await request(fetchImpl, `${BASE}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: vendorData,
        portrait_image: portrait.toString("base64"),
        sandbox_scenario: "approve",
      }),
    });
    if (response.status !== 201) throw failure("DIDIT_SANDBOX_CREATE_FAILED");
    if (typeof body?.session_id === "string" && UUID_PATTERN.test(body.session_id)) {
      sessionId = body.session_id;
    }
    if (!sessionId || body.workflow_id !== workflowId
      || body.workflow_version !== workflowVersion
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
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ retain_face_embeddings: false }),
        });
      } catch {
        throw failure("DIDIT_SANDBOX_PURGE_FAILED");
      }
      if (deleted.response.status !== 200) {
        throw failure("DIDIT_SANDBOX_PURGE_FAILED");
      }
      const deletion = deleted.body;
      if (deletion?.session_id !== sessionId
        || !["deleted", "none"].includes(deletion?.face_retention_outcome)
        || deletion?.biometric_template_uuid != null) {
        throw failure("DIDIT_SANDBOX_PURGE_FAILED");
      }
      await journal.complete();
    }
  }
}

/** Retries cleanup using the exact vendor correlation retained before session creation. */
export async function recoverPhotoMatchSandbox({ apiKey, journal, fetchImpl = fetch }) {
  if (!apiKey || typeof journal?.read !== "function" || typeof journal?.complete !== "function") {
    throw failure("DIDIT_SANDBOX_CONFIG_INVALID");
  }
  const entry = await journal.read().catch(() => null);
  if (!UUID_PATTERN.test(entry?.workflowId ?? "")
    || typeof entry?.vendorData !== "string"
    || !entry.vendorData.startsWith("nak60-sandbox:")
    || !UUID_PATTERN.test(entry.vendorData.slice("nak60-sandbox:".length))) {
    throw failure("DIDIT_SANDBOX_JOURNAL_INVALID");
  }
  const listUrl = new URL("https://verification.didit.me/v3/sessions/");
  listUrl.search = new URLSearchParams({
    session_kind: "user", vendor_data: entry.vendorData, workflow_id: entry.workflowId, limit: "100",
  }).toString();
  const listed = await request(fetchImpl, listUrl, { headers: { "x-api-key": apiKey } });
  if (listed.response.status !== 200 || !Array.isArray(listed.body?.results)
    || listed.body.next !== null || listed.body.results.length === 0) {
    throw failure("DIDIT_SANDBOX_RECOVERY_UNCONFIRMED");
  }
  for (const session of listed.body.results) {
    if (session?.vendor_data !== entry.vendorData || !UUID_PATTERN.test(session?.session_id ?? "")) {
      throw failure("DIDIT_SANDBOX_RECOVERY_UNCONFIRMED");
    }
    const deleted = await request(fetchImpl, `${BASE}/${encodeURIComponent(session.session_id)}/delete/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ retain_face_embeddings: false }),
    });
    if (deleted.response.status !== 200 || deleted.body?.session_id !== session.session_id
      || !["deleted", "none"].includes(deleted.body?.face_retention_outcome)
      || deleted.body?.biometric_template_uuid != null) {
      throw failure("DIDIT_SANDBOX_PURGE_FAILED");
    }
  }
  await journal.complete();
  return { deleted: listed.body.results.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [firstArg, secondArg] = process.argv.slice(2);
  try {
    if (firstArg === "--recover") {
      if (!secondArg) throw failure("DIDIT_SANDBOX_JOURNAL_REQUIRED");
      const result = await recoverPhotoMatchSandbox({
        apiKey: process.env.DIDIT_SANDBOX_API_KEY,
        journal: createSandboxRecoveryJournal(secondArg),
      });
      process.stdout.write(`Didit Sandbox recovery confirmed ${result.deleted} deletion(s).\n`);
    } else {
      if (!firstArg) throw failure("DIDIT_SANDBOX_REFERENCE_PATH_REQUIRED");
      if (!secondArg) throw failure("DIDIT_SANDBOX_JOURNAL_REQUIRED");
      const portrait = await readFile(firstArg);
      await verifyPhotoMatchSandbox({
        apiKey: process.env.DIDIT_SANDBOX_API_KEY,
        workflowId: process.env.DIDIT_SANDBOX_PHOTO_MATCH_WORKFLOW_ID,
        workflowVersion: Number(process.env.DIDIT_SANDBOX_PHOTO_MATCH_WORKFLOW_VERSION),
        portrait,
        journal: createSandboxRecoveryJournal(secondArg),
      });
      process.stdout.write("Document-free Didit Sandbox create-and-delete contract passed.\n");
    }
  } catch (error) {
    const code = error instanceof Error && /^DIDIT_SANDBOX_[A-Z_]+$/.test(error.message)
      ? error.message : "DIDIT_SANDBOX_CONTRACT_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
