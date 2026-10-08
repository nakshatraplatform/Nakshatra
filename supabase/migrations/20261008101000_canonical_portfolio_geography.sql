-- Nullable canonical IDs supplement legacy labels. No fuzzy/private-data backfill.
-- Keep source admin codes when GeoNames has no matching first-level region.
alter table public.reference_cities add column source_region_code text;
update public.reference_cities set source_region_code=region_code;
update public.reference_cities c set region_code=null
where region_code is not null and not exists (
  select 1 from public.reference_regions r where r.country_code=c.country_code and r.region_code=c.region_code
);
alter table public.reference_cities add constraint reference_cities_region_fk
  foreign key(country_code,region_code) references public.reference_regions(country_code,region_code)
  on update cascade on delete restrict;
alter table public.reference_cities add constraint reference_cities_country_id_unique unique(country_code,geoname_id);

-- These are the existing UI fallback countries, not a substitute for the full import.
insert into public.reference_countries(country_code,name) values
('IN','India'),('US','United States'),('CA','Canada'),('GB','United Kingdom'),
('AU','Australia'),('NZ','New Zealand'),('AE','United Arab Emirates'),('SG','Singapore'),
('DE','Germany'),('NL','Netherlands'),('IE','Ireland'),('FR','France'),('CH','Switzerland')
on conflict(country_code) do nothing;

alter table public.candidates
  add column current_country_code text references public.reference_countries(country_code) on update cascade on delete restrict,
  add column current_region_code text,
  add column current_city_geoname_id bigint,
  add constraint candidates_region_country_fk foreign key(current_country_code,current_region_code)
    references public.reference_regions(country_code,region_code) on update cascade on delete restrict,
  add constraint candidates_city_country_fk foreign key(current_country_code,current_city_geoname_id)
    references public.reference_cities(country_code,geoname_id) on update cascade on delete restrict,
  add constraint candidates_geography_parent_required check (
    (current_region_code is null and current_city_geoname_id is null) or current_country_code is not null
  );
create index candidates_geography_idx on public.candidates(current_country_code,current_region_code,current_city_geoname_id);

