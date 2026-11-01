-- Accountless email verification is deliberately separate from Supabase Auth.
-- This is an additive prerequisite: the application must switch to these
-- service-only commands before the old approval command is retired.
create table app_private.guest_interest_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null check (length(email) between 3 and 180),
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  code_digest text not null check (code_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  consumed_at timestamptz,
  check (expires_at <= created_at + interval '10 minutes')
);
create index guest_interest_challenges_expiry_idx
  on app_private.guest_interest_challenges(expires_at);
alter table app_private.guest_interest_challenges enable row level security;
revoke all on app_private.guest_interest_challenges from public, anon, authenticated, service_role;

create function public.begin_guest_interest_verification(
  p_details jsonb, p_code_digest text, p_email_subject_hash text,
  p_network_subject_hash text
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_email text;
  v_token text;
  v_quota jsonb;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501';
  end if;
  if pg_catalog.jsonb_typeof(p_details) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_details->'email') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_details->'portfolioToken') is distinct from 'string'
    or p_code_digest is null or p_code_digest !~ '^[a-f0-9]{64}$'
    or p_email_subject_hash is null or p_email_subject_hash !~ '^[a-f0-9]{64}$'
    or p_network_subject_hash is null or p_network_subject_hash !~ '^[a-f0-9]{64}$'
    or pg_catalog.length(p_details::text) > 6000 then
    raise exception 'invalid guest verification' using errcode='22023';
  end if;
  v_email := pg_catalog.lower(pg_catalog.btrim(p_details->>'email'));
  v_token := p_details->>'portfolioToken';
  if pg_catalog.length(v_email) not between 3 and 180
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or v_token is null or pg_catalog.length(v_token) not between 8 and 160
    or v_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid guest verification' using errcode='22023';
  end if;
  -- Both the address and network consume a quota, so rotating either alone
  -- cannot request an unbounded number of codes.
  v_quota := public.consume_api_rate_limit('auth_email', p_email_subject_hash);
  if not (v_quota->>'allowed')::boolean then
    raise exception 'guest verification quota exceeded'
      using errcode='P0429', detail=v_quota->>'retryAfter';
  end if;
  v_quota := public.consume_api_rate_limit('auth_email', p_network_subject_hash);
  if not (v_quota->>'allowed')::boolean then
    raise exception 'guest verification quota exceeded'
      using errcode='P0429', detail=v_quota->>'retryAfter';
  end if;
  if not app_private.pilot_public_portfolio_allowed(v_token)
    or not exists(
      select 1 from public.public_portfolio_snapshots s
      join public.portfolios p on p.id=s.portfolio_id
      where s.share_token=v_token and s.is_active and p.is_published
        and p.share_token=s.share_token
        and (s.expires_at is null or s.expires_at>now())
        and (p.expires_at is null or p.expires_at>now())
    ) then
    return null;
  end if;
  -- New sends replace earlier codes for this email and introduction. Serialize
  -- concurrent sends so two live codes cannot be issued together.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_email || '|' || v_token, 917621));
  update app_private.guest_interest_challenges
    set consumed_at=now(),details='{}'::jsonb
    where email=v_email and details->>'portfolioToken'=v_token
      and consumed_at is null;
  insert into app_private.guest_interest_challenges(email,details,code_digest)
  values(v_email,p_details,p_code_digest) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.begin_guest_interest_verification(jsonb,text,text,text)
  from public,anon,authenticated;
grant execute on function public.begin_guest_interest_verification(jsonb,text,text,text)
  to service_role;

