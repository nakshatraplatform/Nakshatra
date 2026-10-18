-- NAK-106: deploy before the optional-candidate-details application.
-- Keep the existing session, verified-email, pilot, ownership and retry guards.
create or replace function public.submit_interest_details(p_details jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  location jsonb; candidate_location jsonb; candidate jsonb; field text;
  candidate_email text; candidate_phone text; relationship text; message text;
  target_id uuid; request_id uuid; previous_id uuid; accepted boolean;
begin
  perform app_private.require_current_session();
  if pg_catalog.jsonb_typeof(p_details) is distinct from 'object' then raise exception 'invalid interest request' using errcode='22023'; end if;
  foreach field in array array['portfolioToken','name','email','phone','profileFor','familyContext'] loop
    if pg_catalog.jsonb_typeof(p_details->field) is distinct from 'string' then raise exception 'invalid interest request' using errcode='22023'; end if;
  end loop;
  if p_details->'message' is not null and p_details->'message'<>'null'::jsonb
    and pg_catalog.jsonb_typeof(p_details->'message')<>'string' then
    raise exception 'invalid interest message' using errcode='22023';
  end if;
  message:=nullif(app_private.trim_interest_text(p_details->>'message'),'');
  p_details:=p_details || pg_catalog.jsonb_build_object(
    'name',app_private.trim_interest_text(p_details->>'name'), 'email',app_private.trim_interest_text(p_details->>'email'),
    'phone',app_private.trim_interest_text(p_details->>'phone'), 'familyContext',app_private.trim_interest_text(p_details->>'familyContext'));
  if pg_catalog.length(coalesce(p_details->>'familyContext','')) not between 40 and 600
    or (message is not null and pg_catalog.length(message) not between 80 and 600)
    or coalesce(p_details->>'name','') !~ '[[:alpha:]]'
    or coalesce(p_details->>'phone','') !~ '^\+?[0-9][0-9\s()-]*$'
    or pg_catalog.length(coalesce(p_details->>'phone',''))>40 then
    raise exception 'invalid interest request' using errcode='22023';
  end if;
  location:=app_private.structured_interest_location(p_details->'location');
  if p_details->>'profileFor'<>'self' then
    candidate:=p_details->'candidate';
    if pg_catalog.jsonb_typeof(candidate) is distinct from 'object'
      or pg_catalog.jsonb_typeof(candidate->'name') is distinct from 'string' then
      raise exception 'invalid candidate details' using errcode='22023';
    end if;
    foreach field in array array['email','phone'] loop
      if candidate->field is not null and candidate->field<>'null'::jsonb
        and pg_catalog.jsonb_typeof(candidate->field)<>'string' then
        raise exception 'invalid candidate details' using errcode='22023';
      end if;
    end loop;
    candidate:=candidate || pg_catalog.jsonb_build_object('name',app_private.trim_interest_text(candidate->>'name'));
    candidate_email:=nullif(app_private.trim_interest_text(candidate->>'email'),'');
    candidate_phone:=nullif(app_private.trim_interest_text(candidate->>'phone'),'');
    relationship:=case p_details->>'profileFor' when 'son' then 'Parent' when 'daughter' then 'Parent' when 'sibling' then 'Sibling' else 'Relative' end;
    if pg_catalog.length(coalesce(candidate->>'name','')) not between 2 and 180
      or coalesce(candidate->>'name','') !~ '[[:alpha:]]'
      or (candidate_email is not null and (pg_catalog.length(candidate_email)>180
        or candidate_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
      or (candidate_phone is not null and (pg_catalog.length(candidate_phone)>40
        or candidate_phone !~ '^\+?[0-9][0-9\s()-]*$'
        or pg_catalog.length(pg_catalog.regexp_replace(candidate_phone,'\D','','g')) not between 7 and 20)) then
      raise exception 'invalid candidate details' using errcode='22023';
    end if;
    candidate_location:=null;
    if candidate->'location' is not null and candidate->'location'<>'null'::jsonb then
      -- Old full directory submissions remain compatible, but new locations use
      -- exactly the viewer's structured-location validator (including provenance).
      if candidate->'location' ? 'subdivisionCode' then
        candidate_location:=app_private.structured_interest_location(candidate->'location');
      else
        candidate_location:=app_private.interest_location(candidate->'location');
      end if;
    end if;
    candidate:=pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'name',candidate->>'name','email',pg_catalog.lower(candidate_email),'phone',candidate_phone,
      'relationship',relationship,'location',candidate_location));
  else candidate:=null; end if;
  select id into target_id from public.portfolios where share_token=p_details->>'portfolioToken' for update;
  select id into previous_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid()
    and status in ('new','pending_review','approved','revealed','rejected') order by created_at desc limit 1;
  accepted:=public.submit_public_interest(p_details->>'portfolioToken',p_details->>'name',p_details->>'profileFor',p_details->>'phone',p_details->>'email',
    null,p_details->>'familyContext',message,null,location->>'country',location->>'state',location->>'city');
  if not accepted or previous_id is not null then return accepted; end if;
  select id into request_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid() order by created_at desc limit 1;
  update public.interest_requests set metadata=metadata || pg_catalog.jsonb_build_object('location_details',location)
    || case when candidate is null then '{}'::jsonb else pg_catalog.jsonb_build_object('candidate',candidate) end,
    country_code=location->>'countryCode',country=location->>'country',subdivision_code=location->>'subdivisionCode',state=location->>'state',
    city=location->>'city',city_geoname_id=nullif(location->>'cityId','')::bigint,postal_code=location->>'postalCode',location_source=location->>'locationSource'
    where id=request_id;
  return true;
end $$;
revoke all on function public.submit_interest_details(jsonb) from public,anon;
grant execute on function public.submit_interest_details(jsonb) to authenticated;

create or replace function public.submit_existing_interest(p_share_token text,p_family_context text,p_message text,p_location jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare location jsonb; target_id uuid; previous_id uuid; request_id uuid; accepted boolean;
begin
  perform app_private.require_current_session();
  p_family_context:=app_private.trim_interest_text(p_family_context);
  p_message:=nullif(app_private.trim_interest_text(p_message),'');
  if pg_catalog.length(coalesce(p_family_context,'')) not between 40 and 600
    or (p_message is not null and pg_catalog.length(p_message) not between 80 and 600) then
    raise exception 'invalid interest context' using errcode='22023';
  end if;
  location:=app_private.structured_interest_location(p_location);
  select id into target_id from public.portfolios where share_token=p_share_token for update;
  select id into previous_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid()
    and status in ('new','pending_review','approved','revealed','rejected') order by created_at desc limit 1;
  accepted:=public.submit_existing_interest(p_share_token,p_family_context,p_message);
  if accepted and previous_id is null then
    select id into request_id from public.interest_requests where portfolio_id=target_id and requester_user_id=auth.uid() and status='new' order by created_at desc limit 1;
    update public.interest_requests set metadata=metadata || pg_catalog.jsonb_build_object('location_details',location),
      country_code=location->>'countryCode',country=location->>'country',subdivision_code=location->>'subdivisionCode',state=location->>'state',
      city=location->>'city',city_geoname_id=nullif(location->>'cityId','')::bigint,postal_code=location->>'postalCode',location_source=location->>'locationSource'
      where id=request_id;
  end if;
  return accepted;
end $$;
revoke all on function public.submit_existing_interest(text,text,text,jsonb) from public,anon;
grant execute on function public.submit_existing_interest(text,text,text,jsonb) to authenticated;
-- Do not restore client access to the legacy, weaker overloads.
revoke execute on function public.submit_existing_interest(text,text,text) from authenticated;
