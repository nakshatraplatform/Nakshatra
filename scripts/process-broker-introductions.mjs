import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedHost = process.env.EXPECTED_SUPABASE_HOST || "xizzzczzhqzabcipbgep.supabase.co";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before processing broker introductions.");
}

const target = new URL(supabaseUrl);
const isLocal = target.hostname === "127.0.0.1" || target.hostname === "localhost";
if (!isLocal && (target.protocol !== "https:" || target.hostname !== expectedHost || target.pathname !== "/")) {
  throw new Error("SUPABASE_URL does not identify the approved Nakshatra project.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.rpc("run_broker_introduction_maintenance");
if (error) throw new Error("Broker introduction maintenance did not complete.");
const processed = Number(data?.processed ?? 0);
if (!Number.isInteger(processed) || processed < 0) {
  throw new Error("Broker introduction maintenance returned an invalid result.");
}
console.log(`Broker introduction maintenance complete: ${processed} expired introduction(s) closed.`);