create function public.cancel_guest_interest_verification(p_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501';
  end if;
  update app_private.guest_interest_challenges set consumed_at=now(),details='{}'::jsonb
    where id=p_id and consumed_at is null;
end;
$$;
revoke all on function public.cancel_guest_interest_verification(uuid)
  from public,anon,authenticated;
grant execute on function public.cancel_guest_interest_verification(uuid) to service_role;

-- The form is stored before the email is sent, then validated again at the
-- database boundary after code verification. This avoids trusting a changed
-- client payload during the final step.
create function app_private.submit_verified_guest_interest(
  p_details jsonb, p_verified_email text, p_network_subject_hash text
) returns text language plpgsql volatile security definer set search_path='' as $$
declare
  v_location jsonb;
  v_candidate jsonb;
  v_candidate_location jsonb;
  v_candidate_email text;
  v_candidate_phone text;
  v_name text;
  v_phone text;
  v_family text;
  v_message text;
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_verified_email));
  v_target public.portfolios%rowtype;
  v_request_id uuid;
  v_quota jsonb;
  v_field text;
begin
  if pg_catalog.jsonb_typeof(p_details) is distinct from 'object' then
    raise exception 'invalid interest request' using errcode='22023';
  end if;
  foreach v_field in array array['portfolioToken','name','email','phone','profileFor','familyContext'] loop
    if pg_catalog.jsonb_typeof(p_details->v_field) is distinct from 'string' then
      raise exception 'invalid interest request' using errcode='22023';
    end if;
  end loop;
  if p_details->'message' is not null and p_details->'message'<>'null'::jsonb
    and pg_catalog.jsonb_typeof(p_details->'message')<>'string' then
    raise exception 'invalid interest request' using errcode='22023'; end if;
  if pg_catalog.lower(pg_catalog.btrim(p_details->>'email')) is distinct from v_email
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or pg_catalog.length(v_email) not between 3 and 180 then
    raise exception 'verified email mismatch' using errcode='42501';
  end if;
  v_name := app_private.trim_interest_text(p_details->>'name');
  v_phone := app_private.trim_interest_text(p_details->>'phone');
  v_family := app_private.trim_interest_text(p_details->>'familyContext');
  v_message := nullif(app_private.trim_interest_text(p_details->>'message'),'');
  if pg_catalog.length(v_name) not between 2 and 180
    or v_name !~ '[[:alpha:]]'
    or v_phone !~ '^\+[1-9][0-9\s()-]*$'
    or pg_catalog.length(v_phone) > 40
    or pg_catalog.length(pg_catalog.regexp_replace(v_phone,'\D','','g')) not between 7 and 20
    or (pg_catalog.left(v_phone,3)='+91'
      and pg_catalog.length(pg_catalog.regexp_replace(v_phone,'\D','','g'))<>12)
    or (pg_catalog.left(v_phone,2)='+1'
      and pg_catalog.left(v_phone,3)<>'+91'
      and pg_catalog.length(pg_catalog.regexp_replace(v_phone,'\D','','g'))<>11)
    or pg_catalog.length(v_family) not between 40 and 600
    or (v_message is not null and pg_catalog.length(v_message) not between 80 and 600)
    or p_details->>'profileFor' not in ('self','son','daughter','sibling','relative')
    or p_details->>'portfolioToken' !~ '^[A-Za-z0-9_-]{8,160}$' then
    raise exception 'invalid interest request' using errcode='22023';
  end if;
  v_location := app_private.structured_interest_location(p_details->'location');
  if v_location->>'country' is distinct from p_details->>'country'
    or v_location->>'state' is distinct from p_details->>'state'
    or v_location->>'city' is distinct from p_details->>'city'
    or v_location->>'countryCode' is distinct from p_details->>'countryCode'
    or v_location->>'subdivisionCode' is distinct from p_details->>'subdivisionCode'
    or v_location->>'postalCode' is distinct from p_details->>'postalCode'
    or v_location->>'locationSource' is distinct from p_details->>'locationSource' then
    raise exception 'invalid interest location' using errcode='22023';
  end if;
  if p_details->>'profileFor' <> 'self' then
    v_candidate := p_details->'candidate';
    if pg_catalog.jsonb_typeof(v_candidate) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_candidate->'name') is distinct from 'string' then
      raise exception 'invalid candidate details' using errcode='22023';
    end if;
    foreach v_field in array array['email','phone'] loop
      if v_candidate->v_field is not null
        and v_candidate->v_field<>'null'::jsonb
        and pg_catalog.jsonb_typeof(v_candidate->v_field)<>'string' then
        raise exception 'invalid candidate details' using errcode='22023';
      end if;
    end loop;
    v_candidate_email := nullif(app_private.trim_interest_text(v_candidate->>'email'),'');
    v_candidate_phone := nullif(app_private.trim_interest_text(v_candidate->>'phone'),'');
    if pg_catalog.length(app_private.trim_interest_text(v_candidate->>'name')) not between 2 and 180
      or app_private.trim_interest_text(v_candidate->>'name') !~ '[[:alpha:]]'
      or (v_candidate_email is not null and (
        pg_catalog.length(v_candidate_email)>180
        or v_candidate_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
      or (v_candidate_phone is not null and (
        pg_catalog.length(v_candidate_phone)>40
        or v_candidate_phone !~ '^\+[1-9][0-9\s()-]*$'
        or pg_catalog.length(pg_catalog.regexp_replace(v_candidate_phone,'\D','','g')) not between 7 and 20
        or (pg_catalog.left(v_candidate_phone,3)='+91'
          and pg_catalog.length(pg_catalog.regexp_replace(v_candidate_phone,'\D','','g'))<>12)
        or (pg_catalog.left(v_candidate_phone,2)='+1'
          and pg_catalog.left(v_candidate_phone,3)<>'+91'
          and pg_catalog.length(pg_catalog.regexp_replace(v_candidate_phone,'\D','','g'))<>11))) then
      raise exception 'invalid candidate details' using errcode='22023';
    end if;
    v_candidate_location := null;
    if v_candidate->'location' is not null and v_candidate->'location'<>'null'::jsonb then
      if v_candidate->'location' ? 'subdivisionCode' then
        v_candidate_location := app_private.structured_interest_location(v_candidate->'location');
      else
        v_candidate_location := app_private.interest_location(v_candidate->'location');
      end if;
    end if;
    v_candidate := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'name',app_private.trim_interest_text(v_candidate->>'name'),
      'email',pg_catalog.lower(v_candidate_email),'phone',v_candidate_phone,
      'relationship',case p_details->>'profileFor' when 'son' then 'Parent'
        when 'daughter' then 'Parent' when 'sibling' then 'Sibling' else 'Relative' end,
      'location',v_candidate_location));
  else
    v_candidate := null;
  end if;
  select p.* into v_target from public.portfolios p
    where p.share_token=p_details->>'portfolioToken' for update;
  if v_target.id is null or not v_target.is_published
    or (v_target.expires_at is not null and v_target.expires_at<=now())
    or not app_private.pilot_public_portfolio_allowed(p_details->>'portfolioToken')
    or not exists(select 1 from public.public_portfolio_snapshots s
      where s.portfolio_id=v_target.id and s.share_token=v_target.share_token
        and s.is_active and (s.expires_at is null or s.expires_at>now())) then
    return 'unavailable';
  end if;
  if exists(select 1 from auth.users u where u.id=v_target.user_id
    and pg_catalog.lower(u.email)=v_email) then return 'own_portfolio'; end if;
  if exists(select 1 from public.interest_requests r where r.portfolio_id=v_target.id
    and pg_catalog.lower(r.viewer_email)=v_email and r.status in
      ('new','pending_review','approved','revealed','rejected')) then
    return 'existing_request';
  end if;
  v_quota := public.consume_api_rate_limit('interest_submit',p_network_subject_hash);
  if not (v_quota->>'allowed')::boolean then return 'rate_limited'; end if;
  insert into public.interest_requests(
    portfolio_id,candidate_id,requester_user_id,viewer_name,viewer_phone,
    viewer_email,email_verified_at,verification_channel,viewer_family_context,
    message,request_reason,requested_sections,prospect_key_hash,status,
    attribution_status,metadata,country_code,country,subdivision_code,state,
    city,city_geoname_id,postal_code,location_source
  ) values (
    v_target.id,v_target.candidate_id,null,v_name,v_phone,
    v_email,now(),'email',v_family,v_message,v_message,array['contact']::text[],
    pg_catalog.encode(extensions.digest(v_email||'|'||
      pg_catalog.regexp_replace(v_phone,'\D','','g'),'sha256'),'hex'),
    'new','unattributed',
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'profile_for',p_details->>'profileFor','country',v_location->>'country',
      'state',v_location->>'state','city',v_location->>'city',
      'location_details',v_location,'candidate',v_candidate)),
    v_location->>'countryCode',v_location->>'country',
    v_location->>'subdivisionCode',v_location->>'state',
    v_location->>'city',nullif(v_location->>'cityId','')::bigint,
    v_location->>'postalCode',v_location->>'locationSource'
  ) returning id into v_request_id;
  insert into public.access_audit_events(
    portfolio_id,interest_request_id,event_type,metadata
  ) values(v_target.id,v_request_id,'request_submitted',
    '{"verification_channel":"email","profile_source":"guest_form"}'::jsonb);
  return 'submitted';
