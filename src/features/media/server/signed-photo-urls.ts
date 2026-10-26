import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Callers authorize paths and choose the capability lifetime before entering this Storage boundary. */
export async function signPhotoPaths(supabase: SupabaseClient, paths: string[], expiresInSeconds: number) {
  const requested = new Set(paths);
  if (!requested.size) return new Map<string, string>();
  const { data } = await supabase.storage.from("photos").createSignedUrls([...requested], expiresInSeconds);
  return new Map((data ?? []).flatMap(item =>
    item.path && requested.has(item.path) && !item.error && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
}
