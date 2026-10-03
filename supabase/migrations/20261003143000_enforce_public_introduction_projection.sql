-- A caller of the authenticated publication RPC can supply p_public_data.
-- Enforce the Brief/Detailed projection at the snapshot table boundary too.
create function app_private.public_snapshot_keys_allowed(p_value jsonb, p_allowed text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_value is null or pg_catalog.jsonb_typeof(p_value) = 'object')
    and not exists (
      select 1
      from pg_catalog.jsonb_object_keys(
        case when pg_catalog.jsonb_typeof(p_value) = 'object' then p_value else '{}'::jsonb end
      ) as key_name
      where key_name <> all(p_allowed)
    );
$$;

create function app_private.public_introduction_projection_allowed(p_data jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p_data) = 'object'
    and (p_data ->> 'privacy_mode' is null or p_data ->> 'privacy_mode' in ('private', 'balanced'))
    and app_private.public_snapshot_keys_allowed(p_data,
      array['privacy_mode','personal','style','career','vitals','astrology','education','lifestyle','preferences','family','visibility'])
    and app_private.public_snapshot_keys_allowed(p_data -> 'personal',
      case when p_data ->> 'privacy_mode' = 'private'
        then array['name','first_name','middle_name','last_name','age','current_location','short_bio','marital_status']
        else array['name','first_name','middle_name','last_name','age','current_location','short_bio','marital_status',
          'gender','profile_summary','citizenship','religion','community','sub_community','immigration_status','shared_life_plans'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'style', array['appearance','template_name'])
    and app_private.public_snapshot_keys_allowed(p_data -> 'career',
      case when p_data ->> 'privacy_mode' = 'private' then array['title','location']
        else array['title','location','summary','job_type','career_goals'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'vitals',
      case when p_data ->> 'privacy_mode' = 'private' then array['height'] else array['height','gotra'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'astrology',
      case when p_data ->> 'privacy_mode' = 'private' then array['rashi','nakshatra']
        else array['rashi','nakshatra','maternal_gotra'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'education',
      case when p_data ->> 'privacy_mode' = 'private' then array['qualification_level','degree']
        else array['qualification_level','degree','institution','year','location','summary'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'lifestyle',
      case when p_data ->> 'privacy_mode' = 'private' then array['hobbies','languages','diet','values_statement']
        else array['hobbies','languages','diet','values_statement','drinking','smoking'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'preferences', array['narrative'])
    and app_private.public_snapshot_keys_allowed(p_data -> 'family',
      case when p_data ->> 'privacy_mode' = 'private' then array['public_summary']
        else array['public_summary','paternal_origin','maternal_origin','family_spread','sibling_count','sibling_position'] end)
    and app_private.public_snapshot_keys_allowed(p_data -> 'visibility',
      array['personal_story','journey','lifestyle','family','family_details','astrology','astrology_details',
        'gallery','preferences','future_plans','contact']);
$$;

create or replace function app_private.enforce_public_snapshot_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_mode text;
begin
  if new.data ? 'contact' or app_private.public_snapshot_has_forbidden_key(new.data)
    or not coalesce(app_private.public_introduction_projection_allowed(new.data), false) then
    raise exception 'public snapshot contains a restricted field' using errcode = '23514';
  end if;

  select portfolio.published_data ->> 'privacy_mode' into draft_mode
  from public.portfolios portfolio where portfolio.id = new.portfolio_id;
  if coalesce(draft_mode, 'balanced') <>
    coalesce(new.data ->> 'privacy_mode', 'balanced') then
    raise exception 'public snapshot introduction mode differs from the published draft' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app_private.public_snapshot_keys_allowed(jsonb, text[]) from public, anon, authenticated;
revoke all on function app_private.public_introduction_projection_allowed(jsonb) from public, anon, authenticated;
revoke all on function app_private.enforce_public_snapshot_contract() from public, anon, authenticated;

comment on function app_private.public_introduction_projection_allowed(jsonb) is
  'Server-owned Brief/Detailed public field allowlist. Complete Portfolio access remains a separate approved grant.';