end;
$$;
revoke all on function app_private.submit_verified_guest_interest(jsonb,text,text)
  from public,anon,authenticated,service_role;

create function public.complete_guest_interest_verification(
  p_id uuid,p_code_digest text,p_network_subject_hash text
) returns text language plpgsql volatile security definer set search_path='' as $$
declare
  v_challenge app_private.guest_interest_challenges%rowtype;
  v_result text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501';
  end if;
  if p_id is null or p_code_digest is null or p_code_digest !~ '^[a-f0-9]{64}$'
    or p_network_subject_hash is null or p_network_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid guest verification' using errcode='22023';
  end if;
  -- Code sends have the network/address quota. Verification has a separate
  -- five-attempt limit on its unguessable challenge ID; charging the send
  -- quota here can strand valid codes on shared networks.
  select * into v_challenge from app_private.guest_interest_challenges
    where id=p_id for update;
  if v_challenge.id is null or v_challenge.consumed_at is not null
    or v_challenge.expires_at<=now() or v_challenge.attempt_count>=5 then
    return 'expired';
  end if;
  if v_challenge.code_digest <> p_code_digest then
    update app_private.guest_interest_challenges
      set attempt_count=attempt_count+1 where id=p_id;
    return 'invalid_code';
  end if;
  v_result := app_private.submit_verified_guest_interest(
    v_challenge.details,v_challenge.email,p_network_subject_hash);
  if v_result in ('submitted','existing_request','own_portfolio','unavailable') then
    update app_private.guest_interest_challenges
      set consumed_at=now(),details='{}'::jsonb where id=p_id;
  end if;
  return v_result;
