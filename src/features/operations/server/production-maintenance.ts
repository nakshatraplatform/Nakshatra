import "server-only";
import { processHoroscopeCleanup } from "@/features/horoscope/server/horoscope-cleanup.service";
import { processRetention } from "./retention.service";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { processRelationshipNotifications } from "@/features/notifications/server/relationship-notification.service";
import { sendResendEmail } from "@/features/notifications/server/resend.provider";
import { createIdentityVerificationWorker } from "../../../../scripts/identity-verification-worker.mjs";
import { processDeletedProviderCleanup } from "../../../../scripts/deleted-provider-cleanup.mjs";
import { processCandidateLivenessEmails } from "../../../../scripts/candidate-liveness-email-worker.mjs";
import { createAccountDeletionWorker } from "../../../../scripts/account-deletion-worker.mjs";

export function workerAuthorized(request: Request) {
  const expected = process.env.PRODUCTION_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (process.env.PRODUCTION_WORKER_ENABLED !== "true" || !expected || expected.length < 32) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  if (a.length === b.length && timingSafeEqual(a, b)) return true;
  if (request.method !== "POST" || new URL(request.url).pathname !== "/api/internal/production-maintenance") return false;
  const nonce = request.headers.get("x-worker-dispatch") ?? "";
  const timestamp = request.headers.get("x-worker-timestamp") ?? "";
  const signature = request.headers.get("x-worker-signature") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nonce)
    || !/^\d{10}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (age < -10 || age > 60) return false;
  const expectedMac = createHmac("sha256", expected).update(`vivintro-maintenance\n${nonce}\n${timestamp}`).digest();
  return timingSafeEqual(expectedMac, Buffer.from(signature, "hex"));
}

/** Bound both SDK/database and provider requests; one failed task cannot starve another queue. */
export function boundedFetch(deadline?: AbortSignal): typeof fetch {
  return (input, init) => fetch(input, { ...init, signal: AbortSignal.any([
    AbortSignal.timeout(10_000), ...(deadline ? [deadline] : []), ...(init?.signal ? [init.signal] : []),
  ]) });
}

export async function runProductionMaintenance(dispatchId?: string) {
  const control = createServiceRoleClient(boundedFetch());
  const { data: token, error } = await control.rpc("begin_production_maintenance", dispatchId ? { p_dispatch_id: dispatchId } : {});
  if (error) throw new Error("MAINTENANCE_CLAIM_FAILED");
  if (!token) return { skipped: true, failed: false };
  const transport = boundedFetch(AbortSignal.timeout(150_000));
  const client = createServiceRoleClient(transport);
  const identityRun = Promise.resolve().then(() =>
    createIdentityVerificationWorker(client, { candidateOnly: true, fetchImpl: transport }).run(2));
  const expiryRun = Promise.resolve().then(async () => {
    const { data, error } = await client.rpc("enqueue_due_full_view_expiry_reminders");
    if (error || typeof data !== "number" || !Number.isInteger(data) || data < 0 || data > 50) {
      throw new Error("EXPIRY_REMINDER_ENQUEUE_FAILED");
    }
    return true;
  });
  const tasks = {
    retention: () => processRetention(client),
    horoscopeCleanup: async () => (await processHoroscopeCleanup(client)).deferred === 0,
    identity: async () => (await identityRun).deferred === 0,
    providerCleanup: async () => (await processDeletedProviderCleanup(client, { fetchImpl: transport, limit: 2 })).deferred === 0,
    livenessEmail: async () => {
      // Newly verified proofs enqueue mail in the reconciliation transaction.
      // A provider failure must still leave older email jobs eligible to send.
      await identityRun.catch(() => undefined);
      return (await processCandidateLivenessEmails(client, {
        limit: 2, send: (input: unknown) => sendResendEmail(input, transport),
      })).failed === 0;
    },
    expiryReminders: () => expiryRun,
    relationshipEmail: async () => {
      await expiryRun.catch(() => undefined);
      return (await processRelationshipNotifications(client, 5, transport)).failed === 0;
    },
    accountDeletion: async () => (await createAccountDeletionWorker(client).run(1)).deferred === 0,
  };
  const outcomes = await Promise.allSettled(Object.values(tasks).map(task => task()));
  const failed = outcomes.some(outcome => outcome.status !== "fulfilled" || outcome.value !== true);
  const completion = await control.rpc("finish_production_maintenance", { p_claim_token: token, p_succeeded: !failed });
  if (completion.error || completion.data !== true) throw new Error("MAINTENANCE_COMPLETION_FAILED");
  return { skipped: false, failed, tasks: Object.fromEntries(Object.keys(tasks).map((name, i) => [
    name, outcomes[i].status === "fulfilled" && outcomes[i].value === true ? "completed" : "deferred",
  ])) };
}

export async function productionHealth() {
  const client = createServiceRoleClient(boundedFetch());
  const [{ data, error }, { data: expiry, error: expiryError }] = await Promise.all([
    client.rpc("production_worker_health"), client.rpc("portfolio_expiry_reminder_health"),
  ]);
  if (error || expiryError || !data || typeof data !== "object" || Array.isArray(data)
    || !expiry || typeof expiry !== "object" || Array.isArray(expiry)) throw new Error("HEALTH_UNAVAILABLE");
  return { ...data, healthy: data.healthy === true && expiry.healthy === true, expiryReminders: expiry };
}
