-- NAK-76: Broker Standard Profile disclosure boundary.
--
-- Broker-mediated introductions may show a Complete-like portfolio, including
-- family, astrology and the published horoscope attachment, but must never
-- expose contact, financial or owner-private questionnaire fields. The
-- projection is derived and version-pinned in the database so a caller cannot
-- increase disclosure by changing an RPC body or URL.

create or replace function app_private.pick_jsonb_keys(p_data jsonb, p_allowed_keys text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_object_agg(entry.key, entry.value)
  from pg_catalog.jsonb_each(
    case when pg_catalog.jsonb_typeof(p_data) = 'object' then p_data else '{}'::jsonb end
  ) entry
  where entry.key = any(p_allowed_keys)
$$;

create or replace function app_private.build_broker_standard_profile(p_complete_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'privacy_mode', p_complete_data -> 'privacy_mode',
    'personal', app_private.pick_jsonb_keys(p_complete_data -> 'personal', array[
      'name','first_name','middle_name','last_name','dob','age','place_of_birth',
      'current_location','gender','marital_status','immigration_status',
      'relocation_preference','short_bio','profile_summary','country','region',
      'city','citizenship','religion','community','sub_community',
      'long_term_goals','shared_life_plans'
    ]::text[]),
    'vitals', app_private.pick_jsonb_keys(p_complete_data -> 'vitals', array[
      'height','gotra'
    ]::text[]),
    'astrology', app_private.pick_jsonb_keys(p_complete_data -> 'astrology', array[
      'rashi','nakshatra','pada','time_of_birth','lagnam','manglik_status','maternal_gotra'
    ]::text[]),
    'education', app_private.pick_jsonb_keys(p_complete_data -> 'education', array[
      'degree','institution','year','location','summary','qualification_level'
    ]::text[]),
    'career', app_private.pick_jsonb_keys(p_complete_data -> 'career', array[
      'title','company','location','summary','job_type','career_goals'
    ]::text[]),
    'family', app_private.pick_jsonb_keys(p_complete_data -> 'family', array[
      'father','mother','siblings','ancestral_origin','paternal_origin',
      'maternal_origin','public_summary','current_settlement','family_note',
      'sibling_count','sibling_position','parents_location','current_country',
      'current_region','current_city','family_spread'
    ]::text[]),
    'lifestyle', app_private.pick_jsonb_keys(p_complete_data -> 'lifestyle', array[
      'hobbies','languages','diet','smoking','drinking','values_statement'
    ]::text[]),
    'preferences', app_private.pick_jsonb_keys(p_complete_data -> 'preferences', array[
      'narrative','age_range','height_range','marital_status','background',
      'visa_preferences','caste_preference','specific_communities',
      'horoscope_preference','marriage_timeline','children_preference',
      'career_after_marriage','living_arrangement','family_responsibilities',
      'religion_preference','lifestyle_expectations','education_expectations',
      'career_expectations'
    ]::text[]),
    'style', app_private.pick_jsonb_keys(p_complete_data -> 'style', array[
      'appearance','template_name'
    ]::text[])
  ))
$$;