end;
$$;
revoke all on function public.complete_guest_interest_verification(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.complete_guest_interest_verification(uuid,text,text)
  to service_role;

-- An Auth-user outbox cannot address a guest. Keep this queue private, scoped to
-- the request, and retain the reviewed contact snapshot only until delivery.
create table app_private.guest_interest_mail_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  interest_request_id uuid not null references public.interest_requests(id) on delete cascade,
  kind text not null check (kind in ('receipt','approved_contact','declined')),
  recipient_email text not null check (length(recipient_email) between 3 and 180),
  contact_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(contact_payload) = 'object'),
  published_revision text check (published_revision is null or published_revision ~ '^[a-f0-9]{32}$'),
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','suppressed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{3,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind='approved_contact') = (published_revision is not null)),
  check (kind='approved_contact' or contact_payload='{}'::jsonb)
);
create index guest_interest_mail_ready_idx
  on app_private.guest_interest_mail_outbox(status,available_at)
  where status in ('queued','processing','failed');
create unique index guest_interest_mail_one_receipt_idx
  on app_private.guest_interest_mail_outbox(interest_request_id)
  where kind='receipt';
alter table app_private.guest_interest_mail_outbox enable row level security;
revoke all on app_private.guest_interest_mail_outbox from public,anon,authenticated,service_role;

