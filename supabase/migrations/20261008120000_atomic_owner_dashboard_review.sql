-- STABLE functions use the calling statement's MVCC snapshot for every read.
-- Separate HTTP queries can pair old answers with newer review evidence; return
-- the answers, relevant attachment facts and readiness together instead.
create function public.get_owner_dashboard_review_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  portfolio_projection jsonb;
  owner_portfolio_id uuid;
  photos jsonb;
  horoscope jsonb;
begin
  perform app_private.require_current_session();

  select to_jsonb(owner_portfolio), owner_portfolio.id
    into portfolio_projection, owner_portfolio_id
  from (
    select id, user_id, candidate_id, share_token, draft_data, published_data,
      template_id, theme_color, sun_sign, is_published, published_at, expires_at,
      last_renewed_at, privacy_mode, visibility_settings, created_at, updated_at
    from public.portfolios where user_id = auth.uid()
  ) owner_portfolio;

  select coalesce(jsonb_agg(to_jsonb(photo) order by photo.sort_order, photo.id), '[]'::jsonb)
    into photos
  from (
    select id, portfolio_id, storage_path, thumbnail_path, media_type, visibility,
      sort_order, alt_text, metadata
    from public.portfolio_media
    where portfolio_id = owner_portfolio_id and media_type in ('hero', 'gallery')
  ) photo;

  select to_jsonb(attachment) into horoscope
  from (
    select id, portfolio_id, storage_path, mime_type, file_extension, byte_size,
      language_label, page_count, published_at, created_at, updated_at
    from public.portfolio_horoscopes where portfolio_id = owner_portfolio_id
  ) attachment;

  return jsonb_build_object(
    'portfolio', portfolio_projection,
    'media', photos,
    'horoscope', horoscope,
    'readiness', app_private.owner_publication_readiness()
  );
end;
$$;

revoke all on function public.get_owner_dashboard_review_snapshot() from public, anon, authenticated;
grant execute on function public.get_owner_dashboard_review_snapshot() to authenticated;
