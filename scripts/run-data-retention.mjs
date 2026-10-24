import { createClient } from "@supabase/supabase-js";
import { runObservedWorker } from "./observed-worker.mjs";

await runObservedWorker("worker.retention", async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running retention.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("run_data_retention");
  if (error) throw new Error("The data-retention job failed.");
  const { error: feedbackError } = await supabase.rpc("purge_landing_feedback");
  if (feedbackError) throw new Error("The landing-feedback retention job failed.");
  console.log("Data-retention run complete.", data);
});