create table app_private.guest_contact_decision_audit (
  id bigint generated always as identity primary key,
  interest_request_id uuid references public.interest_requests(id) on delete set null,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  published_revision text not null check (published_revision ~ '^[a-f0-9]{32}$'),
  created_at timestamptz not null default now()
);
alter table app_private.guest_contact_decision_audit enable row level security;
revoke all on app_private.guest_contact_decision_audit from public,anon,authenticated,service_role;

-- Enqueue a guest receipt in the same transaction as a newly accepted request.
create function app_private.enqueue_guest_interest_receipt()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.requester_user_id is null and new.email_verified_at is not null
    and new.verification_channel='email' then
    insert into app_private.guest_interest_mail_outbox(
      interest_request_id,kind,recipient_email
    ) values(new.id,'receipt',new.viewer_email)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function app_private.enqueue_guest_interest_receipt()
  from public,anon,authenticated,service_role;
create trigger enqueue_guest_interest_receipt
after insert on public.interest_requests
for each row execute function app_private.enqueue_guest_interest_receipt();

create function app_private.suppress_guest_contact_mail_on_end()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('rejected','closed') and old.status is distinct from new.status then
    update app_private.guest_interest_mail_outbox
      set status='suppressed',contact_payload='{}'::jsonb,
        lease_token=null,lease_expires_at=null,updated_at=now(),
        last_error_code='SHARING_ENDED'
      where interest_request_id=new.id and kind='approved_contact'
        and status in ('queued','failed','processing');
  end if;
  return new;
end;
$$;
revoke all on function app_private.suppress_guest_contact_mail_on_end()
  from public,anon,authenticated,service_role;
create trigger suppress_guest_contact_mail_on_end
after update of status on public.interest_requests
for each row execute function app_private.suppress_guest_contact_mail_on_end();

-- The established review contract includes the published snapshot and a
-- revision of its private data, media and horoscope. Keep the same lock order
-- as retries: portfolio, then interest request.
create function public.decide_interest_contact_reviewed(
  p_interest_request_id uuid,p_revision text
) returns text language plpgsql volatile security definer set search_path='' as $$
declare
  v_portfolio_id uuid;
  v_request public.interest_requests%rowtype;
  v_review jsonb;
  v_contact jsonb;
  v_contacts jsonb;
begin
  perform app_private.require_current_session();
  select r.portfolio_id into v_portfolio_id from public.interest_requests r
    where r.id=p_interest_request_id and public.can_manage_portfolio(r.portfolio_id);
  if v_portfolio_id is null then return 'not_found'; end if;
  perform 1 from public.portfolios where id=v_portfolio_id and user_id=auth.uid() for update;
  if not found then return 'unauthorized'; end if;
  select * into v_request from public.interest_requests
    where id=p_interest_request_id and portfolio_id=v_portfolio_id for update;
  if v_request.id is null then return 'not_found'; end if;
  if v_request.email_verified_at is null or v_request.verification_channel<>'email'
    or v_request.viewer_email is null then return 'verification_required'; end if;
  if v_request.status in ('approved','revealed') then return 'already_approved'; end if;
  if v_request.status not in ('new','pending_review') then return 'invalid_transition'; end if;
  v_review := public.get_owner_relationship_page()->'disclosure';
  if p_revision is null or p_revision !~ '^[a-f0-9]{32}$'
    or v_review is null or v_review='null'::jsonb
    or v_review->>'revision' is distinct from p_revision then return 'review_changed'; end if;
  v_contact := v_review->'data'->'contact';
  if pg_catalog.jsonb_typeof(v_contact) is distinct from 'object' then
    return 'no_contact';
  end if;
  -- The published approved projection has already removed secure_note. Copy
  -- only contact fields; never enqueue other private portfolio categories.
  v_contacts := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'contact_person',nullif(pg_catalog.btrim(v_contact->>'contact_person'),''),
    'phone',nullif(pg_catalog.btrim(v_contact->>'phone'),''),
    'email',nullif(pg_catalog.btrim(v_contact->>'email'),''),
    'contacts',case when pg_catalog.jsonb_typeof(v_contact->'contacts')='array'
      then v_contact->'contacts' else null end));
  if v_contacts='{}'::jsonb
    or (coalesce(v_contacts->>'phone','')='' and coalesce(v_contacts->>'email','')
      ='' and not exists(
        select 1 from pg_catalog.jsonb_array_elements(
          case when pg_catalog.jsonb_typeof(v_contacts->'contacts')='array'
            then v_contacts->'contacts' else '[]'::jsonb end) c
        where coalesce(c->>'phone','')<>'' or coalesce(c->>'email','')<>''
      )) then return 'no_contact'; end if;
  update public.interest_requests set status='approved',decided_at=now(),
    decided_by=auth.uid(),updated_at=now() where id=v_request.id;
  insert into app_private.guest_interest_mail_outbox(
    interest_request_id,kind,recipient_email,contact_payload,published_revision
  ) values(v_request.id,'approved_contact',pg_catalog.lower(v_request.viewer_email),
    v_contacts,p_revision);
  insert into app_private.guest_contact_decision_audit(
    interest_request_id,portfolio_id,owner_user_id,published_revision
  ) values(v_request.id,v_portfolio_id,auth.uid(),p_revision);
  return 'approved';
