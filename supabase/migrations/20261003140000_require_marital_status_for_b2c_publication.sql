-- Keep the database publication gate aligned with the pilot editor contract.
-- Historical published snapshots remain readable; only new publication is gated.
create or replace function app_private.portfolio_form_list_count(p_value text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.count(distinct pg_catalog.lower(pg_catalog.btrim(item)))::integer
  from pg_catalog.regexp_split_to_table(coalesce(p_value, ''), E'[,;\n]') item
  where pg_catalog.btrim(item) <> '';
$$;

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
  with answer as (
    select
      pg_catalog.btrim(coalesce(p_draft #>> '{personal,first_name}', pg_catalog.split_part(coalesce(p_draft #>> '{personal,name}', ''), ' ', 1))) as first_name,
      pg_catalog.btrim(coalesce(p_draft #>> '{personal,middle_name}', '')) as middle_name,
      pg_catalog.btrim(coalesce(p_draft #>> '{personal,last_name}', case when position(' ' in coalesce(p_draft #>> '{personal,name}', '')) > 0 then pg_catalog.regexp_replace(p_draft #>> '{personal,name}', '^\S+\s+', '') else '' end)) as last_name
  )
  select pg_catalog.array_remove(array[
    case when first_name = '' or pg_catalog.char_length(first_name) > 50 or first_name !~ '^[A-Za-z ''-]+$' then 'first_name' end,
    case when middle_name <> '' and (pg_catalog.char_length(middle_name) > 50 or middle_name !~ '^[A-Za-z ''-]+$') then 'middle_name' end,
    case when last_name = '' or pg_catalog.char_length(last_name) > 50 or last_name !~ '^[A-Za-z ''-]+$' then 'last_name' end,
    case
      when coalesce(p_draft #>> '{personal,dob}', '') !~ '^\d{4}-\d{2}-\d{2}$' then 'date_of_birth'
      when pg_catalog.to_char(pg_catalog.to_date(p_draft #>> '{personal,dob}', 'YYYY-MM-DD'), 'YYYY-MM-DD') <> p_draft #>> '{personal,dob}' then 'date_of_birth'
      when p_draft #>> '{personal,dob}' < '1920-01-01' then 'date_of_birth'
      when pg_catalog.to_date(p_draft #>> '{personal,dob}', 'YYYY-MM-DD') > current_date - interval '18 years' then 'date_of_birth'
    end,
    case when coalesce(p_draft #>> '{personal,gender}', '') not in ('male','female','non_binary','prefer_not_to_say','other') then 'gender' end,
    case when coalesce(p_draft #>> '{vitals,height}', '') !~ '^[4-6]''([0-9]|1[01])"$' and coalesce(p_draft #>> '{vitals,height}', '') <> '7''0"' then 'height' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,country}', '')) = '' then 'current_country' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,city}', '')) = '' then 'current_city' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,current_location}', '')) <>
      pg_catalog.concat_ws(', ', nullif(pg_catalog.btrim(p_draft #>> '{personal,city}'), ''),
        nullif(pg_catalog.btrim(p_draft #>> '{personal,region}'), ''),
        nullif(pg_catalog.btrim(p_draft #>> '{personal,country}'), '')) then 'current_location' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{career,title}', '')) = '' then 'career_title' end,
    case when pg_catalog.char_length(coalesce(p_draft #>> '{career,title}', '')) > 200 then 'career_title' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,marital_status}', '')) = '' then 'marital_status' end,
    case when pg_catalog.char_length(coalesce(p_draft #>> '{personal,marital_status}', '')) > 100 then 'marital_status' end,
    case when pg_catalog.btrim(coalesce(p_draft #>> '{personal,short_bio}', '')) = '' then 'introduction' end,
    case when pg_catalog.char_length(coalesce(p_draft #>> '{personal,short_bio}', '')) > 240 then 'introduction' end,
    case when pg_catalog.char_length(pg_catalog.btrim(coalesce(p_draft #>> '{personal,profile_summary}', ''))) between 1 and 79 then 'personal_story' end,
    case when pg_catalog.char_length(coalesce(p_draft #>> '{personal,profile_summary}', '')) > 1600 then 'personal_story' end,
    case when pg_catalog.char_length(pg_catalog.btrim(coalesce(p_draft #>> '{personal,long_term_goals}', ''))) between 1 and 79 then 'life_goals' end,
    case when pg_catalog.char_length(coalesce(p_draft #>> '{personal,long_term_goals}', '')) > 1200 then 'life_goals' end,
    case when pg_catalog.char_length(pg_catalog.btrim(coalesce(p_draft #>> '{personal,shared_life_plans}', ''))) between 1 and 79 then 'shared_life_plans' end,
    case when pg_catalog.char_length(coalesce(p_draft #>> '{personal,shared_life_plans}', '')) > 1200 then 'shared_life_plans' end,
    case when app_private.portfolio_form_list_count(p_draft #>> '{lifestyle,hobbies}') > 6 then 'interests' end,
    case when app_private.portfolio_form_list_count(p_draft #>> '{lifestyle,values_statement}') > 5 then 'core_values' end,
    case when app_private.portfolio_form_list_count(p_draft #>> '{lifestyle,languages}') > 10 then 'languages' end,
    case when not exists (
      select 1 from public.portfolio_media media
      where media.portfolio_id = p_portfolio_id
        and media.media_type = 'hero'
        and media.visibility in ('public', 'blurred', 'interest_required', 'approved_only')
    ) then 'primary_photo' end
  ], null::text) from answer;
$$;

revoke all on function app_private.portfolio_form_list_count(text)
  from public, anon, authenticated;
revoke all on function app_private.portfolio_missing_required_details(uuid, jsonb)
  from public, anon, authenticated;

comment on function app_private.portfolio_missing_required_details(uuid, jsonb) is
  'Pilot publication contract: required identity/profile facts, optional narrative minimums, and bounded selections. Astrology, family, and match preferences remain optional.';
