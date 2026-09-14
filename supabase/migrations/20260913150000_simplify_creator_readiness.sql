-- Keep the required publishing path short and inclusive. Cultural and
-- astrology details enrich a portfolio but never block a creator from going live.
create or replace function app_private.portfolio_missing_required_details(
  p_portfolio_id uuid,
  p_draft jsonb
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.array_remove(array[
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,first_name}', pg_catalog.split_part(coalesce(p_draft #>> '{personal,name}', ''), ' ', 1))) = '' then 'first_name' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,last_name}', case when position(' ' in coalesce(p_draft #>> '{personal,name}', '')) > 0 then pg_catalog.regexp_replace(p_draft #>> '{personal,name}', '^\S+\s+', '') else '' end)) = '' then 'last_name' end,
    case
      when coalesce(p_draft #>> '{personal,dob}', '') !~ '^\d{4}-\d{2}-\d{2}$' then 'date_of_birth'
      when pg_catalog.to_char(pg_catalog.to_date(p_draft #>> '{personal,dob}', 'YYYY-MM-DD'), 'YYYY-MM-DD') <> p_draft #>> '{personal,dob}' then 'date_of_birth'
      when pg_catalog.to_date(p_draft #>> '{personal,dob}', 'YYYY-MM-DD') > current_date - interval '18 years' then 'date_of_birth'
    end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,current_location}', '')) = '' then 'current_location' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{career,title}', '')) = '' then 'career_title' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,short_bio}', p_draft #>> '{personal,profile_summary}', '')) = '' then 'introduction' end,
    case when not exists (
      select 1 from public.portfolio_media media
      where media.portfolio_id = p_portfolio_id
        and media.media_type = 'hero'
        and media.visibility in ('public', 'blurred', 'interest_required', 'approved_only')
    ) then 'primary_photo' end
  ], null::text);
$$;

revoke all on function app_private.portfolio_missing_required_details(uuid, jsonb)
  from public, anon, authenticated;

comment on function app_private.portfolio_missing_required_details(uuid, jsonb) is
  'Canonical minimum publishing checklist. Astrology, cultural background, lifestyle, family, and match preferences remain optional enrichment.';
