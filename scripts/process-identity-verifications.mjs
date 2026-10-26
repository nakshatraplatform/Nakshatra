import { processDeletedProviderCleanup } from "./deleted-provider-cleanup.mjs";
import { createClient } from "@supabase/supabase-js";
import { createIdentityVerificationWorker } from "./identity-verification-worker.mjs";
import { processCandidateLivenessEmails } from "./candidate-liveness-email-worker.mjs";
import { runObservedWorker } from "./observed-worker.mjs";

await runObservedWorker("worker.identity-verification", async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before processing identity verifications.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([
      AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : []),
    ]) }) },
  });

  const limit = Math.min(Math.max(Number.parseInt(process.env.IDENTITY_VERIFICATION_BATCH_SIZE || "10", 10) || 10, 1), 50);
  // The scheduled portfolio worker must never lease representative work.
  const result = await createIdentityVerificationWorker(supabase, { candidateOnly: true }).run(limit);
  console.log(
    `Identity verification run complete: ${result.completed} completed, ${result.pending} pending, ${result.deferred} deferred.`,
  );
  const cleanupResult = await processDeletedProviderCleanup(supabase).then(
    (value) => ({ ...value, error: null }),
    () => ({ completed: 0, deferred: 1, error: "DELETED_PROVIDER_WORK_FAILED" }),
  );
  const cleanup = cleanupResult;
  console.log(`Deleted-account provider cleanup: ${cleanup.completed} completed, ${cleanup.deferred} deferred.`);
  // Email failures never roll back a proof or prevent the next provider batch.
  // Dispatch even when this batch contains a deferred provider request.
  const emails = await processCandidateLivenessEmails(supabase);
  console.log(`Liveness confirmation email run: ${emails.accepted} accepted, ${emails.failed} failed.`);

  // A pending provider decision is normal and is rescheduled by the database.
  // A deferred item means a provider, network, or persistence operation failed;
  // fail the scheduled run so the operational alert job can notify an owner.
  if (result.deferred > 0) {
    console.warn("Identity verification deferrals by safe category:", result.failureCounts);
    throw new Error("IDENTITY_VERIFICATION_WORK_DEFERRED");
  }
  if (emails.failed > 0) throw new Error("LIVENESS_EMAIL_DELIVERY_DEFERRED");

  if (cleanup.deferred > 0) throw new Error("DELETED_PROVIDER_WORK_DEFERRED");
});
