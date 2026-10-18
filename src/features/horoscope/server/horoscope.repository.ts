import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const HOROSCOPE_COLUMNS = "id, portfolio_id, storage_path, mime_type, file_extension, byte_size, language_label, page_count, published_at, created_at, updated_at";

export class HoroscopeRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  findOwnedPortfolio(portfolioId: string, userId: string) {
    return this.supabase.from("portfolios").select("id").eq("id", portfolioId).eq("user_id", userId).single();
  }

  findPortfolioForOwner(userId: string) {
    return this.supabase.from("portfolios").select("id").eq("user_id", userId).maybeSingle();
  }

  findByPortfolio(portfolioId: string) {
    return this.supabase.from("portfolio_horoscopes").select(HOROSCOPE_COLUMNS).eq("portfolio_id", portfolioId).maybeSingle();
  }

  findById(id: string) {
    return this.supabase.from("portfolio_horoscopes").select(HOROSCOPE_COLUMNS).eq("id", id).single();
  }

  reserveUpload(portfolioId: string) {
    return this.supabase.rpc("reserve_horoscope_upload", { p_portfolio_id: portfolioId });
  }

  save(payload: Record<string, unknown>, expectedPath: string | null) {
    return this.supabase.rpc("replace_horoscope", { p_portfolio_id: payload.portfolio_id,
      p_expected_path: expectedPath, p_attachment: payload }).single();
  }

  delete(id: string) {
    return this.supabase.rpc("delete_owned_horoscope", { p_id: id }).single();
  }

  publish(portfolioId: string, publishedAt: string) {
    return this.supabase.rpc("publish_owned_horoscope", { p_portfolio_id: portfolioId, p_published_at: publishedAt });
  }

  upload(path: string, body: Buffer, contentType: string) {
    return this.supabase.storage.from("horoscopes").upload(path, body, {
      contentType,
      cacheControl: "0",
      upsert: false,
    });
  }

  remove(paths: string[]) {
    if (!paths.length) return Promise.resolve({ error: null });
    return this.supabase.storage.from("horoscopes").remove(paths);
  }

  createSignedUrl(path: string, expiresInSeconds: number, download?: string) {
    return this.supabase.storage
      .from("horoscopes")
      .createSignedUrl(path, expiresInSeconds, download ? { download } : undefined);
  }
}
