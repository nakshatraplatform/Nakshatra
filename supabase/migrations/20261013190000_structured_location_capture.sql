-- Phase 1 structured location support. India and the United States are the
-- product defaults; the schema remains ISO-compatible and intentionally stores no coordinates.

insert into public.reference_countries (country_code, name, is_active)
values ('IN', 'India', true), ('US', 'United States', true)
on conflict (country_code) do update set name = excluded.name, is_active = true;

create table if not exists public.reference_subdivisions (
  subdivision_code text primary key,
  country_code text not null references public.reference_countries(country_code),
  name text not null,
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint reference_subdivisions_iso_code check (subdivision_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'),
  constraint reference_subdivisions_country_prefix check (split_part(subdivision_code, '-', 1) = country_code),
  unique (country_code, name)
);

insert into public.reference_subdivisions (subdivision_code, country_code, name, aliases) values
('IN-AN','IN','Andaman and Nicobar Islands','{}'),('IN-AP','IN','Andhra Pradesh','{}'),('IN-AR','IN','Arunachal Pradesh','{}'),
('IN-AS','IN','Assam','{}'),('IN-BR','IN','Bihar','{}'),('IN-CH','IN','Chandigarh','{}'),('IN-CT','IN','Chhattisgarh','{Chattisgarh}'),
('IN-DH','IN','Dadra and Nagar Haveli and Daman and Diu','{}'),('IN-DL','IN','Delhi','{"NCT of Delhi"}'),('IN-GA','IN','Goa','{}'),
('IN-GJ','IN','Gujarat','{}'),('IN-HR','IN','Haryana','{}'),('IN-HP','IN','Himachal Pradesh','{}'),('IN-JK','IN','Jammu and Kashmir','{}'),
('IN-JH','IN','Jharkhand','{}'),('IN-KA','IN','Karnataka','{}'),('IN-KL','IN','Kerala','{}'),('IN-LA','IN','Ladakh','{}'),
('IN-LD','IN','Lakshadweep','{}'),('IN-MP','IN','Madhya Pradesh','{}'),('IN-MH','IN','Maharashtra','{}'),('IN-MN','IN','Manipur','{}'),
('IN-ML','IN','Meghalaya','{}'),('IN-MZ','IN','Mizoram','{}'),('IN-NL','IN','Nagaland','{}'),('IN-OD','IN','Odisha','{Orissa}'),
('IN-PY','IN','Puducherry','{Pondicherry}'),('IN-PB','IN','Punjab','{}'),('IN-RJ','IN','Rajasthan','{}'),('IN-SK','IN','Sikkim','{}'),
('IN-TN','IN','Tamil Nadu','{}'),('IN-TG','IN','Telangana','{}'),('IN-TR','IN','Tripura','{}'),('IN-UP','IN','Uttar Pradesh','{}'),
('IN-UT','IN','Uttarakhand','{Uttaranchal}'),('IN-WB','IN','West Bengal','{}'),
('US-AL','US','Alabama','{}'),('US-AK','US','Alaska','{}'),('US-AZ','US','Arizona','{}'),('US-AR','US','Arkansas','{}'),
('US-CA','US','California','{}'),('US-CO','US','Colorado','{}'),('US-CT','US','Connecticut','{}'),('US-DE','US','Delaware','{}'),
('US-DC','US','District of Columbia','{"Washington DC"}'),('US-FL','US','Florida','{}'),('US-GA','US','Georgia','{}'),('US-HI','US','Hawaii','{}'),
('US-ID','US','Idaho','{}'),('US-IL','US','Illinois','{}'),('US-IN','US','Indiana','{}'),('US-IA','US','Iowa','{}'),
('US-KS','US','Kansas','{}'),('US-KY','US','Kentucky','{}'),('US-LA','US','Louisiana','{}'),('US-ME','US','Maine','{}'),
('US-MD','US','Maryland','{}'),('US-MA','US','Massachusetts','{}'),('US-MI','US','Michigan','{}'),('US-MN','US','Minnesota','{}'),
('US-MS','US','Mississippi','{}'),('US-MO','US','Missouri','{}'),('US-MT','US','Montana','{}'),('US-NE','US','Nebraska','{}'),
('US-NV','US','Nevada','{}'),('US-NH','US','New Hampshire','{}'),('US-NJ','US','New Jersey','{}'),('US-NM','US','New Mexico','{}'),
('US-NY','US','New York','{}'),('US-NC','US','North Carolina','{}'),('US-ND','US','North Dakota','{}'),('US-OH','US','Ohio','{}'),
('US-OK','US','Oklahoma','{}'),('US-OR','US','Oregon','{}'),('US-PA','US','Pennsylvania','{}'),('US-RI','US','Rhode Island','{}'),
('US-SC','US','South Carolina','{}'),('US-SD','US','South Dakota','{}'),('US-TN','US','Tennessee','{}'),('US-TX','US','Texas','{}'),
('US-UT','US','Utah','{}'),('US-VT','US','Vermont','{}'),('US-VA','US','Virginia','{}'),('US-WA','US','Washington','{}'),
('US-WV','US','West Virginia','{}'),('US-WI','US','Wisconsin','{}'),('US-WY','US','Wyoming','{}'),
('US-AS','US','American Samoa','{}'),('US-GU','US','Guam','{}'),('US-MP','US','Northern Mariana Islands','{}'),
('US-PR','US','Puerto Rico','{}'),('US-UM','US','United States Minor Outlying Islands','{}'),('US-VI','US','United States Virgin Islands',array['Virgin Islands, U.S.','U.S. Virgin Islands']::text[])
on conflict (subdivision_code) do update set name = excluded.name, aliases = excluded.aliases, is_active = true, updated_at = now();

alter table public.reference_subdivisions enable row level security;
drop policy if exists reference_subdivisions_authenticated_read on public.reference_subdivisions;
create policy reference_subdivisions_authenticated_read on public.reference_subdivisions for select to authenticated using (is_active = true);
grant select on public.reference_subdivisions to authenticated;

alter table public.candidates
  add column if not exists current_country_code text references public.reference_countries(country_code),
  add column if not exists current_region_code text,
  add column if not exists current_subdivision_code text references public.reference_subdivisions(subdivision_code),
  add column if not exists current_city_geoname_id bigint references public.reference_cities(geoname_id),
  add column if not exists current_postal_code text,
  add column if not exists location_source text,
  add constraint candidates_location_source_check check (location_source is null or location_source in ('google_places','postalpincode','zippopotam','geonames','manual','existing_profile')),
  add constraint candidates_country_subdivision_match check (current_subdivision_code is null or current_country_code = split_part(current_subdivision_code, '-', 1));

create index if not exists candidates_structured_location_idx
  on public.candidates (current_country_code, current_subdivision_code, current_city, current_postal_code);

alter table public.interest_requests
  add column if not exists country text,
  add column if not exists country_code text references public.reference_countries(country_code),
  add column if not exists state text,
  add column if not exists subdivision_code text references public.reference_subdivisions(subdivision_code),
  add column if not exists city text,
  add column if not exists city_geoname_id bigint references public.reference_cities(geoname_id),
  add column if not exists postal_code text,
  add column if not exists location_source text,
  add constraint interest_location_source_check check (location_source is null or location_source in ('google_places','postalpincode','zippopotam','geonames','manual','existing_profile')),
  add constraint interest_country_subdivision_match check (subdivision_code is null or country_code = split_part(subdivision_code, '-', 1));

create index if not exists interest_requests_structured_location_idx
  on public.interest_requests (country_code, subdivision_code, city, postal_code);

create or replace function app_private.reference_city_matches_location(
  p_city_geoname_id bigint,
  p_country_code text,
  p_city text
) returns boolean language sql stable security definer set search_path = '' as $$
  select p_city_geoname_id is not null and exists(
    select 1 from public.reference_cities city_reference
    where city_reference.geoname_id = p_city_geoname_id
      and city_reference.country_code = p_country_code
      and city_reference.is_active
      and (
        pg_catalog.lower(city_reference.name) = pg_catalog.lower(pg_catalog.btrim(p_city))
        or pg_catalog.lower(coalesce(city_reference.ascii_name, ''::text)) = pg_catalog.lower(pg_catalog.btrim(p_city))
        or exists(
          select 1 from pg_catalog.unnest(city_reference.alternative_names) as alternative(alternative_name)
          where pg_catalog.lower(alternative.alternative_name) = pg_catalog.lower(pg_catalog.btrim(p_city))
        )
      )
  );
$$;

revoke all on function app_private.reference_city_matches_location(bigint,text,text) from public, anon, authenticated;

create or replace function app_private.reference_city_matches_subdivision(
  p_city_geoname_id bigint,
  p_country_code text,
  p_subdivision_code text,
  p_city text
) returns boolean language sql stable security definer set search_path = '' as $$
  select p_city_geoname_id is not null and exists(
    select 1
    from public.reference_cities city_reference
    join public.reference_regions region_reference
      on region_reference.country_code = city_reference.country_code
      and region_reference.region_code = city_reference.region_code
      and region_reference.is_active
    join public.reference_subdivisions subdivision_reference
      on subdivision_reference.country_code = city_reference.country_code
      and subdivision_reference.subdivision_code = p_subdivision_code
      and subdivision_reference.is_active
      and (
        pg_catalog.lower(subdivision_reference.name) = pg_catalog.lower(region_reference.name)
        or exists (
          select 1
          from pg_catalog.unnest(subdivision_reference.aliases) alias(alias_name)
          where pg_catalog.lower(alias.alias_name) = pg_catalog.lower(region_reference.name)
        )
      )
    where city_reference.geoname_id = p_city_geoname_id
      and city_reference.country_code = p_country_code
      and city_reference.is_active
      and (
        pg_catalog.lower(city_reference.name) = pg_catalog.lower(pg_catalog.btrim(p_city))
        or pg_catalog.lower(coalesce(city_reference.ascii_name, ''::text)) = pg_catalog.lower(pg_catalog.btrim(p_city))
        or exists(
          select 1 from pg_catalog.unnest(city_reference.alternative_names) as alternative(alternative_name)
          where pg_catalog.lower(alternative.alternative_name) = pg_catalog.lower(pg_catalog.btrim(p_city))
        )
      )
  );
$$;

revoke all on function app_private.reference_city_matches_subdivision(bigint,text,text,text)
  from public, anon, authenticated;

-- Production already has a GeoNames-backed canonical geography trigger. Teach
-- that boundary to accept the new ISO 3166-2 code without discarding the
-- legacy GeoNames region code used by existing records and city foreign keys.
create or replace function app_private.normalize_portfolio_geography(p_location jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  location jsonb := coalesce(p_location, '{}'::jsonb);
  country public.reference_countries%rowtype;
  legacy_region public.reference_regions%rowtype;
  subdivision public.reference_subdivisions%rowtype;
  city public.reference_cities%rowtype;
  v_country_code text := nullif(pg_catalog.upper(pg_catalog.btrim(p_location ->> 'country_code')), '');
  v_region_code text := nullif(pg_catalog.btrim(p_location ->> 'region_code'), '');
  v_subdivision_code text := nullif(pg_catalog.upper(pg_catalog.btrim(p_location ->> 'region_code')), '');
  city_id text := nullif(p_location ->> 'city_geoname_id', '');
begin
  if v_country_code is null then
    if v_region_code is not null or city_id is not null then
      raise exception 'geography_parent_required' using errcode = '22023';
    end if;
    return location;
  end if;

  select reference_country.* into country
  from public.reference_countries reference_country
  where reference_country.country_code = v_country_code and reference_country.is_active;
  if country.country_code is null then
    raise exception 'geography_country_invalid' using errcode = '22023';
  end if;
  location := location || pg_catalog.jsonb_build_object(
    'country_code', country.country_code,
    'country', country.name
  );

  if v_subdivision_code is not null
    and v_subdivision_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
  then
    select reference_subdivision.* into subdivision
    from public.reference_subdivisions reference_subdivision
    where reference_subdivision.country_code = v_country_code
      and reference_subdivision.subdivision_code = v_subdivision_code
      and reference_subdivision.is_active;
    if subdivision.subdivision_code is null then
      raise exception 'geography_region_invalid' using errcode = '22023';
    end if;
    location := location || pg_catalog.jsonb_build_object(
      'region_code', subdivision.subdivision_code,
      'region', subdivision.name
    );
  elsif v_region_code is not null then
    select reference_region.* into legacy_region
    from public.reference_regions reference_region
    where reference_region.country_code = v_country_code
      and reference_region.region_code = v_region_code
      and reference_region.is_active;
    if legacy_region.geoname_id is null then
      raise exception 'geography_region_invalid' using errcode = '22023';
    end if;
    location := location || pg_catalog.jsonb_build_object(
      'region_code', legacy_region.region_code,
      'region', legacy_region.name
    );
  end if;

  if city_id is not null then
    if city_id !~ '^[0-9]{1,15}$' then
      raise exception 'geography_city_invalid' using errcode = '22023';
    end if;
    select reference_city.* into city
    from public.reference_cities reference_city
    where reference_city.geoname_id = city_id::bigint
      and reference_city.is_active
      and reference_city.country_code = v_country_code;
    if city.geoname_id is null then
      raise exception 'geography_city_hierarchy_invalid' using errcode = '22023';
    end if;

    if subdivision.subdivision_code is not null and city.region_code is not null then
      select reference_region.* into legacy_region
      from public.reference_regions reference_region
      where reference_region.country_code = v_country_code
        and reference_region.region_code = city.region_code
        and reference_region.is_active;
      if legacy_region.geoname_id is null or not (
        pg_catalog.lower(legacy_region.name) = pg_catalog.lower(subdivision.name)
        or exists (
          select 1
          from pg_catalog.unnest(subdivision.aliases) alias(alias_name)
          where pg_catalog.lower(alias.alias_name) = pg_catalog.lower(legacy_region.name)
        )
      ) then
        raise exception 'geography_city_hierarchy_invalid' using errcode = '22023';
      end if;
    elsif legacy_region.geoname_id is not null
      and city.region_code is distinct from legacy_region.region_code then
      raise exception 'geography_city_hierarchy_invalid' using errcode = '22023';
    end if;

    location := location || pg_catalog.jsonb_build_object(
      'city_geoname_id', city.geoname_id,
      'city', city.name
    );
    if subdivision.subdivision_code is null and city.region_code is not null then
      select reference_region.* into legacy_region
      from public.reference_regions reference_region
      where reference_region.country_code = v_country_code
        and reference_region.region_code = city.region_code
        and reference_region.is_active;
      if legacy_region.geoname_id is not null then
        location := location || pg_catalog.jsonb_build_object(
          'region_code', legacy_region.region_code,
          'region', legacy_region.name
        );
      end if;
    end if;
  end if;
  return location;
end;
$$;

revoke all on function app_private.normalize_portfolio_geography(jsonb)
  from public, anon, authenticated;

create or replace function app_private.enforce_portfolio_geography()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  personal jsonb;
begin
  personal := app_private.normalize_portfolio_geography(new.draft_data -> 'personal');
  if new.draft_data ? 'personal' then
    if personal ? 'country_code' then
      personal := personal || pg_catalog.jsonb_build_object(
        'current_location',
        pg_catalog.concat_ws(
          ', ',
          nullif(personal ->> 'city', ''),
          nullif(personal ->> 'region', ''),
          nullif(personal ->> 'country', '')
        )
      );
    end if;
    new.draft_data := pg_catalog.jsonb_set(new.draft_data, '{personal}', personal);
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_portfolio_geography()
  from public, anon, authenticated;

drop trigger if exists portfolio_geography on public.portfolios;
create trigger portfolio_geography
before insert or update of draft_data on public.portfolios
for each row execute function app_private.enforce_portfolio_geography();

create or replace function app_private.enforce_candidate_geography()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  location jsonb;
  canonical_region_code text;
  mapped_legacy_region_code text;
  mapped_subdivision_code text;
begin
  if new.current_country_code is null then
    -- Legacy/manual locations can have labels without a canonical country code.
    -- The caller must explicitly null labels to remove them; a manual replacement
    -- may use the same text as the former canonical choice.
    if tg_op = 'UPDATE' and old.current_country_code is not null then
      new.current_region_code := null;
      new.current_subdivision_code := null;
      new.current_city_geoname_id := null;
      new.current_postal_code := null;
      new.location_source := null;
      -- If a higher manual label changes, unchanged lower labels belong to the
      -- former hierarchy and must not be carried into the new one.
      if new.current_country is distinct from old.current_country then
        if new.current_region is not distinct from old.current_region then new.current_region := null; end if;
        if new.current_city is not distinct from old.current_city then new.current_city := null; end if;
      elsif new.current_region is distinct from old.current_region then
        if new.current_city is not distinct from old.current_city then new.current_city := null; end if;
      end if;
    end if;
    return new;
  end if;

  canonical_region_code := case
    when tg_op = 'UPDATE'
      and new.current_subdivision_code is distinct from old.current_subdivision_code
      and new.current_region_code is not distinct from old.current_region_code
      then new.current_subdivision_code
    else coalesce(new.current_region_code, new.current_subdivision_code)
  end;
  location := app_private.normalize_portfolio_geography(pg_catalog.jsonb_build_object(
    'country_code', new.current_country_code,
    'region_code', canonical_region_code,
    'city_geoname_id', new.current_city_geoname_id
  ));

  if new.current_country_code is not null then
    new.current_country := location ->> 'country';
  end if;
  if location ->> 'region_code' ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$' then
    new.current_subdivision_code := location ->> 'region_code';
    new.current_region := location ->> 'region';
    select reference_region.region_code into mapped_legacy_region_code
    from public.reference_regions reference_region
    join public.reference_subdivisions reference_subdivision
      on reference_subdivision.subdivision_code = new.current_subdivision_code
      and reference_subdivision.country_code = reference_region.country_code
      and (
        pg_catalog.lower(reference_region.name) = pg_catalog.lower(reference_subdivision.name)
        or exists (
          select 1
          from pg_catalog.unnest(reference_subdivision.aliases) alias(alias_name)
          where pg_catalog.lower(alias.alias_name) = pg_catalog.lower(reference_region.name)
        )
      )
    where reference_region.country_code = new.current_country_code
      and reference_region.is_active
    order by reference_region.geoname_id
    limit 1;
    new.current_region_code := mapped_legacy_region_code;
  else
    new.current_region_code := nullif(location ->> 'region_code', '');
    new.current_region := coalesce(nullif(location ->> 'region', ''), new.current_region);
    select reference_subdivision.subdivision_code into mapped_subdivision_code
    from public.reference_subdivisions reference_subdivision
    where reference_subdivision.country_code = new.current_country_code
      and reference_subdivision.is_active
      and (
        pg_catalog.lower(reference_subdivision.name) = pg_catalog.lower(location ->> 'region')
        or exists (
          select 1
          from pg_catalog.unnest(reference_subdivision.aliases) alias(alias_name)
          where pg_catalog.lower(alias.alias_name) = pg_catalog.lower(location ->> 'region')
        )
      )
    order by reference_subdivision.subdivision_code
    limit 1;
    new.current_subdivision_code := mapped_subdivision_code;
  end if;
  if new.current_city_geoname_id is not null then
    new.current_city := location ->> 'city';
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_candidate_geography()
  from public, anon, authenticated;

drop trigger if exists candidate_geography on public.candidates;
create trigger candidate_geography
before insert or update of current_country_code, current_region_code,
  current_subdivision_code, current_city_geoname_id, current_country,
  current_region, current_city
on public.candidates
for each row execute function app_private.enforce_candidate_geography();

create or replace function app_private.sync_candidate_structured_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p jsonb := coalesce(new.draft_data -> 'personal', '{}'::jsonb);
begin
  if new.candidate_id is null then return new; end if;
  update public.candidates set
    current_country_code = (
      select country.country_code
      from public.reference_countries country
      where country.country_code = pg_catalog.upper(pg_catalog.btrim(p ->> 'country_code'))
        and country.is_active
    ),
    current_region_code = nullif(pg_catalog.btrim(p ->> 'region_code'), ''),
    current_subdivision_code = (select s.subdivision_code from public.reference_subdivisions s where s.country_code=p ->> 'country_code' and (s.subdivision_code=p ->> 'region_code' or pg_catalog.lower(s.name)=pg_catalog.lower(p ->> 'region')) limit 1),
    current_city_geoname_id = case
      when (p ->> 'city_geoname_id') ~ '^\d+$'
        and app_private.reference_city_matches_location((p ->> 'city_geoname_id')::bigint, p ->> 'country_code', p ->> 'city')
      then (p ->> 'city_geoname_id')::bigint else null
    end,
    current_postal_code = case
      when p ->> 'country_code' = 'US' and pg_catalog.btrim(p ->> 'postal_code') ~ '^[0-9]{5}(-[0-9]{4})?$'
        then pg_catalog.left(pg_catalog.btrim(p ->> 'postal_code'), 5)
      when p ->> 'country_code' = 'IN' and pg_catalog.btrim(p ->> 'postal_code') ~ '^[1-9][0-9]{5}$'
        then pg_catalog.btrim(p ->> 'postal_code')
      else null
    end,
    location_source = case when p ->> 'location_source' in ('google_places','postalpincode','zippopotam','geonames','manual','existing_profile') then p ->> 'location_source' else null end
  where id = new.candidate_id;
  return new;
end $$;

drop trigger if exists sync_candidate_structured_location on public.portfolios;
create trigger sync_candidate_structured_location after insert or update of draft_data, candidate_id on public.portfolios
for each row execute function app_private.sync_candidate_structured_location();

update public.portfolios
set draft_data = pg_catalog.jsonb_set(
  draft_data,
  '{personal,postal_code}',
  pg_catalog.to_jsonb(pg_catalog.left(pg_catalog.btrim(draft_data -> 'personal' ->> 'postal_code'), 5)),
  false
)
where draft_data -> 'personal' ->> 'country_code' = 'US'
  and pg_catalog.btrim(draft_data -> 'personal' ->> 'postal_code') ~ '^[0-9]{5}-[0-9]{4}$';

update public.candidates candidate set
  current_country_code = (
    select country.country_code
    from public.reference_countries country
    where country.country_code = pg_catalog.upper(pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'country_code'))
      and country.is_active
  ),
  current_region_code = nullif(pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'region_code'), ''),
  current_subdivision_code = (select s.subdivision_code from public.reference_subdivisions s where s.country_code=portfolio.draft_data -> 'personal' ->> 'country_code' and (s.subdivision_code=portfolio.draft_data -> 'personal' ->> 'region_code' or pg_catalog.lower(s.name)=pg_catalog.lower(portfolio.draft_data -> 'personal' ->> 'region')) limit 1),
  current_city_geoname_id = case
    when (portfolio.draft_data -> 'personal' ->> 'city_geoname_id') ~ '^\d+$'
      and app_private.reference_city_matches_location(
        (portfolio.draft_data -> 'personal' ->> 'city_geoname_id')::bigint,
        portfolio.draft_data -> 'personal' ->> 'country_code',
        portfolio.draft_data -> 'personal' ->> 'city'
      )
    then (portfolio.draft_data -> 'personal' ->> 'city_geoname_id')::bigint else null
  end,
  current_postal_code = case
    when portfolio.draft_data -> 'personal' ->> 'country_code' = 'US'
      and pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'postal_code') ~ '^[0-9]{5}(-[0-9]{4})?$'
      then pg_catalog.left(pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'postal_code'), 5)
    when portfolio.draft_data -> 'personal' ->> 'country_code' = 'IN'
      and pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'postal_code') ~ '^[1-9][0-9]{5}$'
      then pg_catalog.btrim(portfolio.draft_data -> 'personal' ->> 'postal_code')
    else null
  end,
  location_source = case when portfolio.draft_data -> 'personal' ->> 'location_source' in ('google_places','postalpincode','zippopotam','geonames','manual','existing_profile') then portfolio.draft_data -> 'personal' ->> 'location_source' else null end
