-- Canonical portfolio geography and country-safe hierarchical matching.
-- This intentionally uses no coordinates, geography types, or PostGIS.

alter table public.portfolios
  add column if not exists country_code text,
  add column if not exists subdivision_code text,
  add column if not exists district_city text,
  add column if not exists pin_zip text,
  add column if not exists is_active boolean generated always as (is_published) stored;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.portfolios'::pg_catalog.regclass
      and conname = 'portfolios_country_code_format'
  ) then
    alter table public.portfolios
      add constraint portfolios_country_code_format
      check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.portfolios'::pg_catalog.regclass
      and conname = 'portfolios_subdivision_code_format'
  ) then
    alter table public.portfolios
      add constraint portfolios_subdivision_code_format
      check (
        subdivision_code is null
        or (
          subdivision_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
          and country_code is not null
          and pg_catalog.split_part(subdivision_code, '-', 1) = country_code
        )
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.portfolios'::pg_catalog.regclass
      and conname = 'portfolios_district_city_length'
  ) then
    alter table public.portfolios
      add constraint portfolios_district_city_length
      check (district_city is null or pg_catalog.length(district_city) between 1 and 160);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.portfolios'::pg_catalog.regclass
      and conname = 'portfolios_pin_zip_length'
  ) then
    alter table public.portfolios
      add constraint portfolios_pin_zip_length
      check (pin_zip is null or pg_catalog.length(pin_zip) between 1 and 20);
  end if;
end
$$;

create or replace function app_private.normalize_hierarchical_postal(
  p_country_code text,
  p_postal_code text
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.upper(pg_catalog.btrim(p_country_code)) = 'US'
      and pg_catalog.btrim(p_postal_code) ~ '^[0-9]{5}(-[0-9]{4})?$'
      then pg_catalog.left(pg_catalog.btrim(p_postal_code), 5)
    when pg_catalog.upper(pg_catalog.btrim(p_country_code)) = 'US' then null
    when pg_catalog.upper(pg_catalog.btrim(p_country_code)) = 'IN'
      and pg_catalog.btrim(p_postal_code) ~ '^[1-9][0-9]{5}$'
      then pg_catalog.btrim(p_postal_code)
    when pg_catalog.upper(pg_catalog.btrim(p_country_code)) = 'IN' then null
    else nullif(pg_catalog.btrim(p_postal_code), '')
  end;
$$;

revoke all on function app_private.normalize_hierarchical_postal(text, text)
  from public, anon, authenticated;

create or replace function app_private.normalize_hierarchical_country(
  p_country_code text
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.upper(pg_catalog.btrim(p_country_code)) ~ '^[A-Z]{2}$'
      then pg_catalog.upper(pg_catalog.btrim(p_country_code))
    else null
  end;
$$;

revoke all on function app_private.normalize_hierarchical_country(text)
  from public, anon, authenticated;

create or replace function app_private.normalize_hierarchical_subdivision(
  p_country_code text,
  p_subdivision_code text
) returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.upper(pg_catalog.btrim(p_country_code)) ~ '^[A-Z]{2}$'
      and pg_catalog.upper(pg_catalog.btrim(p_subdivision_code)) ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
      and pg_catalog.split_part(
        pg_catalog.upper(pg_catalog.btrim(p_subdivision_code)),
        '-',
        1
      ) = pg_catalog.upper(pg_catalog.btrim(p_country_code))
      then pg_catalog.upper(pg_catalog.btrim(p_subdivision_code))
    else null
  end;
$$;

revoke all on function app_private.normalize_hierarchical_subdivision(text, text)
  from public, anon, authenticated;

-- Populate the canonical columns from the already-normalized candidate projection,
-- falling back to the portfolio JSON during the transition.
update public.portfolios portfolio
set
  country_code = app_private.normalize_hierarchical_country(
    coalesce(candidate.current_country_code,
      portfolio.draft_data -> 'personal' ->> 'country_code')
  ),
  subdivision_code = app_private.normalize_hierarchical_subdivision(
    coalesce(
      candidate.current_country_code,
      portfolio.draft_data -> 'personal' ->> 'country_code'
    ),
    coalesce(
      candidate.current_subdivision_code,
      portfolio.draft_data -> 'personal' ->> 'region_code'
    )
  ),
  district_city = coalesce(nullif(pg_catalog.btrim(candidate.current_city), ''),
    nullif(pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'city'), '')),
  pin_zip = app_private.normalize_hierarchical_postal(
    coalesce(
      candidate.current_country_code,
      portfolio.draft_data -> 'personal' ->> 'country_code'
    ),
    coalesce(
      candidate.current_postal_code,
      portfolio.draft_data -> 'personal' ->> 'postal_code'
    )
  )
from public.candidates candidate
where candidate.id = portfolio.candidate_id;

update public.portfolios portfolio
set
  country_code = app_private.normalize_hierarchical_country(
    portfolio.draft_data -> 'personal' ->> 'country_code'
  ),
  subdivision_code = app_private.normalize_hierarchical_subdivision(
    portfolio.draft_data -> 'personal' ->> 'country_code',
    portfolio.draft_data -> 'personal' ->> 'region_code'
  ),
  district_city = nullif(pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'city'), ''),
  pin_zip = app_private.normalize_hierarchical_postal(
    portfolio.draft_data -> 'personal' ->> 'country_code',
    portfolio.draft_data -> 'personal' ->> 'postal_code'
  )
