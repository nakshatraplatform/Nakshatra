import { createServer, type Server } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createIdentityVerificationWorker } from "../scripts/identity-verification-worker.mjs";

const claim = {
  subject_type: "candidate", verification_method: "candidate_liveness_only", task_type: "reconcile",
  attempt_id: "44444444-4444-4444-8444-444444444444", claim_token: "loopback-lease",
  provider_session_ref: "11111111-1111-4111-8111-111111111111",
  provider_workflow_id: "22222222-2222-4222-8222-222222222222", provider_workflow_version: 2,
  provider_vendor_data: "iv:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444",
};
const decision = {
  session_id: claim.provider_session_ref, workflow_id: claim.provider_workflow_id, workflow_version: 2,
  vendor_data: claim.provider_vendor_data, status: "Approved", session_url: null,
  features: [{ feature: "LIVENESS", node_id: "fixture" }], liveness_checks: [{ status: "Approved" }],
};
let server: Server, origin: string;
let mode: "valid" | "missing-version" | "wrong-correlation" | "uncertain" | "known-cleanup" | "wrong-known";
let requests: { method: string; path: string; body: Record<string, unknown> }[];

beforeEach(async () => {
  mode = "valid"; requests = [];
  server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    requests.push({ method: request.method!, path: request.url!, body: text ? JSON.parse(text) : {} });
    const url = new URL(request.url!, "http://localhost");
    let payload: unknown = true;
    if (url.pathname.endsWith("expire_candidate_liveness_attempts")) payload = 0;
    else if (url.pathname.endsWith("claim_candidate_identity_verification_work")) payload = [{ ...claim,
      ...(mode === "uncertain" || mode === "wrong-correlation" ? { task_type: "provider_recovery", provider_session_ref: null, provider_workflow_version: null, work_attempts: 1 } : {}),
      ...(mode === "known-cleanup" || mode === "wrong-known" ? { task_type: "provider_redaction" } : {}) }];
    else if (url.pathname === "/v3/sessions/") payload = { results: [{ session_id: claim.provider_session_ref, vendor_data: claim.provider_vendor_data }], next: null };
    else if (url.pathname.endsWith("/decision/")) {
      expect(url.searchParams.get("include")).toBe("events");
      expect(request.headers["x-api-key"]).toBe("loopback-only-api-key");
      payload = { ...decision, ...(mode === "missing-version" ? { workflow_version: undefined } : {}),
        ...(mode === "wrong-correlation" || mode === "wrong-known" ? { vendor_data: "another-attempt" } : {}) };
    } else if (url.pathname.endsWith("/delete/")) payload = { session_id: claim.provider_session_ref, face_retention_outcome: "deleted", biometric_template_uuid: null };
    else if (!url.pathname.startsWith("/rest/v1/rpc/")) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(payload));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
it.each(["known-cleanup", "wrong-known"] as const)("correlates an attached session over HTTP before privileged deletion: %s", async value => {
  mode = value;
  expect(await run()).toMatchObject({ completed: value === "known-cleanup" ? 1 : 0, deferred: value === "known-cleanup" ? 0 : 1 });
  expect(requests.filter(request => request.method === "DELETE")).toHaveLength(value === "known-cleanup" ? 1 : 0);
  expect(requests.some(request => request.path.endsWith("complete_identity_verification_provider_redaction"))).toBe(value === "known-cleanup");
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

async function run() {
  const client = createClient(origin, "loopback-only-service-key", { auth: { persistSession: false, autoRefreshToken: false } });
  return createIdentityVerificationWorker(client, { candidateOnly: true, candidateWorkflowId: claim.provider_workflow_id,
    apiKey: "loopback-only-api-key", fetchImpl: (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.origin !== "https://verification.didit.me") throw new Error("External network forbidden");
      return fetch(`${origin}${url.pathname}${url.search}`, init);
    } }).run(10);
}

it("serializes a real expanded decision through fetch, policy and PostgREST RPC", async () => {
  expect(await run()).toMatchObject({ completed: 1, deferred: 0, failureCounts: {} });
  expect(requests.find(request => request.path.endsWith("complete_identity_verification_reconciliation"))?.body)
    .toMatchObject({ p_outcome: "verified", p_passive_liveness_verified: true, p_ip_verified: false });
  expect(requests.some(request => request.method === "POST" && request.path.startsWith("/v3/session/"))).toBe(false);
});
it("defers a plain/incompatible decision without writing a biometric outcome", async () => {
  mode = "missing-version";
  expect(await run()).toMatchObject({ completed: 0, deferred: 1, failureCounts: { provider_contract: 1 } });
  expect(requests.some(request => request.path.endsWith("complete_identity_verification_reconciliation"))).toBe(false);
  expect(requests.find(request => request.path.endsWith("defer_identity_verification_work"))?.body.p_error_code).toBe("DIDIT_DECISION_INVALID");
});
it.each(["uncertain", "wrong-correlation"] as const)("recovers uncertain creation with correlated retrieval before deletion: %s", async value => {
  mode = value;
  expect(await run()).toMatchObject({ completed: value === "uncertain" ? 1 : 0, deferred: value === "uncertain" ? 0 : 1 });
  expect(requests.filter(request => request.method === "DELETE")).toHaveLength(value === "uncertain" ? 1 : 0);
  const listing = requests.find(request => request.path.startsWith("/v3/sessions/"))!;
  expect(new URL(listing.path, origin).searchParams.get("vendor_data")).toBe(claim.provider_vendor_data);
  expect(requests.some(request => request.path.endsWith("complete_identity_verification_provider_recovery"))).toBe(value === "uncertain");
});
