-- Additive commands; apply before the dependent interest-form application.
-- Reference data is public knowledge, never a customer/profile lookup.
create or replace function public.list_interest_location_options(
  p_level text, p_country text default null, p_region text default null, p_query text default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_level is null or p_level not in ('countries','regions','cities') or coalesce(pg_catalog.length(p_query),0)>80
    or (p_level <> 'countries' and coalesce(p_country,'') !~ '^[A-Z]{2}$')
    or coalesce(pg_catalog.length(p_region),0)>30 then
    raise exception 'invalid location query' using errcode='22023';
  end if;
  if p_level='countries' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('country_code',r.country_code,'name',r.name) order by r.name),'[]'::jsonb)
    into result from (select country_code,name from public.reference_countries where is_active order by name limit 300) r;
  elsif p_level='regions' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('region_code',r.region_code,'name',r.name) order by r.name),'[]'::jsonb)
    into result from (select region_code,name from public.reference_regions where is_active and country_code=p_country order by name limit 1000) r;
  else
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('geoname_id',r.geoname_id,'name',r.name,'region_code',r.region_code) order by r.population desc,r.name),'[]'::jsonb)
    into result from (select geoname_id,name,region_code,population from public.reference_cities
      where is_active and country_code=p_country and (p_region is null or region_code=p_region)
      and (coalesce(p_query,'')='' or pg_catalog.left(pg_catalog.lower(name),pg_catalog.length(p_query))=pg_catalog.lower(p_query))
      order by population desc,name limit 100) r;
  end if;
  return result;
end $$;
revoke all on function public.list_interest_location_options(text,text,text,text) from public;
grant execute on function public.list_interest_location_options(text,text,text,text) to anon,authenticated;