end;
$$;
revoke all on function public.decide_interest_contact_reviewed(uuid,text)
  from public,anon;
grant execute on function public.decide_interest_contact_reviewed(uuid,text) to authenticated;

create function public.claim_guest_interest_mail(p_limit integer default 20)
returns table(
  id uuid,interest_request_id uuid,kind text,recipient_email text,
  contact_payload jsonb,attempt_count integer,lease_token uuid
) language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'invalid claim limit' using errcode='22023'; end if;
  return query
    with candidates as (
      select o.id from app_private.guest_interest_mail_outbox o
      where o.attempt_count<10 and o.created_at>now()-interval '24 hours'
        and (o.status in ('queued','failed') and o.available_at<=now()
          or o.status='processing' and o.lease_expires_at<=now())
      order by o.available_at,o.created_at,o.id
      for update skip locked limit p_limit
    ), claimed as (
      update app_private.guest_interest_mail_outbox o
      set status='processing',attempt_count=o.attempt_count+1,
        lease_token=extensions.gen_random_uuid(),
        lease_expires_at=now()+interval '5 minutes',updated_at=now()
      from candidates c where o.id=c.id
      returning o.id,o.interest_request_id,o.kind,o.recipient_email,
        o.contact_payload,o.attempt_count,o.lease_token
    ) select * from claimed;
end;
$$;
revoke all on function public.claim_guest_interest_mail(integer)
  from public,anon,authenticated;
grant execute on function public.claim_guest_interest_mail(integer) to service_role;

create function public.guest_interest_mail_is_current(
  p_id uuid,p_lease_token uuid
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  v_job app_private.guest_interest_mail_outbox%rowtype;
  v_request public.interest_requests%rowtype;
  v_contact jsonb;
  v_current jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501'; end if;
  select * into v_job from app_private.guest_interest_mail_outbox
    where id=p_id and lease_token=p_lease_token and status='processing'
      and lease_expires_at>now();
  if v_job.id is null or v_job.created_at<=now()-interval '24 hours' then
    return false; end if;
  select * into v_request from public.interest_requests
    where id=v_job.interest_request_id;
  if v_request.id is null
    or pg_catalog.lower(v_request.viewer_email)<>v_job.recipient_email
    or v_request.email_verified_at is null
    or v_request.verification_channel<>'email' then return false; end if;
  if v_job.kind='receipt' then return true; end if;
  if v_job.kind='declined' then return v_request.status='rejected'; end if;
  if v_request.status not in ('approved','revealed') then return false; end if;
  select s.data->'contact' into v_contact
    from public.approved_portfolio_snapshots s
    join public.portfolios p on p.id=s.portfolio_id
    join public.public_portfolio_snapshots pub on pub.portfolio_id=p.id
      and pub.share_token=p.share_token
    where s.portfolio_id=v_request.portfolio_id
      and p.is_published and pub.is_active
      and (p.expires_at is null or p.expires_at>now())
      and (pub.expires_at is null or pub.expires_at>now());
  if pg_catalog.jsonb_typeof(v_contact) is distinct from 'object' then
    return false; end if;
  v_current := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'contact_person',nullif(pg_catalog.btrim(v_contact->>'contact_person'),''),
    'phone',nullif(pg_catalog.btrim(v_contact->>'phone'),''),
    'email',nullif(pg_catalog.btrim(v_contact->>'email'),''),
    'contacts',case when pg_catalog.jsonb_typeof(v_contact->'contacts')='array'
      then v_contact->'contacts' else null end));
  return v_current=v_job.contact_payload;
