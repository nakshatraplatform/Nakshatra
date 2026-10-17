import { candidateDiditRequest, DIDIT_SESSION_ABSENT, fetchCandidateDecision } from "../src/features/identity-verification/server/didit-candidate-contract.mjs";

const BASE = "https://verification.didit.me/v3";

/** Purges only correlation-checked sessions; absence/uncertain discovery is not deletion proof. */
export async function processDeletedProviderCleanup(supabase, { apiKey = process.env.DIDIT_API_KEY, fetchImpl = fetch, limit = 2 } = {}) {
  const { data: jobs, error } = await supabase.rpc("claim_deleted_provider_cleanup", { p_limit: limit });
  if (error || !Array.isArray(jobs) || jobs.length > limit) throw new Error("DELETED_PROVIDER_CLAIM_FAILED");
  let completed = 0;
  let deferred = 0;
  for (const job of jobs) {
    let code = null;
    try {
      if (!apiKey) throw new Error("DIDIT_PROVIDER_UNAVAILABLE");
      if (!job.provider_workflow_id || !job.provider_vendor_data) throw new Error("DIDIT_CLEANUP_CORRELATION_REQUIRED");
      let sessions = job.provider_session_ref ? [{ session_id: job.provider_session_ref }] : null;
      if (!sessions) {
        const url = new URL(`${BASE}/sessions/`);
        url.searchParams.set("vendor_data", job.provider_vendor_data);
        const result = await candidateDiditRequest(url, { apiKey, fetchImpl });
        // Ambiguous/multi-session recovery requires operator review; never partially
        // purge a discovery set and lose the only evidence of what was deleted.
        if (!Array.isArray(result) && result?.next) throw new Error("DIDIT_CLEANUP_DISCOVERY_UNCONFIRMED");
        sessions = Array.isArray(result) ? result : result?.results ?? result?.sessions;
        if (!Array.isArray(sessions) || sessions.length !== 1
          || sessions.some(s => s?.vendor_data !== job.provider_vendor_data)) {
          throw new Error("DIDIT_CLEANUP_DISCOVERY_UNCONFIRMED");
        }
      }
      for (const session of sessions) {
        // The shared parser validates UUID, workflow/version and exact vendor data
        // before any deletion. A forged/foreign reference cannot authorize purge.
        await fetchCandidateDecision({ sessionId: session.session_id, workflowId: job.provider_workflow_id,
          workflowVersion: job.provider_workflow_version, vendorData: job.provider_vendor_data }, { apiKey, fetchImpl });
        const deletion = await candidateDiditRequest(`${BASE}/session/${encodeURIComponent(session.session_id)}/delete/`, {
          apiKey, fetchImpl, method: "DELETE", expectedStatus: 200, allowMissing: true,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retain_face_embeddings: false }),
        });
        if (deletion === DIDIT_SESSION_ABSENT || deletion?.session_id !== session.session_id
          || !["deleted", "none"].includes(deletion?.face_retention_outcome) || deletion?.biometric_template_uuid != null) {
          throw new Error("DIDIT_CLEANUP_PURGE_UNCONFIRMED");
        }
      }
    } catch (e) {
      code = e instanceof Error && /^[A-Z_]{3,80}$/.test(e.message) ? e.message : "DIDIT_CLEANUP_FAILED";
    }
    const result = await supabase.rpc("finish_deleted_provider_cleanup", {
      p_id: job.id, p_claim_token: job.claim_token, p_error_code: code,
    });
    if (result.error || result.data !== true) throw new Error("DELETED_PROVIDER_COMPLETION_FAILED");
    if (code) deferred++; else completed++;
  }
  return { completed, deferred };
}