from public.portfolios portfolio where portfolio.candidate_id = candidate.id;

-- Preserve the authenticated interest commands introduced on main. The
-- structured-location extension is applied to those commands below without
-- reopening the retired direct submit_public_interest entry point.

create or replace function app_private.structured_interest_location(p_location jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; city_id bigint;
begin
  if pg_catalog.jsonb_typeof(p_location) is distinct from 'object'
    or coalesce(p_location->>'countryCode','') not in ('IN','US')
    or coalesce(p_location->>'subdivisionCode','') !~ '^(IN|US)-[A-Z0-9]{1,3}$'
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_location->>'city',''))) not between 1 and 120
    or coalesce(p_location->>'locationSource','') not in ('google_places','postalpincode','zippopotam','geonames','manual','existing_profile')
    or (p_location->>'countryCode'='IN' and coalesce(p_location->>'postalCode','') !~ '^[1-9][0-9]{5}$')
    or (p_location->>'countryCode'='US' and coalesce(p_location->>'postalCode','') !~ '^[0-9]{5}$')
    or (p_location ? 'cityGeonameId' and p_location->>'cityGeonameId' is not null
      and p_location->>'cityGeonameId' !~ '^[1-9][0-9]{0,14}$') then
    raise exception 'invalid interest location' using errcode='22023';
  end if;
  select pg_catalog.jsonb_build_object(
    'country',country.name,'state',subdivision.name,'city',pg_catalog.btrim(p_location->>'city'),
    'countryCode',country.country_code,'subdivisionCode',subdivision.subdivision_code,
    'postalCode',p_location->>'postalCode','locationSource',p_location->>'locationSource')
  into result
  from public.reference_countries country
  join public.reference_subdivisions subdivision on subdivision.country_code=country.country_code
  where country.is_active and subdivision.is_active
    and country.country_code=p_location->>'countryCode'
    and subdivision.subdivision_code=p_location->>'subdivisionCode'
    and pg_catalog.lower(country.name)=pg_catalog.lower(pg_catalog.btrim(p_location->>'country'))
    and pg_catalog.lower(subdivision.name)=pg_catalog.lower(pg_catalog.btrim(p_location->>'state'));
  if result is null then raise exception 'invalid interest location' using errcode='22023'; end if;
  if p_location->>'cityGeonameId' is not null then
    city_id:=(p_location->>'cityGeonameId')::bigint;
    if not app_private.reference_city_matches_subdivision(
      city_id,p_location->>'countryCode',p_location->>'subdivisionCode',p_location->>'city')
    then raise exception 'invalid interest location' using errcode='22023'; end if;
    result:=result || pg_catalog.jsonb_build_object('cityId',city_id);
  end if;
  return result;