create or replace function app_private.broker_standard_profile_has_forbidden_key(p_data jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with recursive nodes(value) as (
    select p_data
    union all
    select child.value
    from nodes parent
    cross join lateral (
      select object_value as value
      from pg_catalog.jsonb_each(
        case when pg_catalog.jsonb_typeof(parent.value) = 'object' then parent.value else '{}'::jsonb end
      ) as object_child(object_key, object_value)
      union all
      select array_value as value
      from pg_catalog.jsonb_array_elements(
        case when pg_catalog.jsonb_typeof(parent.value) = 'array' then parent.value else '[]'::jsonb end
      ) as array_child(array_value)
    ) child
  ), keys(key) as (
    select object_key
    from nodes
    cross join lateral pg_catalog.jsonb_object_keys(
      case when pg_catalog.jsonb_typeof(value) = 'object' then value else '{}'::jsonb end
    ) object_key
  )
  select exists (
    select 1 from keys where key = any(array[
      'contact', 'contact_person', 'phone', 'email', 'secure_note',
      'annual_income', 'income_currency', 'wealth_stage', 'credit_score_band',
      'private_notes', 'location_preference', 'location_preferences',
      'wedding_expectations', 'gift_expectations', 'parent_support',
      'country_code', 'region_code', 'city_geoname_id',
      'current_country_code', 'current_region_code', 'current_city_geoname_id',
      'portfolio_id', 'candidate_id', 'user_id'
    ]::text[])
  )
$$;

revoke all on function app_private.pick_jsonb_keys(jsonb,text[]) from public, anon, authenticated;
revoke all on function app_private.build_broker_standard_profile(jsonb) from public, anon, authenticated;
revoke all on function app_private.broker_standard_profile_has_forbidden_key(jsonb) from public, anon, authenticated;

alter table app_private.portfolio_disclosure_versions
  add column broker_standard_data jsonb;

update app_private.portfolio_disclosure_versions
set broker_standard_data = app_private.build_broker_standard_profile(complete_data);

alter table app_private.portfolio_disclosure_versions
  alter column broker_standard_data set not null,
  add constraint portfolio_disclosure_versions_broker_standard_object
    check (pg_catalog.jsonb_typeof(broker_standard_data) = 'object'),
  add constraint portfolio_disclosure_versions_broker_standard_safe
    check (not app_private.broker_standard_profile_has_forbidden_key(broker_standard_data));

create or replace function app_private.derive_broker_standard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.broker_standard_data := app_private.build_broker_standard_profile(new.complete_data);
  return new;
end;
$$;

revoke all on function app_private.derive_broker_standard_profile() from public, anon, authenticated;

drop trigger if exists derive_broker_standard_profile on app_private.portfolio_disclosure_versions;
create trigger derive_broker_standard_profile
  before insert or update of complete_data, broker_standard_data on app_private.portfolio_disclosure_versions
  for each row execute function app_private.derive_broker_standard_profile();

-- The Detailed fallback is also derived from the pinned version. The legacy
-- RPC parameter remains for deployment compatibility, but cannot alter the
-- persisted disclosure.
create or replace function app_private.derive_broker_introduction_detailed_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select version.public_data into new.detailed_snapshot
  from app_private.portfolio_disclosure_versions version
  where version.id = new.portfolio_version_id;
  if new.detailed_snapshot is null then
    raise exception 'introduction disclosure version is unavailable' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function app_private.derive_broker_introduction_detailed_snapshot() from public, anon, authenticated;

update app_private.broker_introductions introduction
set detailed_snapshot = version.public_data
from app_private.portfolio_disclosure_versions version
where version.id = introduction.portfolio_version_id
  and introduction.detailed_snapshot is distinct from version.public_data;

drop trigger if exists derive_broker_introduction_detailed_snapshot on app_private.broker_introductions;
create trigger derive_broker_introduction_detailed_snapshot
  before insert or update of portfolio_version_id, detailed_snapshot on app_private.broker_introductions
  for each row execute function app_private.derive_broker_introduction_detailed_snapshot();

-- Reconcile the approved 15-day BrokerDesk term for newly created
-- introductions. Existing active links keep their original expiry; extending
-- them silently would expand an already-issued disclosure capability.
create or replace function app_private.set_broker_introduction_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.expires_at := coalesce(new.created_at, pg_catalog.now()) + interval '15 days';
  return new;
end;
$$;

revoke all on function app_private.set_broker_introduction_expiry() from public, anon, authenticated;

drop trigger if exists set_broker_introduction_expiry on app_private.broker_introductions;
create trigger set_broker_introduction_expiry
  before insert on app_private.broker_introductions
  for each row execute function app_private.set_broker_introduction_expiry();

-- Keep the compatibility key `completeData` for one deployment cycle. Its
-- value is now the bounded Broker Standard projection, never complete_data.
-- This permits a database-first rollout without exposing the old payload.
create or replace function public.prepare_broker_introduction(
  p_workspace_ref text,
  p_relationship_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); version_record record;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_workspace_ref !~ '^wrk_[0-9a-f]{32}$'
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or not app_private.member_has_brokerdesk_capability(actor_id, p_workspace_ref, 'introductions.create', p_relationship_ref)
    or not app_private.member_has_brokerdesk_capability(actor_id, p_workspace_ref, 'introductions.send', p_relationship_ref)
    or not app_private.relationship_has_active_mandate(p_workspace_ref, p_relationship_ref, 'introductions.create')
    or not app_private.relationship_has_active_mandate(p_workspace_ref, p_relationship_ref, 'introductions.send')
  then return '{"available":false}'::jsonb; end if;

  select version.version_ref, version.broker_standard_data
  into version_record
  from public.organizations organization
  join public.broker_clients relationship on relationship.organization_id = organization.id
  join public.portfolios portfolio on portfolio.candidate_id = relationship.candidate_id
  join app_private.portfolio_disclosure_versions version on version.portfolio_id = portfolio.id
  where organization.workspace_ref = p_workspace_ref
    and relationship.relationship_ref = p_relationship_ref
    and relationship.relationship_status = 'active'
    and portfolio.is_published = true
    and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
  order by version.version_number desc limit 1;
  if version_record.version_ref is null then return '{"available":false}'::jsonb; end if;
  return pg_catalog.jsonb_build_object(
    'available', true, 'versionRef', version_record.version_ref,
    'completeData', version_record.broker_standard_data
  );
end;
$$;

create or replace function public.resolve_broker_introduction(
  p_introduction_ref text, p_session_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare introduction record; complete_access boolean := false;
begin
  perform app_private.expire_broker_introductions();
  select item.*, version.broker_standard_data,version.public_media,version.complete_media,
    version.horoscope,version.template_id,version.theme_color,version.sun_sign,
    version.version_number
  into introduction
  from app_private.broker_introductions item
  join app_private.portfolio_disclosure_versions version on version.id=item.portfolio_version_id
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients relationship on relationship.id=item.broker_client_id
    and relationship.organization_id=item.organization_id
  join public.portfolios portfolio on portfolio.id=version.portfolio_id
    and portfolio.candidate_id=relationship.candidate_id
  where item.introduction_ref=p_introduction_ref and item.status in ('shared','responded')
    and item.revoked_at is null and item.expires_at>pg_catalog.now()
    and organization.type='matchmaker_agency' and organization.status='active'
    and app_private.brokerdesk_entitlement_enabled(organization.id)
    and relationship.relationship_status='active'
    and portfolio.is_published=true
    and (portfolio.expires_at is null or portfolio.expires_at>pg_catalog.now())
    and app_private.relationship_has_active_mandate(
      organization.workspace_ref,relationship.relationship_ref,'introductions.send'
    );
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if p_session_token_hash is not null and p_session_token_hash ~ '^[a-f0-9]{64}$' then
    select exists(select 1 from app_private.broker_introduction_passes access_pass
      where access_pass.introduction_id=introduction.id
        and access_pass.session_token_hash=p_session_token_hash
        and access_pass.claimed_at is not null and access_pass.revoked_at is null
        and access_pass.expires_at>pg_catalog.now()) into complete_access;
  end if;
  if complete_access then
    update app_private.broker_introduction_passes set last_seen_at=pg_catalog.now()
    where introduction_id=introduction.id;
  end if;
  return pg_catalog.jsonb_build_object(
    'available',true,'introductionRef',introduction.introduction_ref,
    'accessMode',case when complete_access then 'complete' else 'detailed' end,
    'data',case when complete_access then introduction.broker_standard_data else introduction.detailed_snapshot end,
    'media',case when complete_access then introduction.complete_media else introduction.public_media end,
    'horoscope',case when complete_access then introduction.horoscope else null end,
    'templateId',introduction.template_id,'themeColor',introduction.theme_color,
    'sunSign',introduction.sun_sign,'expiresAt',introduction.expires_at,
    'recipientLabel',introduction.recipient_label,'response',introduction.response,
    'responseComment',introduction.response_comment,'respondedAt',introduction.responded_at,
    'versionNumber',introduction.version_number
  );
end;
$$;

comment on column app_private.portfolio_disclosure_versions.broker_standard_data is
  'Immutable Complete-like broker projection excluding contact, financial and owner-private questionnaire fields.';
comment on function public.resolve_broker_introduction(text,text) is
  'Recipient capability endpoint returning Detailed fallback or the version-pinned Broker Standard Profile. The legacy complete accessMode is retained for rollout compatibility.';
