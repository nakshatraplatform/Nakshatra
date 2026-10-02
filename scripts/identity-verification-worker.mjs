import { matchesIdentityBirthDate } from "../src/features/identity-verification/server/identity-match.mjs";

const DIDIT_BASE_URL = "https://verification.didit.me/v3/session";
const DIDIT_SESSION_LIST_URL = "https://verification.didit.me/v2/sessions";
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function workerError(code) {
  return new Error(code);
}

function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
}

function normalizedName(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

function allApproved(decision, field) {
  const checks = decision?.[field];
  return Array.isArray(checks) && checks.length > 0 && checks.every((check) => normalizeStatus(check?.status) === "APPROVED");
}

function exactlyOneApproved(decision, field) {
  const checks = decision?.[field];
  return Array.isArray(checks)
    && checks.length === 1
    && normalizeStatus(checks[0]?.status) === "APPROVED";
}

/** Reduces an unretained Didit decision to the policy booleans required by the database. */
export function evaluateDiditDecision(
  decision,
  claim,
  identityMatchKey = process.env.IDENTITY_VERIFICATION_MATCH_HMAC_KEY
) {
  if (!decision || typeof decision !== "object" || decision.session_id !== claim.provider_session_ref) {
    throw workerError("DIDIT_DECISION_MISMATCH");
  }
  if (!["candidate", "organization_representative"].includes(claim.subject_type)) {
    throw workerError("IDENTITY_VERIFICATION_SUBJECT_TYPE_INVALID");
  }
  if (claim.subject_type === "organization_representative"
    && (typeof identityMatchKey !== "string" || identityMatchKey.length < 32)) {
    throw workerError("IDENTITY_MATCH_KEY_UNAVAILABLE");
  }

  if (claim.verification_method === "portfolio_photo_liveness") {
    const workflowMatches = decision.workflow_id === claim.provider_workflow_id
      && Number(decision.workflow_version) === Number(claim.provider_workflow_version);
    const idChecksAbsent = !Array.isArray(decision.id_verifications)
      || decision.id_verifications.length === 0;
    const faceMatchVerified = allApproved(decision, "face_matches");
    const passiveLivenessVerified = Array.isArray(decision.liveness_checks)
      && decision.liveness_checks.length > 0
      && decision.liveness_checks.every((check) => (
        normalizeStatus(check?.status) === "APPROVED"
        && normalizeStatus(check?.method).includes("PASSIVE")
      ));
    const status = normalizeStatus(decision.status);
    const checksPass = workflowMatches && idChecksAbsent
      && passiveLivenessVerified && faceMatchVerified;
    let outcome = "pending";
    if (status === "APPROVED") outcome = checksPass ? "verified" : "declined";
    else if (status === "DECLINED") outcome = "declined";
    else if (["ABANDONED", "EXPIRED", "KYC_EXPIRED"].includes(status)) outcome = "expired";
    return {
      outcome,
      idVerified: false,
      passiveLivenessVerified,
      faceMatchVerified,
      nameMatches: false,
      birthDateMatches: false,
    };
  }
  if (claim.verification_method !== "document_identity") {
    throw workerError("IDENTITY_VERIFICATION_METHOD_INVALID");
  }

  // Nakshatra's approved Didit workflow has exactly one identity document.
  // Treat a changed or ambiguous workflow as a failed policy result rather
  // than selecting an arbitrary document's name and date of birth.
  const idVerified = exactlyOneApproved(decision, "id_verifications");
  const faceMatchVerified = allApproved(decision, "face_matches");
  const passiveLivenessVerified = Array.isArray(decision.liveness_checks)
    && decision.liveness_checks.length > 0
    && decision.liveness_checks.every((check) => (
      normalizeStatus(check?.status) === "APPROVED"
      && normalizeStatus(check?.method).includes("PASSIVE")
    ));
  const firstIdentityCheck = Array.isArray(decision.id_verifications) ? decision.id_verifications[0] : null;
  const decisionName = [firstIdentityCheck?.first_name, firstIdentityCheck?.last_name].filter(Boolean).join(" ");
  const nameMatches = normalizedName(decisionName) === normalizedName(claim.legal_name);
  const birthDateMatches = typeof firstIdentityCheck?.date_of_birth === "string"
    && (claim.subject_type === "organization_representative"
      ? matchesIdentityBirthDate(
          firstIdentityCheck.date_of_birth,
          claim.birth_date_hash,
          identityMatchKey
        )
      : firstIdentityCheck.date_of_birth === claim.birth_date);
  const status = normalizeStatus(decision.status);
  const checksPass = idVerified && passiveLivenessVerified && faceMatchVerified && nameMatches && birthDateMatches;

  let outcome = "pending";
  if (status === "APPROVED") outcome = checksPass ? "verified" : "declined";
  else if (status === "DECLINED") outcome = "declined";
  else if (["ABANDONED", "EXPIRED", "KYC_EXPIRED"].includes(status)) outcome = "expired";

  return {
    outcome,
    idVerified,
    passiveLivenessVerified,
    faceMatchVerified,
    nameMatches,
    birthDateMatches,
  };
}

/** Builds a service-role worker that fetches Didit decisions transiently and stores only derived state. */
export function createIdentityVerificationWorker(supabase, {
  apiKey = process.env.DIDIT_API_KEY,
  fetchImpl = fetch,
  identityMatchKey = process.env.IDENTITY_VERIFICATION_MATCH_HMAC_KEY,
  photoWorkflowId = process.env.DIDIT_PHOTO_MATCH_WORKFLOW_ID,
  photoWorkflowVersion = Number(process.env.DIDIT_PHOTO_MATCH_WORKFLOW_VERSION),
  now = () => new Date(),
  requestTimeoutMs = PROVIDER_REQUEST_TIMEOUT_MS,
} = {}) {
  if (!apiKey) throw workerError("DIDIT_PROVIDER_UNAVAILABLE");
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000) {
    throw workerError("DIDIT_PROVIDER_UNAVAILABLE");
  }

  async function rpcBoolean(name, args, code) {
    const { data, error } = await supabase.rpc(name, args);
    if (error || data !== true) throw workerError(code);
  }

  async function fetchDecision(providerSessionRef) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(`${DIDIT_BASE_URL}/${encodeURIComponent(providerSessionRef)}/decision/`, {
        headers: { Accept: "application/json", "x-api-key": apiKey },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw workerError("DIDIT_DECISION_FETCH_FAILED");
      return await response.json();
    } catch {
      throw workerError("DIDIT_DECISION_FETCH_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function deleteSession(providerSessionRef) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(`${DIDIT_BASE_URL}/${encodeURIComponent(providerSessionRef)}/delete/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ retain_face_embeddings: false }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status !== 200) throw workerError("DIDIT_SESSION_PURGE_FAILED");
      const deletion = await response.json();
      if (deletion?.session_id !== providerSessionRef
        || !["deleted", "none"].includes(deletion?.face_retention_outcome)
        || deletion?.biometric_template_uuid != null) {
        throw workerError("DIDIT_SESSION_PURGE_FAILED");
      }
    } catch {
      throw workerError("DIDIT_SESSION_PURGE_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }

  async function findSessionsByVendorData(vendorData) {
    if (typeof vendorData !== "string" || !/^iv:[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(vendorData)) {
      throw workerError("DIDIT_SESSION_RECOVERY_INVALID");
    }
    let url = new URL(DIDIT_SESSION_LIST_URL);
    url.searchParams.set("vendor_data", vendorData);
    const matches = [];
    try {
      for (let page = 0; page < 5; page += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
        let payload;
        try {
          const response = await fetchImpl(url, {
            headers: { Accept: "application/json", "x-api-key": apiKey },
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw workerError("DIDIT_SESSION_RECOVERY_FAILED");
          payload = await response.json();
        } finally {
          clearTimeout(timeout);
        }

        let candidates;
        let next = null;
        if (Array.isArray(payload)) candidates = payload;
        else if (payload && Array.isArray(payload.results)) {
          candidates = payload.results;
          next = payload.next ?? null;
        } else if (payload && Array.isArray(payload.sessions)) {
          candidates = payload.sessions;
          next = payload.next ?? null;
        } else {
          throw workerError("DIDIT_SESSION_RECOVERY_INVALID");
        }
        matches.push(...candidates.filter((session) => session?.vendor_data === vendorData));
        if (next == null || next === "") return matches;
        if (typeof next !== "string") throw workerError("DIDIT_SESSION_RECOVERY_INVALID");
        const nextUrl = new URL(next, DIDIT_SESSION_LIST_URL);
        if (nextUrl.origin !== "https://verification.didit.me"
          || nextUrl.pathname !== "/v2/sessions") {
          throw workerError("DIDIT_SESSION_RECOVERY_INVALID");
        }
        nextUrl.searchParams.set("vendor_data", vendorData);
        url = nextUrl;
      }
      throw workerError("DIDIT_SESSION_RECOVERY_INVALID");
    } catch {
      throw workerError("DIDIT_SESSION_RECOVERY_FAILED");
    }
  }

  async function defer(claim, errorCode) {
    await rpcBoolean("defer_identity_verification_work", {
      p_attempt_id: claim.attempt_id,
      p_claim_token: claim.claim_token,
      p_error_code: errorCode,
      p_task_type: claim.task_type,
    }, "IDENTITY_VERIFICATION_DEFERRAL_FAILED");
  }

  async function process(claim) {
    try {
      if (claim.task_type === "reconcile"
        && claim.verification_method === "portfolio_photo_liveness"
        && (!UUID_PATTERN.test(photoWorkflowId ?? "")
          || !Number.isSafeInteger(photoWorkflowVersion) || photoWorkflowVersion < 1
          || claim.provider_workflow_id !== photoWorkflowId
          || Number(claim.provider_workflow_version) !== photoWorkflowVersion)) {
        throw workerError("DIDIT_PHOTO_WORKFLOW_MISMATCH");
      }
      if (claim.task_type === "provider_recovery") {
        if (!claim.provider_session_ref) {
          const sessions = await findSessionsByVendorData(claim.provider_vendor_data);
          for (const session of sessions) {
            if (session?.workflow_id !== claim.provider_workflow_id
              || Number(session?.workflow_version) !== Number(claim.provider_workflow_version)
              || typeof session?.session_id !== "string") {
              throw workerError("DIDIT_SESSION_RECOVERY_MISMATCH");
            }
            await deleteSession(session.session_id);
          }
          if (sessions.length === 0 && Number(claim.work_attempts) < 3) {
            throw workerError("DIDIT_SESSION_RECOVERY_PENDING");
          }
        }
        await rpcBoolean("complete_identity_verification_provider_recovery", {
          p_attempt_id: claim.attempt_id,
          p_claim_token: claim.claim_token,
        }, "IDENTITY_VERIFICATION_RECOVERY_COMPLETION_FAILED");
        return { status: "completed" };
      }
      if (!claim.provider_session_ref) throw workerError("DIDIT_SESSION_REFERENCE_MISSING");
      if (claim.task_type === "provider_redaction") {
        await deleteSession(claim.provider_session_ref);
        await rpcBoolean("complete_identity_verification_provider_redaction", {
          p_attempt_id: claim.attempt_id,
          p_claim_token: claim.claim_token,
        }, "IDENTITY_VERIFICATION_REDACTION_COMPLETION_FAILED");
        return { status: "completed" };
      }
      if (claim.task_type !== "reconcile") throw workerError("IDENTITY_VERIFICATION_WORK_TYPE_INVALID");

      const decision = await fetchDecision(claim.provider_session_ref);
      const result = evaluateDiditDecision(decision, claim, identityMatchKey);
      await rpcBoolean("complete_identity_verification_reconciliation", {
        p_attempt_id: claim.attempt_id,
        p_claim_token: claim.claim_token,
        p_outcome: result.outcome,
        p_id_verified: result.idVerified,
        p_passive_liveness_verified: result.passiveLivenessVerified,
        p_face_match_verified: result.faceMatchVerified,
        p_name_matches: result.nameMatches,
        p_birth_date_matches: result.birthDateMatches,
      }, "IDENTITY_VERIFICATION_RECONCILIATION_COMPLETION_FAILED");
      return { status: result.outcome === "pending" ? "pending" : "completed" };
    } catch (error) {
      const code = error instanceof Error && /^[A-Z_]{3,64}$/.test(error.message)
        ? error.message
        : "IDENTITY_VERIFICATION_PROCESSING_FAILED";
      await defer(claim, code);
      return { status: "deferred" };
    }
  }

  /** Claims a bounded batch and returns only aggregate, non-identifying execution counts. */
  async function run(limit) {
    const { data: claims, error } = await supabase.rpc("claim_identity_verification_work", { p_limit: limit });
    if (error) throw workerError("IDENTITY_VERIFICATION_CLAIM_FAILED");

    let completed = 0;
    let pending = 0;
    let deferred = 0;
    for (const claim of claims ?? []) {
      const result = await process(claim);
      if (result.status === "completed") completed += 1;
      else if (result.status === "pending") pending += 1;
      else deferred += 1;
    }
    return { claimed: claims?.length ?? 0, completed, pending, deferred, completedAt: now().toISOString() };
  }

  return { evaluateDiditDecision, process, run };
}