end $$;
revoke all on function app_private.structured_interest_location(jsonb) from public,anon,authenticated;

create or replace function public.submit_interest_details(p_details jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare location jsonb; candidate_location jsonb; candidate jsonb; field text; target_id uuid; request_id uuid; previous_id uuid; accepted boolean;
begin
  perform app_private.require_current_session();
  if pg_catalog.jsonb_typeof(p_details) is distinct from 'object' then raise exception 'invalid interest request' using errcode='22023'; end if;
  foreach field in array array['portfolioToken','name','email','phone','profileFor','familyContext','message'] loop
    if pg_catalog.jsonb_typeof(p_details->field) is distinct from 'string' then raise exception 'invalid interest request' using errcode='22023'; end if;
  end loop;
  p_details:=p_details || pg_catalog.jsonb_build_object(
    'name',app_private.trim_interest_text(p_details->>'name'), 'email',app_private.trim_interest_text(p_details->>'email'),
    'phone',app_private.trim_interest_text(p_details->>'phone'), 'familyContext',app_private.trim_interest_text(p_details->>'familyContext'),
    'message',app_private.trim_interest_text(p_details->>'message'));
  if pg_catalog.jsonb_typeof(p_details) is distinct from 'object'
    or pg_catalog.length(coalesce(pg_catalog.btrim(p_details->>'familyContext'),'')) not between 40 and 600
    or pg_catalog.length(coalesce(pg_catalog.btrim(p_details->>'message'),'')) not between 80 and 600
    or coalesce(p_details->>'name','') !~ '[[:alpha:]]'
    or coalesce(p_details->>'phone','') !~ '^\+?[0-9][0-9\s().-]*$'
    or pg_catalog.length(coalesce(p_details->>'phone',''))>40 then
    raise exception 'invalid interest request' using errcode='22023';
  end if;
  location:=app_private.structured_interest_location(p_details->'location');
  if p_details->>'profileFor'<>'self' then
    candidate:=p_details->'candidate';
    if pg_catalog.jsonb_typeof(candidate)='object' then
      foreach field in array array['name','email','phone','relationship'] loop
        if pg_catalog.jsonb_typeof(candidate->field) is distinct from 'string' then raise exception 'invalid candidate details' using errcode='22023'; end if;
      end loop;
      candidate:=candidate || pg_catalog.jsonb_build_object('name',app_private.trim_interest_text(candidate->>'name'),
        'email',app_private.trim_interest_text(candidate->>'email'),'phone',app_private.trim_interest_text(candidate->>'phone'),
        'relationship',app_private.trim_interest_text(candidate->>'relationship'));
    end if;
    if pg_catalog.jsonb_typeof(candidate) is distinct from 'object'
      or pg_catalog.length(coalesce(pg_catalog.btrim(candidate->>'name'),'')) not between 2 and 180
      or coalesce(candidate->>'name','') !~ '[[:alpha:]]'
      or pg_catalog.length(coalesce(candidate->>'email','')) not between 3 and 180
      or coalesce(candidate->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or pg_catalog.length(coalesce(candidate->>'phone',''))>40
      or coalesce(candidate->>'phone','') !~ '^\+?[0-9][0-9\s().-]*$'
      or pg_catalog.length(pg_catalog.regexp_replace(coalesce(candidate->>'phone',''),'\D','','g')) not between 7 and 20
      or pg_catalog.length(coalesce(pg_catalog.btrim(candidate->>'relationship'),'')) not between 2 and 80 then
      raise exception 'invalid candidate details' using errcode='22023';
    end if;
    candidate_location:=app_private.interest_location(candidate->'location');
    candidate:=pg_catalog.jsonb_build_object('name',pg_catalog.btrim(candidate->>'name'),'email',pg_catalog.lower(pg_catalog.btrim(candidate->>'email')),
      'phone',pg_catalog.btrim(candidate->>'phone'),'relationship',pg_catalog.btrim(candidate->>'relationship'),'location',candidate_location);
  else candidate:=null; end if;
  -- Serialize with the existing command's portfolio lock. Retries do not rewrite
  -- a submission that an owner has already used to make an access decision.
  select id into target_id from public.portfolios where share_token=p_details->>'portfolioToken' for update;
  select id into previous_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid()
    and status in ('new','pending_review','approved','revealed','rejected') order by created_at desc limit 1;
  accepted:=public.submit_public_interest(p_details->>'portfolioToken',p_details->>'name',p_details->>'profileFor',p_details->>'phone',p_details->>'email',
    null,p_details->>'familyContext',p_details->>'message',null,location->>'country',location->>'state',location->>'city');
  if not accepted or previous_id is not null then return accepted; end if;
  select id into request_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid() order by created_at desc limit 1;
  update public.interest_requests set metadata=metadata || pg_catalog.jsonb_build_object('location_details',location)
    || case when candidate is null then '{}'::jsonb else pg_catalog.jsonb_build_object('candidate',candidate) end,
    country_code=location->>'countryCode', country=location->>'country',
    subdivision_code=location->>'subdivisionCode', state=location->>'state',
    city=location->>'city', city_geoname_id=nullif(location->>'cityId','')::bigint,
    postal_code=location->>'postalCode', location_source=location->>'locationSource'
    where id=request_id;
  return true;
end $$;
revoke all on function public.submit_interest_details(jsonb) from public,anon;
grant execute on function public.submit_interest_details(jsonb) to authenticated;

create or replace function public.submit_existing_interest(
  p_share_token text, p_family_context text, p_message text, p_location jsonb
) returns boolean language plpgsql security definer set search_path='' as $$
declare location jsonb; target_id uuid; previous_id uuid; request_id uuid; accepted boolean;
begin
  perform app_private.require_current_session();
  location:=app_private.structured_interest_location(p_location);
  select id into target_id from public.portfolios where share_token=p_share_token for update;
  select id into previous_id from public.interest_requests
    where portfolio_id=target_id and requester_user_id=auth.uid()
      and status in ('new','pending_review','approved','revealed','rejected')
    order by created_at desc limit 1;
  accepted:=public.submit_existing_interest(p_share_token,p_family_context,p_message);
  if accepted and previous_id is null then
    select id into request_id from public.interest_requests
      where portfolio_id=target_id and requester_user_id=auth.uid() and status='new'
      order by created_at desc limit 1;
    update public.interest_requests set
      metadata=metadata || pg_catalog.jsonb_build_object('location_details',location),
      country_code=location->>'countryCode', country=location->>'country',
      subdivision_code=location->>'subdivisionCode', state=location->>'state',
      city=location->>'city', city_geoname_id=nullif(location->>'cityId','')::bigint,
      postal_code=location->>'postalCode', location_source=location->>'locationSource'
      where id=request_id;
  end if;
  return accepted;
end $$;
revoke all on function public.submit_existing_interest(text,text,text,jsonb) from public,anon;
grant execute on function public.submit_existing_interest(text,text,text,jsonb) to authenticated;
revoke execute on function public.submit_existing_interest(text,text,text) from authenticated;
comment on table public.reference_subdivisions is 'ISO 3166-2 subdivisions enabled for structured VivIntro locations.';
comment on column public.candidates.current_country_code is 'ISO 3166-1 alpha-2 country code; no coordinates are stored in Phase 1.';

-- Keep provider provenance and structured identifiers out of all disclosure projections.
create or replace function app_private.jsonb_has_any_key(p_data jsonb, p_keys text[])
returns boolean language sql immutable set search_path='' as $$
  with recursive nodes(value) as (
    select p_data
    union all
    select child.value from nodes parent cross join lateral (
      select object_value as value from pg_catalog.jsonb_each(case when pg_catalog.jsonb_typeof(parent.value)='object' then parent.value else '{}'::jsonb end) object_child(object_key,object_value)
      union all
      select array_value as value from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(parent.value)='array' then parent.value else '[]'::jsonb end) array_child(array_value)
    ) child
  )
  select exists(select 1 from nodes cross join lateral pg_catalog.jsonb_object_keys(case when pg_catalog.jsonb_typeof(value)='object' then value else '{}'::jsonb end) key where key=any(p_keys));
$$;

create or replace function app_private.public_snapshot_has_forbidden_key(p_data jsonb)
returns boolean language sql immutable set search_path='' as $$
  select app_private.jsonb_has_any_key(p_data, array[
    'contacts','phone','email','secure_note','photo_url','photo_thumb_url','storage_path','thumbnail_path','public_url','blurPath','accessPath',
    'dob','time_of_birth','place_of_birth','birth_place','lagnam','father','mother','siblings','family_note','parents_location',
    'annual_income','income_currency','wealth_stage','credit_score_band','private_notes','address_line_1','address_line_2','country_code','region_code','city_geoname_id',
    'postal_code','subdivision_code','pin_zip','location_source','location_confirmed_at','current_country_code','current_region_code','current_subdivision_code','current_city_geoname_id','current_postal_code',
    'portfolio_id','candidate_id','user_id'
  ]::text[]);
$$;

create or replace function app_private.approved_snapshot_has_forbidden_key(p_data jsonb)
returns boolean language sql immutable set search_path='' as $$
  select app_private.jsonb_has_any_key(p_data, array[
    'contact','contacts','phone','email','secure_note','private_notes','photo_url','photo_urls','photo_thumb_url','storage_path','thumbnail_path','public_url','blurPath','accessPath','signed_url','horoscope_path',
    'credit_score_band','location_preference','location_preferences','wedding_expectations','gift_expectations','parent_support','address_line_1','address_line_2',
    'country_code','region_code','subdivision_code','city_geoname_id','postal_code','pin_zip','location_source','location_confirmed_at','current_country_code','current_region_code','current_subdivision_code','current_city_geoname_id','current_postal_code',
    'portfolio_id','candidate_id','user_id'
  ]::text[]);
$$;

create or replace function app_private.broker_standard_profile_has_forbidden_key(p_data jsonb)
returns boolean language sql immutable set search_path='' as $$
  select app_private.jsonb_has_any_key(p_data, array[
    'contact','contact_person','phone','email','secure_note','annual_income','income_currency','wealth_stage','credit_score_band','private_notes','address_line_1','address_line_2',
    'location_preference','location_preferences','wedding_expectations','gift_expectations','parent_support',
    'country_code','region_code','subdivision_code','city_geoname_id','postal_code','pin_zip','location_source','location_confirmed_at','current_country_code','current_region_code','current_subdivision_code','current_city_geoname_id','current_postal_code',
    'portfolio_id','candidate_id','user_id'
  ]::text[]);
$$;

revoke all on function app_private.jsonb_has_any_key(jsonb,text[]) from public,anon,authenticated;
revoke all on function app_private.public_snapshot_has_forbidden_key(jsonb) from public,anon,authenticated;
revoke all on function app_private.approved_snapshot_has_forbidden_key(jsonb) from public,anon,authenticated;
revoke all on function app_private.broker_standard_profile_has_forbidden_key(jsonb) from public,anon,authenticated;