where portfolio.candidate_id is null;

create or replace function app_private.sync_portfolio_structured_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal jsonb := coalesce(new.draft_data -> 'personal', '{}'::jsonb);
begin
  new.country_code := app_private.normalize_hierarchical_country(personal ->> 'country_code');
  new.subdivision_code := app_private.normalize_hierarchical_subdivision(
    personal ->> 'country_code',
    personal ->> 'region_code'
  );
  new.district_city := nullif(pg_catalog.btrim(personal ->> 'city'), '');
  new.pin_zip := app_private.normalize_hierarchical_postal(
    personal ->> 'country_code',
    personal ->> 'postal_code'
  );
  return new;
end
$$;

revoke all on function app_private.sync_portfolio_structured_location()
  from public, anon, authenticated;

drop trigger if exists sync_portfolio_structured_location on public.portfolios;
create trigger sync_portfolio_structured_location
before insert or update of draft_data, country_code, subdivision_code, district_city, pin_zip
on public.portfolios
for each row execute function app_private.sync_portfolio_structured_location();

-- The hierarchy index serves tiers 2-4 through its left-most prefixes. The
-- separate postal index is necessary because pin_zip is not a left-most field
-- in the hierarchy index and tier 1 does not constrain state or city.
create index if not exists portfolios_active_geo_hierarchy_idx
  on public.portfolios (
    country_code,
    subdivision_code,
    district_city,
    pin_zip,
    created_at desc
  )
  where is_active = true and is_published = true;

create index if not exists portfolios_active_country_postal_idx
  on public.portfolios (country_code, pin_zip, created_at desc)
  where is_active = true and is_published = true;

-- Manual entries and provider labels may differ only in case. Keep the
-- required raw hierarchy index, and index the case-folded city lookup too.
create index if not exists portfolios_active_geo_city_ci_idx
  on public.portfolios (country_code, subdivision_code, pg_catalog.lower(district_city), created_at desc)
  where is_active = true and is_published = true;