create or replace function app_private.interest_location(p_location jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if pg_catalog.jsonb_typeof(p_location) is distinct from 'object'
    or coalesce(p_location->>'countryCode','') !~ '^[A-Z]{2}$'
    or coalesce(p_location->>'regionCode','')=''
    or coalesce(p_location->>'cityId','') !~ '^[1-9][0-9]{0,14}$' then
    raise exception 'invalid interest location' using errcode='22023';
  end if;
  select pg_catalog.jsonb_build_object('country',country.name,'state',region.name,'city',city.name,
    'countryCode',country.country_code,'regionCode',region.region_code,'cityId',city.geoname_id)
  into result from public.reference_countries country
  join public.reference_regions region on region.country_code=country.country_code
  join public.reference_cities city on city.country_code=country.country_code and city.region_code=region.region_code
  where country.is_active and region.is_active and city.is_active
    and country.country_code=p_location->>'countryCode' and region.region_code=p_location->>'regionCode'
    and city.geoname_id=(p_location->>'cityId')::bigint;
  if result is null then raise exception 'invalid interest location' using errcode='22023'; end if;
  return result;
end $$;
revoke all on function app_private.interest_location(jsonb) from public,anon,authenticated;

-- Match JavaScript String.trim, including tabs/newlines and Unicode separators.
create or replace function app_private.trim_interest_text(p_value text)
returns text language sql immutable set search_path='' as $$
  select pg_catalog.btrim(p_value, E' \t\n\r\f' || pg_catalog.chr(11) || pg_catalog.chr(160) || pg_catalog.chr(5760)
    || pg_catalog.chr(8192) || pg_catalog.chr(8193) || pg_catalog.chr(8194) || pg_catalog.chr(8195)
    || pg_catalog.chr(8196) || pg_catalog.chr(8197) || pg_catalog.chr(8198) || pg_catalog.chr(8199)
    || pg_catalog.chr(8200) || pg_catalog.chr(8201) || pg_catalog.chr(8202) || pg_catalog.chr(8232)
    || pg_catalog.chr(8233) || pg_catalog.chr(8239) || pg_catalog.chr(8287) || pg_catalog.chr(12288) || pg_catalog.chr(65279))
$$;
revoke all on function app_private.trim_interest_text(text) from public,anon,authenticated;

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
  location:=app_private.interest_location(p_details->'location');
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
    || case when candidate is null then '{}'::jsonb else pg_catalog.jsonb_build_object('candidate',candidate) end where id=request_id;
  return true;
end $$;
revoke all on function public.submit_interest_details(jsonb) from public,anon;
grant execute on function public.submit_interest_details(jsonb) to authenticated;

-- Existing accounts still submit optional notes, with an immutable snapshot of
-- the fields explicitly shown in the reuse-profile confirmation. Never look up
-- an account by a supplied email, nor accept profile attributes from the client.
create or replace function public.submit_existing_interest(
  p_share_token text, p_family_context text default null, p_message text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare owned public.portfolios%rowtype; personal jsonb; contact jsonb; snapshot jsonb; source jsonb;
  profession text; core_values text; profile_for text;
  verified_email text; target_id uuid; previous_id uuid; accepted boolean;
begin
  perform app_private.require_current_session();
  select * into owned from public.portfolios where user_id=auth.uid() limit 1;
  if owned.id is null then raise exception 'owned profile required' using errcode='22023'; end if;
  personal:=case when nullif(app_private.trim_interest_text(owned.draft_data#>>'{personal,name}'),'') is not null
    then owned.draft_data->'personal' else owned.published_data->'personal' end;
  contact:=coalesce(owned.draft_data->'contact',owned.published_data->'contact','{}'::jsonb);
  select email into verified_email from auth.users where id=auth.uid();
  foreach source in array array[owned.draft_data,owned.published_data] loop
    if coalesce(profession,'')='' and pg_catalog.jsonb_typeof(source#>'{career,title}')='string'
      and pg_catalog.length(source#>>'{career,title}')<=200 then profession:=source#>>'{career,title}'; end if;
    if coalesce(core_values,'')='' and pg_catalog.jsonb_typeof(source#>'{lifestyle,values_statement}')='string'
      and pg_catalog.length(source#>>'{lifestyle,values_statement}')<=1200 then core_values:=source#>>'{lifestyle,values_statement}'; end if;
  end loop;
  snapshot:=pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object('profession',profession,'coreValues',core_values));
  profile_for:=case when personal->>'profile_for' in ('self','son','daughter','sibling','relative') then personal->>'profile_for' else 'self' end;
  select id into target_id from public.portfolios where share_token=p_share_token for update;
  select id into previous_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid()
    and status in ('new','pending_review','approved','revealed','rejected') order by created_at desc limit 1;
  accepted:=public.submit_public_interest(p_share_token,personal->>'name',profile_for,
    coalesce(nullif(contact->>'phone',''),(select item->>'phone' from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(contact->'contacts')='array' then contact->'contacts' else '[]'::jsonb end) item
      where nullif(item->>'phone','') is not null limit 1),''),verified_email,
    null,app_private.trim_interest_text(p_family_context),app_private.trim_interest_text(p_message),null,
    personal->>'country',personal->>'region',personal->>'city');
  if accepted and previous_id is null then
    update public.interest_requests set metadata=metadata || snapshot
      where portfolio_id=target_id and requester_user_id=auth.uid() and status='new';
  end if;
  return accepted;
end $$;
revoke all on function public.submit_existing_interest(text,text,text) from public,anon;
grant execute on function public.submit_existing_interest(text,text,text) to authenticated;

-- Retire the weaker client entry point. The two guarded definer commands above
-- still call its existing verified-email / pilot / duplicate-request engine.
-- Roll out the dependent application together with this migration: stale forms
-- must reload, not bypass the new visitor requirements through the old RPC.
revoke execute on function public.submit_public_interest(text,text,text,text,text,text,text,text,text,text,text,text) from authenticated;

-- A separate exact-ID read keeps old/approved requests accessible beyond the
-- dashboard's bounded queue. No requester-ID/email lookup is exposed.
create or replace function public.get_interest_details(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  select pg_catalog.jsonb_build_object('id',r.id,'name',r.viewer_name,'email',r.viewer_email,'phone',r.viewer_phone,
    'familyContext',r.viewer_family_context,'message',r.message,'metadata',r.metadata-'portfolio_url',
    'submittedAt',r.created_at,'verifiedAt',r.email_verified_at,'requestStatus',r.status,
    'accessGrantedAt',g.created_at,'accessExpiresAt',g.expires_at,
    'accessStatus',case when g.id is null then 'not_granted' when g.revoked_at is not null then 'revoked' when g.expires_at<=pg_catalog.now() then 'expired' else 'active' end,
    'history',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',e.id,'eventType',e.event_type,'createdAt',e.created_at) order by e.created_at desc)
      from (select id,event_type,created_at from public.access_audit_events where interest_request_id=r.id order by created_at desc limit 20) e),'[]'::jsonb))
  into result from public.interest_requests r
  left join lateral (select id,created_at,expires_at,revoked_at from public.reveal_grants where interest_request_id=r.id order by created_at desc limit 1) g on true
  where r.id=p_request_id and public.can_manage_portfolio(r.portfolio_id);
  return result;
end $$;
revoke all on function public.get_interest_details(uuid) from public,anon;
grant execute on function public.get_interest_details(uuid) to authenticated;

create or replace function public.list_interest_history(p_offset integer default 0, p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  if p_offset is null or p_limit is null or p_offset<0 or p_offset>100000 or p_limit not between 1 and 50 then raise exception 'invalid history page' using errcode='22023'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'name',r.viewer_name,
    'submittedAt',r.created_at,'status',r.status) order by r.created_at desc,r.id desc),'[]'::jsonb)
  into result from (select id,viewer_name,created_at,status from public.interest_requests
    where public.can_manage_portfolio(portfolio_id) order by created_at desc,id desc offset p_offset limit p_limit) r;
  return result;
end $$;
revoke all on function public.list_interest_history(integer,integer) from public,anon;
grant execute on function public.list_interest_history(integer,integer) to authenticated;

-- Storage policies previously queried portfolio_media under the viewer's RLS:
-- owner-only descriptor reads hid protected originals even with a full grant.
-- Evaluate only this path capability under a narrow definer, not table access.
create or replace function public.can_read_approved_photo(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select public.is_current_session_active() and exists (
    select 1 from public.portfolio_media m join public.reveal_grants g on g.portfolio_id=m.portfolio_id
    where m.storage_path=p_path and m.media_type in ('hero','gallery')
      and m.visibility in ('public','blurred','interest_required','approved_only')
      and public.is_published_portfolio(m.portfolio_id) and g.viewer_user_id=auth.uid()
      and g.access_level='full' and g.revoked_at is null and g.expires_at>pg_catalog.now()
  )
$$;
revoke all on function public.can_read_approved_photo(text) from public,anon;
grant execute on function public.can_read_approved_photo(text) to authenticated;
drop policy if exists "Approved viewers can read approved photo originals" on storage.objects;
create policy "Approved viewers can read approved photo originals" on storage.objects for select to authenticated
  using (bucket_id='photos' and public.can_read_approved_photo(name));