create function app_private.normalize_portfolio_geography(p_location jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  location jsonb:=coalesce(p_location,'{}'::jsonb);
  country public.reference_countries%rowtype;
  region public.reference_regions%rowtype;
  city public.reference_cities%rowtype;
  v_country_code text:=nullif(pg_catalog.upper(pg_catalog.btrim(p_location->>'country_code')),'');
  v_region_code text:=nullif(pg_catalog.btrim(p_location->>'region_code'),'');
  city_id text:=nullif(p_location->>'city_geoname_id','');
begin
  if v_country_code is null then
    if v_region_code is not null or city_id is not null then raise exception 'geography_parent_required' using errcode='22023'; end if;
    return location; -- Unmatched manual/legacy labels are not guessed.
  end if;
  select c.* into country from public.reference_countries c where c.country_code=v_country_code and c.is_active;
  if country.country_code is null then raise exception 'geography_country_invalid' using errcode='22023'; end if;
  location:=location||pg_catalog.jsonb_build_object('country_code',country.country_code,'country',country.name);
  if v_region_code is not null then
    select r.* into region from public.reference_regions r where r.country_code=v_country_code and r.region_code=v_region_code and r.is_active;
    if region.geoname_id is null then raise exception 'geography_region_invalid' using errcode='22023'; end if;
    location:=location||pg_catalog.jsonb_build_object('region_code',region.region_code,'region',region.name);
  end if;
  if city_id is not null then
    if city_id !~ '^[0-9]{1,15}$' then raise exception 'geography_city_invalid' using errcode='22023'; end if;
    select c.* into city from public.reference_cities c where c.geoname_id=city_id::bigint and c.is_active and c.country_code=v_country_code;
    if city.geoname_id is null or (v_region_code is not null and v_region_code is distinct from city.region_code) then
      raise exception 'geography_city_hierarchy_invalid' using errcode='22023';
    end if;
    location:=location||pg_catalog.jsonb_build_object('city_geoname_id',city.geoname_id,'city',city.name);
    if city.region_code is not null then
      select r.* into region from public.reference_regions r where r.country_code=v_country_code and r.region_code=city.region_code and r.is_active;
      if region.geoname_id is null then raise exception 'geography_region_invalid' using errcode='22023'; end if;
      location:=location||pg_catalog.jsonb_build_object('region_code',region.region_code,'region',region.name);
    else
      location:=location-'region_code'; -- Regionless cities may retain an owner's manual region label.
    end if;
  end if;
  return location;
end;
$$;
revoke all on function app_private.normalize_portfolio_geography(jsonb) from public, anon, authenticated;

-- Validate even direct owner table writes, not only the HTTP form boundary.
create function app_private.enforce_portfolio_geography()
returns trigger language plpgsql security definer set search_path = '' as $$
declare personal jsonb;
begin
  personal:=app_private.normalize_portfolio_geography(new.draft_data->'personal');
  if new.draft_data ? 'personal' then
    if personal ? 'country_code' then
      personal:=personal||pg_catalog.jsonb_build_object('current_location',
        pg_catalog.concat_ws(', ',nullif(personal->>'city',''),nullif(personal->>'region',''),nullif(personal->>'country','')));
    end if;
    new.draft_data:=pg_catalog.jsonb_set(new.draft_data,'{personal}',personal);
  end if;
  return new;
end;
$$;
revoke all on function app_private.enforce_portfolio_geography() from public, anon, authenticated;
create trigger portfolio_geography before insert or update of draft_data on public.portfolios
  for each row execute function app_private.enforce_portfolio_geography();

-- Preserve all current session, entitlement and self-portfolio guards; project
-- canonical IDs only after the existing atomic command succeeds, in the same tx.
create or replace function public.save_dashboard_draft_transaction(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing_candidate_id uuid; result jsonb; personal jsonb; saved_draft jsonb;
begin
  perform app_private.require_current_session();
  if not app_private.actor_can_create_portfolio(auth.uid()) then return '{"status":"creator_entitlement_required"}'::jsonb; end if;
  if p_payload->'candidate' is not null and p_payload->'candidate'<>'null'::jsonb then
    if p_payload#>>'{portfolio,draft_data,personal,profile_for}' is distinct from 'self'
      or p_payload#>>'{details,personal,profile_for}' is distinct from 'self' then return '{"status":"self_portfolio_required"}'::jsonb; end if;
    select p.candidate_id into existing_candidate_id from public.portfolios p where p.user_id=auth.uid();
    if existing_candidate_id is not null and not exists (
      select 1 from public.candidate_personal_details d where d.candidate_id=existing_candidate_id and d.profile_for='self'
    ) then return '{"status":"self_portfolio_required"}'::jsonb; end if;
  end if;
  result:=app_private.save_dashboard_draft_transaction(p_payload);
  select p.draft_data into saved_draft from public.portfolios p where p.id=(result->>'portfolioId')::uuid and p.user_id=auth.uid();
  personal:=saved_draft->'personal';
  if result->>'candidateId' is not null then
    update public.candidates set
      current_country_code=nullif(personal->>'country_code',''),
      current_region_code=nullif(personal->>'region_code',''),
      current_city_geoname_id=nullif(personal->>'city_geoname_id','')::bigint,
      current_country=coalesce(nullif(personal->>'country',''),current_country),
      current_region=case when personal ? 'region' then nullif(personal->>'region','') else current_region end,
      current_city=case when personal ? 'city' then nullif(personal->>'city','') else current_city end
    where id=(result->>'candidateId')::uuid and primary_owner_user_id=auth.uid();
  end if;
  return result||pg_catalog.jsonb_build_object('draftData',saved_draft,'readiness',app_private.owner_publication_readiness());
end;
$$;

-- Direct relational writes must respect city/region hierarchy too.
create function app_private.enforce_candidate_geography()
returns trigger language plpgsql security definer set search_path = '' as $$
declare location jsonb;
begin
  location:=app_private.normalize_portfolio_geography(pg_catalog.jsonb_build_object(
    'country_code',new.current_country_code,'region_code',new.current_region_code,'city_geoname_id',new.current_city_geoname_id));
  if new.current_country_code is not null then new.current_country:=location->>'country'; end if;
  if new.current_region_code is not null then new.current_region:=location->>'region'; end if;
  if new.current_city_geoname_id is not null then
    new.current_city:=location->>'city'; new.current_region_code:=location->>'region_code';
    if location ? 'region' then new.current_region:=location->>'region'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.enforce_candidate_geography() from public, anon, authenticated;
create trigger candidate_geography before insert or update of current_country_code,current_region_code,current_city_geoname_id,current_country,current_region,current_city on public.candidates
  for each row execute function app_private.enforce_candidate_geography();