drop function if exists public.get_hierarchical_matches(uuid, integer);
create function public.get_hierarchical_matches(
  source_portfolio_id uuid,
  limit_count integer default 50
)
returns table (
  id uuid,
  user_id uuid,
  share_token text,
  draft_data jsonb,
  published_data jsonb,
  template_id integer,
  theme_color text,
  sun_sign text,
  is_published boolean,
  published_at timestamptz,
  expires_at timestamptz,
  last_renewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  candidate_id uuid,
  owner_organization_id uuid,
  public_slug text,
  privacy_mode public.portfolio_privacy_mode,
  visibility_settings jsonb,
  country_code text,
  subdivision_code text,
  district_city text,
  pin_zip text,
  is_active boolean,
  proximity_tier integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  source_country_code text;
  source_subdivision_code text;
  source_district_city text;
  source_pin_zip text;
begin
  if source_portfolio_id is null then
    raise exception 'source_portfolio_id is required' using errcode = '22023';
  end if;

  if limit_count is null or limit_count < 1 or limit_count > 200 then
    raise exception 'limit_count must be between 1 and 200' using errcode = '22023';
  end if;

  select
    source.country_code,
    source.subdivision_code,
    source.district_city,
    source.pin_zip
  into
    source_country_code,
    source_subdivision_code,
    source_district_city,
    source_pin_zip
  from public.portfolios source
  where source.id = source_portfolio_id;

  if not found then
    raise exception 'source portfolio not found' using errcode = 'P0002';
  end if;

  -- A country is the minimum safe boundary. Returning no matches is safer than
  -- treating a missing country as a global wildcard.
  if source_country_code is null then
    return;
  end if;

  return query
  with tiered(portfolio, tier) as (
    -- Tier 1: same country and exact postal code.
    select candidate, 1
    from public.portfolios candidate
    where source_pin_zip is not null
      and candidate.id <> source_portfolio_id
      and candidate.is_active = true
      and candidate.is_published = true
      and (candidate.expires_at is null or candidate.expires_at > pg_catalog.now())
      and candidate.country_code = source_country_code
      and candidate.pin_zip = source_pin_zip

    union all

    -- Tier 2: same country, subdivision, and city, excluding tier 1.
    select candidate, 2
    from public.portfolios candidate
    where source_subdivision_code is not null
      and source_district_city is not null
      and candidate.id <> source_portfolio_id
      and candidate.is_active = true
      and candidate.is_published = true
      and (candidate.expires_at is null or candidate.expires_at > pg_catalog.now())
      and candidate.country_code = source_country_code
      and candidate.subdivision_code = source_subdivision_code
      and pg_catalog.lower(candidate.district_city) = pg_catalog.lower(source_district_city)
      and (
        source_pin_zip is null
        or candidate.pin_zip is distinct from source_pin_zip
      )

    union all

    -- Tier 3: same country and subdivision, excluding the same city.
    select candidate, 3
    from public.portfolios candidate
    where source_subdivision_code is not null
      and source_district_city is not null
      and candidate.district_city is not null
      and candidate.id <> source_portfolio_id
      and candidate.is_active = true
      and candidate.is_published = true
      and (candidate.expires_at is null or candidate.expires_at > pg_catalog.now())
      and candidate.country_code = source_country_code
      and candidate.subdivision_code = source_subdivision_code
      and pg_catalog.lower(candidate.district_city) <> pg_catalog.lower(source_district_city)
      and (
        source_pin_zip is null
        or candidate.pin_zip is distinct from source_pin_zip
      )

    union all

    -- Tier 4: same country, excluding the same subdivision.
    select candidate, 4
    from public.portfolios candidate
    where source_subdivision_code is not null
      and candidate.subdivision_code is not null
      and candidate.id <> source_portfolio_id
      and candidate.is_active = true
      and candidate.is_published = true
      and (candidate.expires_at is null or candidate.expires_at > pg_catalog.now())
      and candidate.country_code = source_country_code
      and candidate.subdivision_code <> source_subdivision_code
      and (
        source_pin_zip is null
        or candidate.pin_zip is distinct from source_pin_zip
      )
  )
  select
    (tiered.portfolio).id,
    (tiered.portfolio).user_id,
    (tiered.portfolio).share_token,
    (tiered.portfolio).draft_data,
    (tiered.portfolio).published_data,
    (tiered.portfolio).template_id,
    (tiered.portfolio).theme_color,
    (tiered.portfolio).sun_sign,
    (tiered.portfolio).is_published,
    (tiered.portfolio).published_at,
    (tiered.portfolio).expires_at,
    (tiered.portfolio).last_renewed_at,
    (tiered.portfolio).created_at,
    (tiered.portfolio).updated_at,
    (tiered.portfolio).candidate_id,
    (tiered.portfolio).owner_organization_id,
    (tiered.portfolio).public_slug,
    (tiered.portfolio).privacy_mode,
    (tiered.portfolio).visibility_settings,
    (tiered.portfolio).country_code,
    (tiered.portfolio).subdivision_code,
    (tiered.portfolio).district_city,
    (tiered.portfolio).pin_zip,
    (tiered.portfolio).is_active,
    tiered.tier
  from tiered
  order by tiered.tier asc, (tiered.portfolio).created_at desc, (tiered.portfolio).id
  limit limit_count;
end
$$;

revoke all on function public.get_hierarchical_matches(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_hierarchical_matches(uuid, integer)
  to service_role;

comment on function public.get_hierarchical_matches(uuid, integer) is
  'Service-only country-safe portfolio matching by postal code, city, subdivision, then country. Returns full portfolio rows and must be projected through the owning workflow before client disclosure.';

comment on column public.portfolios.country_code is
  'ISO 3166-1 alpha-2 country code used for relational matching.';
comment on column public.portfolios.subdivision_code is
  'ISO 3166-2 subdivision code whose prefix must equal country_code.';
comment on column public.portfolios.district_city is
  'Provider-normalized district or city name used inside its country and subdivision boundaries.';
comment on column public.portfolios.pin_zip is
  'Postal code stored as text so leading zeroes and country-specific formats are preserved.';
comment on column public.portfolios.is_active is
  'Generated publication-state flag. Matching also checks expires_at at query time.';
