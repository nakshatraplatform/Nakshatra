import { matchesIdentityBirthDate } from "../src/features/identity-verification/server/identity-match.mjs";

const DIDIT_BASE_URL = "https://verification.didit.me/v3/session";
const DIDIT_SESSION_LIST_URL = "https://verification.didit.me/v3/sessions/";
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

  if (["candidate_liveness_only", "candidate_liveness_ip"].includes(claim.verification_method)) {
    if (claim.subject_type !== "candidate") throw workerError("IDENTITY_VERIFICATION_METHOD_INVALID");
    const absent = (field) => decision[field] == null
      || (Array.isArray(decision[field]) && decision[field].length === 0);
    const workflowMatches = decision.workflow_id === claim.provider_workflow_id
      && Number.isSafeInteger(decision.workflow_version)
      && decision.workflow_version === Number(claim.provider_workflow_version)
      && decision.vendor_data === claim.provider_vendor_data;
    const livenessVerified = allApproved(decision, "liveness_checks");
    const livenessOnly = claim.verification_method === "candidate_liveness_only";
    const ipVerified = !livenessOnly && allApproved(decision, "ip_analyses");
    const checksPass = workflowMatches && livenessVerified && (livenessOnly ? absent("ip_analyses") : ipVerified)
      && absent("id_verifications") && absent("face_matches");
    const status = normalizeStatus(decision.status);
    let outcome = "pending";
    if (status === "APPROVED") outcome = checksPass ? "verified" : "declined";
    else if (status === "DECLINED") outcome = "declined";
    else if (["ABANDONED", "EXPIRED", "KYC_EXPIRED"].includes(status)) outcome = "expired";
    return { outcome, livenessVerified, ipVerified, idVerified: false,
      passiveLivenessVerified: false, faceMatchVerified: false, nameMatches: false, birthDateMatches: false };
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
  candidateWorkflowId = process.env.DIDIT_WORKFLOW_ID,
  now = () => new Date(),
  requestTimeoutMs = PROVIDER_REQUEST_TIMEOUT_MS,
} = {}) {
  if (!apiKey) throw workerError("DIDIT_PROVIDER_UNAVAILABLE");
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000) {
    throw workerError("DIDIT_PROVIDER_UNAVAILABLE");
  }

  async function rpcBoolean(name, args, code, allowStale = false) {
    const { data, error } = await supabase.rpc(name, args);
    if (!error && data === false && allowStale) return false;
    if (error || data !== true) throw workerError(code);
    return true;
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
      if (response.status === 404) return "absent";
      if (response.status !== 200) throw workerError("DIDIT_SESSION_PURGE_FAILED");
      const deletion = await response.json();
      if (deletion?.session_id !== providerSessionRef
        || !["deleted", "none"].includes(deletion?.face_retention_outcome)
        || deletion?.biometric_template_uuid != null) {
        throw workerError("DIDIT_SESSION_PURGE_FAILED");
      }
      return "deleted";
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
          || nextUrl.pathname !== "/v3/sessions/") {
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
    return rpcBoolean("defer_identity_verification_work", {
      p_attempt_id: claim.attempt_id,
      p_claim_token: claim.claim_token,
      p_error_code: errorCode,
      p_task_type: claim.task_type,
    }, "IDENTITY_VERIFICATION_DEFERRAL_FAILED", claim.task_type === "reconcile" && claim.verification_method === "candidate_liveness_only");
  }

  async function process(claim) {
    try {
      if (claim.task_type === "reconcile"
        && ["portfolio_photo_liveness", "candidate_liveness_ip", "candidate_liveness_only"].includes(claim.verification_method)
        && (!UUID_PATTERN.test(candidateWorkflowId ?? "")
          || claim.provider_workflow_id !== candidateWorkflowId
          || !Number.isSafeInteger(claim.provider_workflow_version) || claim.provider_workflow_version < 1)) {
        throw workerError("DIDIT_WORKFLOW_MISMATCH");
      }
      if (claim.task_type === "provider_recovery") {
        if (!claim.provider_session_ref) {
          const sessions = await findSessionsByVendorData(claim.provider_vendor_data);
          for (const session of sessions) {
            if (!UUID_PATTERN.test(session?.session_id ?? "")) {
              throw workerError("DIDIT_SESSION_RECOVERY_MISMATCH");
            }
            // An uncertain POST has no returned version yet. Recover exact correlation
            // through the decision endpoint, not optional fields in list summaries.
            const recovered = await fetchDecision(session.session_id);
            if (recovered?.session_id !== session.session_id
              || recovered?.vendor_data !== claim.provider_vendor_data
              || recovered?.workflow_id !== claim.provider_workflow_id
              || !Number.isSafeInteger(recovered?.workflow_version) || recovered.workflow_version < 1
              || (claim.provider_workflow_version != null
                && recovered.workflow_version !== claim.provider_workflow_version)) {
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
        const outcome = await deleteSession(claim.provider_session_ref);
        await rpcBoolean(outcome === "absent" ? "complete_identity_verification_provider_absence" : "complete_identity_verification_provider_redaction", {
          p_attempt_id: claim.attempt_id,
          p_claim_token: claim.claim_token,
        }, "IDENTITY_VERIFICATION_REDACTION_COMPLETION_FAILED");
        return { status: "completed" };
      }
      if (claim.task_type !== "reconcile") throw workerError("IDENTITY_VERIFICATION_WORK_TYPE_INVALID");

      const decision = await fetchDecision(claim.provider_session_ref);
      const result = evaluateDiditDecision(decision, claim, identityMatchKey);
      const applied = await rpcBoolean("complete_identity_verification_reconciliation", {
        p_attempt_id: claim.attempt_id,
        p_claim_token: claim.claim_token,
        p_outcome: result.outcome,
        p_id_verified: result.idVerified,
        p_passive_liveness_verified: result.livenessVerified ?? result.passiveLivenessVerified,
        ...(["candidate_liveness_ip", "candidate_liveness_only"].includes(claim.verification_method) ? { p_ip_verified: result.ipVerified } : {}),
        p_face_match_verified: result.faceMatchVerified,
        p_name_matches: result.nameMatches,
        p_birth_date_matches: result.birthDateMatches,
      }, "IDENTITY_VERIFICATION_RECONCILIATION_COMPLETION_FAILED", claim.verification_method === "candidate_liveness_only");
      // Cancellation/expiry can retire a lease during the provider request.
      // A rejected stale result is a no-op, not an operational failure to retry.
      if (!applied) return { status: "completed" };
      return { status: result.outcome === "pending" ? "pending" : "completed" };
    } catch (error) {
      const code = error instanceof Error && /^[A-Z_]{3,64}$/.test(error.message)
        ? error.message
        : "IDENTITY_VERIFICATION_PROCESSING_FAILED";
      const deferred = await defer(claim, code);
      // Retired leases are harmless even when the outstanding provider call failed.
      return { status: deferred ? "deferred" : "completed" };
    }
  }

  /** Claims a bounded batch and returns only aggregate, non-identifying execution counts. */
  async function run(limit) {
    const expiry = await supabase.rpc("expire_candidate_liveness_attempts", { p_limit: limit });
    if (expiry.error) throw workerError("IDENTITY_VERIFICATION_EXPIRY_FAILED");
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