end;
$$;
revoke all on function public.guest_interest_mail_is_current(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.guest_interest_mail_is_current(uuid,uuid)
  to service_role;

create function public.complete_guest_interest_mail(
  p_id uuid,p_lease_token uuid,p_sent boolean,p_error_code text default null,
  p_retryable boolean default false
) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_updated integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501'; end if;
  if p_id is null or p_lease_token is null or p_sent is null
    or (not p_sent and (p_error_code is null
      or p_error_code !~ '^[A-Z0-9_]{3,80}$')) then
    raise exception 'invalid delivery result' using errcode='22023'; end if;
  update app_private.guest_interest_mail_outbox o
    set status=case when p_sent then 'sent'
      when p_retryable and o.attempt_count<10
        and o.created_at>now()-interval '24 hours' then 'failed'
      else 'suppressed' end,
      delivered_at=case when p_sent then now() else null end,
      available_at=case when not p_sent and p_retryable then
        now()+pg_catalog.make_interval(secs=>least(3600,30*power(2,o.attempt_count)::integer))
        else o.available_at end,
      last_error_code=case when p_sent then null else p_error_code end,
      lease_token=null,lease_expires_at=null,updated_at=now(),
      contact_payload=case when p_sent or not p_retryable or o.attempt_count>=10
          or o.created_at<=now()-interval '24 hours'
        then '{}'::jsonb else o.contact_payload end
    where o.id=p_id and o.lease_token=p_lease_token and o.status='processing'
      and o.lease_expires_at>now();
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;
revoke all on function public.complete_guest_interest_mail(uuid,uuid,boolean,text,boolean)
  from public,anon,authenticated;
grant execute on function public.complete_guest_interest_mail(uuid,uuid,boolean,text,boolean)
  to service_role;

create function public.purge_guest_interest_ephemera(p_limit integer default 100)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare v_challenges integer;v_mail integer;v_stale integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service only' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'invalid purge limit' using errcode='22023'; end if;
  delete from app_private.guest_interest_challenges where id in (
    select id from app_private.guest_interest_challenges
    where expires_at<now()-interval '1 day'
    order by expires_at limit p_limit);
  get diagnostics v_challenges=row_count;
  update app_private.guest_interest_mail_outbox
    set status='suppressed',contact_payload='{}'::jsonb,
      lease_token=null,lease_expires_at=null,updated_at=now(),
      last_error_code='DELIVERY_WINDOW_EXPIRED'
    where id in (
      select id from app_private.guest_interest_mail_outbox
      where created_at<=now()-interval '24 hours'
        and status in ('queued','failed','processing')
      order by created_at limit p_limit);
  get diagnostics v_stale=row_count;
  delete from app_private.guest_interest_mail_outbox where id in (
    select id from app_private.guest_interest_mail_outbox
    where created_at<now()-interval '30 days'
    order by created_at limit p_limit);
  get diagnostics v_mail=row_count;
  return v_challenges+v_stale+v_mail;
end;
$$;
revoke all on function public.purge_guest_interest_ephemera(integer)
  from public,anon,authenticated;
grant execute on function public.purge_guest_interest_ephemera(integer)
  to service_role;
