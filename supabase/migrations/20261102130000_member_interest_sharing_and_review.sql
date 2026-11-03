-- Member interest is an explicit one-action disclosure, never an implicit reverse interest.
create table app_private.member_interest_shares (
  id uuid primary key default extensions.gen_random_uuid(),
  source_interest_request_id uuid not null unique references public.interest_requests(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  granted_by uuid not null references auth.users(id) on delete cascade,
  published_revision text not null check(published_revision ~ '^[a-f0-9]{32}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 days',
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  check(granted_by<>recipient_user_id),
  check(expires_at>created_at and expires_at<=created_at+interval '15 days')
);
create index member_interest_shares_owner on app_private.member_interest_shares(portfolio_id,created_at desc);
create index member_interest_shares_recipient on app_private.member_interest_shares(recipient_user_id,portfolio_id);
create table app_private.interest_deferrals (
  interest_request_id uuid primary key references public.interest_requests(id) on delete cascade,
  deferred_by uuid not null references auth.users(id) on delete cascade,
  deferred_at timestamptz not null default now()
);
alter table app_private.member_interest_shares enable row level security;
alter table app_private.interest_deferrals enable row level security;
revoke all on app_private.member_interest_shares,app_private.interest_deferrals from public,anon,authenticated,service_role;

create function app_private.member_share_current(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app_private.member_interest_shares s
    join public.portfolios own on own.id=s.portfolio_id and own.user_id=s.granted_by
    join public.interest_requests r on r.id=s.source_interest_request_id and r.requester_user_id=s.granted_by
    join public.portfolios recipient on recipient.id=r.portfolio_id and recipient.user_id=s.recipient_user_id
    join auth.users u on u.id=s.recipient_user_id and u.email_confirmed_at is not null
    where s.id=p_id and s.revoked_at is null and s.expires_at>now()
      and r.status not in ('rejected','closed') and r.email_verified_at is not null and r.verification_channel='email'
      and public.is_published_portfolio(own.id) and app_private.pilot_public_portfolio_allowed(own.share_token))
$$;
revoke all on function app_private.member_share_current(uuid) from public,anon,authenticated,service_role;

-- Existing approval grants and outgoing disclosures are alternative evidence for
-- one direction; a later send reuses current permission without extending it.
create function app_private.member_full_access_current(p_portfolio_id uuid,p_viewer_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.portfolios p where p.id=p_portfolio_id
    and public.is_published_portfolio(p.id) and app_private.pilot_public_portfolio_allowed(p.share_token)
    and (exists(select 1 from app_private.member_interest_shares s where s.portfolio_id=p.id
      and s.recipient_user_id=p_viewer_user_id and app_private.member_share_current(s.id))
      or exists(select 1 from public.reveal_grants g where g.portfolio_id=p.id and g.viewer_user_id=p_viewer_user_id
        and g.access_level='full' and g.revoked_at is null and g.expires_at>now())))
$$;
revoke all on function app_private.member_full_access_current(uuid,uuid) from public,anon,authenticated,service_role;
create function app_private.member_request_disclosure_current(p_request_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.interest_requests r join public.portfolios recipient on recipient.id=r.portfolio_id
    join public.portfolios sender on sender.user_id=r.requester_user_id
    where r.id=p_request_id and r.status not in ('rejected','closed')
      and r.metadata->>'member_profile_shared'='true'
      and app_private.member_full_access_current(sender.id,recipient.user_id))
$$;
revoke all on function app_private.member_request_disclosure_current(uuid) from public,anon,authenticated,service_role;

-- One approved-data projection for accountless proofs and member sharing.
create function app_private.approved_view_payload(p_portfolio_id uuid,p_expires_at timestamptz,p_horoscope boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_horoscope then
    select jsonb_build_object('accessPath',h.storage_path,'mimeType',h.mime_type,'fileExtension',h.file_extension,
      'languageLabel',h.language_label,'pageCount',h.page_count,'profileName',a.data#>>'{personal,name}','accessExpiresAt',p_expires_at)
      into result from public.approved_portfolio_snapshots a join public.portfolio_horoscopes h on h.portfolio_id=a.portfolio_id
      where a.portfolio_id=p_portfolio_id and h.published_at is not null and h.file_extension='webp';
  else
    select jsonb_build_object('data',a.data,'templateId',a.template_id,'themeColor',a.theme_color,'sunSign',a.sun_sign,
      'accessExpiresAt',p_expires_at,'horoscope',(select jsonb_strip_nulls(jsonb_build_object('fileExtension',h.file_extension,
        'languageLabel',h.language_label,'pageCount',h.page_count)) from public.portfolio_horoscopes h
        where h.portfolio_id=a.portfolio_id and h.published_at is not null and h.file_extension='webp'),
      'media',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'key',substr(md5(m.storage_path),1,24),'accessPath',m.storage_path,'altText',m.alt_text,'mediaType',m.media_type::text,
        'sortOrder',m.sort_order,'width',m.metadata->'width','height',m.metadata->'height','aspectRatio',m.metadata->'aspectRatio',
        'orientation',m.metadata->>'orientation','presentation','clear')) order by (m.media_type='hero') desc,m.sort_order,m.storage_path)
        from public.portfolio_media m where m.portfolio_id=a.portfolio_id and m.media_type in ('hero','gallery')
          and m.visibility in ('public','blurred','interest_required','approved_only')),'[]'::jsonb)) into result
      from public.approved_portfolio_snapshots a where a.portfolio_id=p_portfolio_id;
  end if;
  return result;
end $$;
revoke all on function app_private.approved_view_payload(uuid,timestamptz,boolean) from public,anon,authenticated,service_role;

create function public.member_interest_context(p_share_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare own public.portfolios%rowtype; target public.portfolios%rowtype; disclosure jsonb; prior public.interest_requests%rowtype;
begin
  perform app_private.require_current_session();
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then return '{"available":false}'::jsonb; end if;
  select * into own from public.portfolios where user_id=auth.uid();
  select * into target from public.portfolios where share_token=p_share_token;
  if own.id is null or target.id is null or own.id=target.id
    or not public.is_published_portfolio(own.id) or not app_private.pilot_public_portfolio_allowed(own.share_token)
    or not public.is_published_portfolio(target.id) or not app_private.pilot_public_portfolio_allowed(target.share_token)
    or not exists(select 1 from auth.users where id=target.user_id and email_confirmed_at is not null)
    then return '{"available":false}'::jsonb; end if;
  disclosure:=public.get_owner_relationship_page()->'disclosure';
  if disclosure is null or disclosure='null'::jsonb then return '{"available":false}'::jsonb; end if;
  select r.* into prior from public.interest_requests r join auth.users u on u.id=auth.uid()
    where r.portfolio_id=target.id and (r.requester_user_id=auth.uid() or lower(r.viewer_email)=lower(u.email))
      and r.status in ('new','pending_review','approved','revealed','rejected') order by r.created_at desc,r.id limit 1;
  return jsonb_build_object('available',true,'name',disclosure#>>'{data,personal,name}',
    'revision',disclosure->>'revision','photoCount',disclosure->'photoCount','privatePhotoCount',disclosure->'privatePhotoCount',
    'hasHoroscope',disclosure->'hasHoroscope','alreadySent',prior.id is not null,
    'requestStatus',prior.status,'sharingActive',exists(select 1 from app_private.member_interest_shares s
      where s.source_interest_request_id=prior.id and app_private.member_share_current(s.id)));
end $$;
revoke all on function public.member_interest_context(text) from public,anon;
grant execute on function public.member_interest_context(text) to authenticated;

create function public.send_member_interest_and_share(p_share_token text,p_revision text,p_message text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare own public.portfolios%rowtype; target public.portfolios%rowtype; context jsonb; approved jsonb;
  actor auth.users%rowtype; recipient auth.users%rowtype; request_id uuid; share_id uuid; reverse_id uuid; quota jsonb;
begin
  perform app_private.require_current_session();
  p_message:=nullif(app_private.trim_interest_text(p_message),'');
  if p_message is not null and length(p_message)>600 then raise exception 'invalid message' using errcode='22023'; end if;
  select * into own from public.portfolios where user_id=auth.uid();
  select * into target from public.portfolios where share_token=p_share_token;
  if own.id is null or target.id is null or own.id=target.id then return '{"status":"unavailable"}'::jsonb; end if;
  -- Lock both portfolios in one order. Crossed A/B sends serialize instead of deadlocking.
  perform id from public.portfolios where id in (own.id,target.id) order by id for update;
  select p.* into own from public.portfolios p where p.id=own.id;
  select p.* into target from public.portfolios p where p.id=target.id;
  context:=public.member_interest_context(p_share_token);
  if (context->>'available')::boolean is distinct from true then return '{"status":"unavailable"}'::jsonb; end if;
  if p_revision is null or context->>'revision' is distinct from p_revision then return '{"status":"review_changed"}'::jsonb; end if;
  if (context->>'alreadySent')::boolean then return jsonb_build_object('status','existing_request','requestStatus',context->>'requestStatus'); end if;
  select * into actor from auth.users where id=auth.uid() and email_confirmed_at is not null;
  select * into recipient from auth.users where id=target.user_id and email_confirmed_at is not null;
  if actor.id is null or recipient.id is null then return '{"status":"unavailable"}'::jsonb; end if;
  quota:=public.consume_api_rate_limit('interest_submit');
  if not (quota->>'allowed')::boolean then return '{"status":"rate_limited"}'::jsonb; end if;
  -- Read the exact published data fenced by the revision; never draft_data.
  select data into approved from public.approved_portfolio_snapshots where portfolio_id=own.id;
  insert into public.interest_requests(portfolio_id,candidate_id,requester_user_id,viewer_name,viewer_email,viewer_phone,
    email_verified_at,verification_channel,viewer_family_context,message,request_reason,requested_sections,prospect_key_hash,status,attribution_status,metadata)
  values(target.id,target.candidate_id,auth.uid(),approved#>>'{personal,name}',lower(actor.email),null,
    actor.email_confirmed_at,'email',approved#>>'{family,public_summary}',p_message,p_message,array['full']::text[],
    encode(extensions.digest(lower(actor.email)||'|member','sha256'),'hex'),'new','unattributed',
    jsonb_strip_nulls(jsonb_build_object('profile_for',coalesce(own.published_data#>>'{personal,profile_for}','self'),
      'country',approved#>>'{personal,country}','state',approved#>>'{personal,region}','city',approved#>>'{personal,city}',
      'member_profile_shared',true))) returning id into request_id;
  if not app_private.member_full_access_current(own.id,target.user_id) then
  insert into app_private.member_interest_shares(source_interest_request_id,portfolio_id,recipient_user_id,recipient_email,granted_by,published_revision)
    values(request_id,own.id,target.user_id,lower(recipient.email),auth.uid(),p_revision) returning id into share_id;
  end if;
  insert into public.access_audit_events(portfolio_id,interest_request_id,actor_user_id,subject_user_id,event_type,metadata)
    values(target.id,request_id,auth.uid(),auth.uid(),'request_submitted','{"profile_source":"published_member"}'::jsonb);
  if share_id is not null then
    insert into public.access_audit_events(portfolio_id,actor_user_id,event_type,metadata)
      values(own.id,auth.uid(),'grant_created',jsonb_build_object('member_share_id',share_id,'duration_days',15));
  end if;
  -- Both people explicitly shared by sending. Mark real crossed requests mutual;
  -- never invent a reverse interest or extend either permission's expiry.
  select r.id into reverse_id from public.interest_requests r
    where r.portfolio_id=own.id and r.requester_user_id=target.user_id and r.status in ('new','pending_review','approved','revealed')
      and app_private.member_request_disclosure_current(r.id) order by r.created_at desc,r.id limit 1;
  if reverse_id is not null then
    update public.interest_requests set status='approved',decided_at=now(),decided_by=auth.uid(),updated_at=now() where id in (request_id,reverse_id);
    delete from app_private.interest_deferrals where interest_request_id in (request_id,reverse_id);
  end if;
  return jsonb_build_object('status','submitted','mutual',reverse_id is not null);
end $$;
revoke all on function public.send_member_interest_and_share(text,text,text) from public,anon;
grant execute on function public.send_member_interest_and_share(text,text,text) to authenticated;

-- Exact-recipient mail link enriches the existing single introduction email.
create function public.member_interest_notification_link(p_request_id uuid,p_recipient_user_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare token text;
begin
  perform app_private.require_email_operator();
  select sender.share_token into token from public.interest_requests r
    join public.portfolios sender on sender.user_id=r.requester_user_id
    join public.portfolios recipient on recipient.id=r.portfolio_id
    where r.id=p_request_id and recipient.user_id=p_recipient_user_id and app_private.member_request_disclosure_current(r.id);
  return token;
end $$;
revoke all on function public.member_interest_notification_link(uuid,uuid) from public,anon,authenticated;
grant execute on function public.member_interest_notification_link(uuid,uuid) to service_role;

create or replace function public.resolve_guest_approved_portfolio(p_share_token text,p_proof_hash text,p_horoscope boolean default false)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare g public.reveal_grants%rowtype; result jsonb;
begin
  perform app_private.require_email_operator();
  if p_share_token is null or p_share_token !~ '^[A-Za-z0-9_-]{3,160}$'
    or p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$' or p_horoscope is null then return null; end if;
  select grant_row.* into g from app_private.guest_portfolio_proofs proof
    join public.interest_requests r on r.id=proof.interest_request_id
    join public.portfolios p on p.id=r.portfolio_id
    join public.reveal_grants grant_row on grant_row.interest_request_id=r.id
    where proof.proof_hash=p_proof_hash and proof.expires_at>now() and p.share_token=p_share_token
      and app_private.guest_portfolio_grant_current(grant_row.id,proof.recipient_email)
    order by grant_row.created_at desc,grant_row.id limit 1;
  if g.id is null then return null; end if;
  result:=app_private.approved_view_payload(g.portfolio_id,g.expires_at,p_horoscope);
  if result is null then return null; end if;
  update public.reveal_grants set last_accessed_at=now() where id=g.id;
  if not exists(select 1 from public.access_audit_events where grant_id=g.id and event_type='grant_accessed' and created_at>now()-interval '1 hour') then
    insert into public.access_audit_events(portfolio_id,interest_request_id,grant_id,event_type)
      values(g.portfolio_id,g.interest_request_id,g.id,'grant_accessed');
  end if;
  return result;
end $$;
revoke all on function public.resolve_guest_approved_portfolio(text,text,boolean) from public,anon,authenticated;
grant execute on function public.resolve_guest_approved_portfolio(text,text,boolean) to service_role;


create function app_private.resolve_member_shared_portfolio(p_share_token text,p_horoscope boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare share app_private.member_interest_shares%rowtype; result jsonb;
begin
  perform app_private.require_current_session();
  select s.* into share from app_private.member_interest_shares s join public.portfolios p on p.id=s.portfolio_id
    where p.share_token=p_share_token and s.recipient_user_id=auth.uid() and app_private.member_share_current(s.id)
    order by s.created_at desc,s.id limit 1;
  if share.id is null then return null; end if;
  result:=app_private.approved_view_payload(share.portfolio_id,share.expires_at,p_horoscope);
  if p_horoscope and (result is null or not exists(select 1 from public.portfolios p where p.id=share.portfolio_id
    and split_part(result->>'accessPath','/',1)=p.user_id::text and split_part(result->>'accessPath','/',2)=p.id::text
    and app_private.storage_path_is_canonical(result->>'accessPath'))) then return null; end if;
  if result is null then return null; end if;
  update app_private.member_interest_shares set last_accessed_at=now() where id=share.id;
  if not exists(select 1 from public.access_audit_events where portfolio_id=share.portfolio_id
    and metadata->>'member_share_id'=share.id::text and event_type='grant_accessed' and created_at>now()-interval '1 hour') then
    insert into public.access_audit_events(portfolio_id,actor_user_id,event_type,metadata)
      values(share.portfolio_id,auth.uid(),'grant_accessed',jsonb_build_object('member_share_id',share.id));
  end if;
  return result;
end $$;
revoke all on function app_private.resolve_member_shared_portfolio(text,boolean) from public,anon,authenticated,service_role;

alter function public.resolve_approved_portfolio(text) rename to resolve_approved_portfolio_before_member_sharing;
alter function public.resolve_approved_portfolio_before_member_sharing(text) set schema app_private;
revoke all on function app_private.resolve_approved_portfolio_before_member_sharing(text) from public,anon,authenticated,service_role;
create function public.resolve_approved_portfolio(p_share_token text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  result:=app_private.resolve_approved_portfolio_before_member_sharing(p_share_token);
  if result is not null then return result; end if;
  return app_private.resolve_member_shared_portfolio(p_share_token,false);
end $$;
revoke all on function public.resolve_approved_portfolio(text) from public,anon;
grant execute on function public.resolve_approved_portfolio(text) to authenticated;

alter function public.resolve_approved_horoscope(text) rename to resolve_approved_horoscope_before_member_sharing;
alter function public.resolve_approved_horoscope_before_member_sharing(text) set schema app_private;
revoke all on function app_private.resolve_approved_horoscope_before_member_sharing(text) from public,anon,authenticated,service_role;
create function public.resolve_approved_horoscope(p_share_token text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  result:=app_private.resolve_approved_horoscope_before_member_sharing(p_share_token);
  if result is not null then return result; end if;
  return app_private.resolve_member_shared_portfolio(p_share_token,true);
end $$;
revoke all on function public.resolve_approved_horoscope(text) from public,anon;
grant execute on function public.resolve_approved_horoscope(text) to authenticated;

create unique index guest_interest_mail_one_decline_idx on app_private.guest_interest_mail_outbox(interest_request_id) where kind='declined';

-- All full-profile approval entry points share the same duplicate-direction guard.
alter function public.decide_interest_portfolio_reviewed(uuid,text) rename to decide_interest_portfolio_reviewed_before_members;
alter function public.decide_interest_portfolio_reviewed_before_members(uuid,text) set schema app_private;
revoke all on function app_private.decide_interest_portfolio_reviewed_before_members(uuid,text) from public,anon,authenticated,service_role;

create function public.decide_interest_relationship(p_interest_request_id uuid,p_decision text,p_revision text default null)
returns text language plpgsql volatile security definer set search_path='' as $$
declare r public.interest_requests%rowtype; owner_id uuid; result text; review jsonb;
begin
  perform app_private.require_current_session();
  select r0.portfolio_id into owner_id from public.interest_requests r0
    where r0.id=p_interest_request_id and public.can_manage_portfolio(r0.portfolio_id);
  if owner_id is null then return 'not_found'; end if;
  perform id from public.portfolios where id=owner_id for update;
  select * into r from public.interest_requests where id=p_interest_request_id for update;
  if p_decision='set_aside' then
    if r.status not in ('new','pending_review') then return 'invalid_transition'; end if;
    insert into app_private.interest_deferrals(interest_request_id,deferred_by) values(r.id,auth.uid()) on conflict do nothing;
    return 'set_aside';
  elsif p_decision='reopened' and exists(select 1 from app_private.interest_deferrals where interest_request_id=r.id) then
    delete from app_private.interest_deferrals where interest_request_id=r.id;
    return 'reopened';
  elsif p_decision='approved' then
    if r.email_verified_at is null or r.verification_channel is distinct from 'email' or r.viewer_email is null then return 'verification_required'; end if;
    -- Keep retries idempotent for both accountless and signed-in viewers.
    if exists(select 1 from public.reveal_grants g where g.interest_request_id=r.id
      and g.access_level='full' and g.revoked_at is null and g.expires_at>now()) then
      return 'already_approved';
    end if;
    -- An explicit crossed send may already provide this owner's disclosure.
    if r.requester_user_id is not null and app_private.member_full_access_current(owner_id,r.requester_user_id) then
      review:=public.get_owner_relationship_page()->'disclosure';
      if review->>'revision' is distinct from p_revision or p_revision is null then return 'review_changed'; end if;
      if r.status not in ('new','pending_review','approved','revealed') then return 'invalid_transition'; end if;
      update public.interest_requests set status='approved',decided_at=now(),decided_by=auth.uid(),updated_at=now() where id=r.id;
      result:=case when r.status in ('approved','revealed') then 'already_approved' else 'approved' end;
    elsif exists(select 1 from public.reveal_grants g where g.interest_request_id=r.id and g.access_level='full') then
      -- A prior disclosure on this request is sticky: an old approval cannot
      -- restore revoked access or reset its expiry. A fresh exchange is needed.
      return 'invalid_transition';
    else
      result:=app_private.decide_interest_portfolio_reviewed_before_members(r.id,p_revision);
    end if;
  elsif p_decision in ('rejected','reopened') then
    result:=public.decide_interest_request(r.id,p_decision);
  else raise exception 'invalid interest decision' using errcode='22023';
  end if;
  if result in ('approved','already_approved','rejected','already_rejected','reopened','already_open') then
    delete from app_private.interest_deferrals where interest_request_id=r.id;
  end if;
  if result='rejected' and r.requester_user_id is null and r.email_verified_at is not null then
    insert into app_private.guest_interest_mail_outbox(interest_request_id,kind,recipient_email)
      values(r.id,'declined',lower(r.viewer_email)) on conflict do nothing;
  end if;
  if result in ('rejected','already_rejected') then
    update app_private.member_interest_shares set revoked_at=coalesce(revoked_at,now()) where source_interest_request_id=r.id;
  end if;
  return result;
end $$;
revoke all on function public.decide_interest_relationship(uuid,text,text) from public,anon;
grant execute on function public.decide_interest_relationship(uuid,text,text) to authenticated;

create function public.decide_interest_portfolio_reviewed(p_interest_request_id uuid,p_revision text)
returns text language plpgsql volatile security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  return public.decide_interest_relationship(p_interest_request_id,'approved',p_revision);
end $$;
revoke all on function public.decide_interest_portfolio_reviewed(uuid,text) from public,anon;
grant execute on function public.decide_interest_portfolio_reviewed(uuid,text) to authenticated;

-- The existing grant endpoint remains the owner's single Stop sharing action.
alter function public.manage_reveal_grant(uuid,text) rename to manage_reveal_grant_before_member_sharing;
alter function public.manage_reveal_grant_before_member_sharing(uuid,text) set schema app_private;
revoke all on function app_private.manage_reveal_grant_before_member_sharing(uuid,text) from public,anon,authenticated,service_role;
create function public.manage_reveal_grant(p_grant_id uuid,p_action text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare s app_private.member_interest_shares%rowtype; g public.reveal_grants%rowtype;
begin
  perform app_private.require_current_session();
  select * into s from app_private.member_interest_shares where id=p_grant_id for update;
  if s.id is null then
    if p_action='renew' then return '{"status":"renewal_disabled"}'::jsonb; end if;
    if p_action is distinct from 'revoke' then raise exception 'invalid grant action' using errcode='22023'; end if;
    select * into g from public.reveal_grants where id=p_grant_id and public.can_manage_portfolio(portfolio_id) for update;
    if g.id is null then return '{"status":"not_found"}'::jsonb; end if;
    if g.revoked_at is not null then return '{"status":"already_revoked"}'::jsonb; end if;
    update public.reveal_grants set revoked_at=now(),revocation_reason='owner_revoked' where id=g.id;
    insert into public.access_audit_events(portfolio_id,interest_request_id,grant_id,actor_user_id,subject_user_id,event_type,metadata)
      values(g.portfolio_id,g.interest_request_id,g.id,auth.uid(),g.viewer_user_id,'grant_revoked','{"reason":"owner_revoked"}'::jsonb);
    return jsonb_build_object('status','revoked','expiresAt',g.expires_at);
  end if;
  if s.granted_by<>auth.uid() or not public.can_manage_portfolio(s.portfolio_id) then return '{"status":"not_found"}'::jsonb; end if;
  if p_action is distinct from 'revoke' then return '{"status":"renewal_disabled"}'::jsonb; end if;
  if s.revoked_at is not null then return '{"status":"already_revoked"}'::jsonb; end if;
  update app_private.member_interest_shares set revoked_at=now() where id=s.id;
  insert into public.access_audit_events(portfolio_id,actor_user_id,event_type,metadata)
    values(s.portfolio_id,auth.uid(),'grant_revoked',jsonb_build_object('member_share_id',s.id));
  return jsonb_build_object('status','revoked','expiresAt',s.expires_at);
end $$;
revoke all on function public.manage_reveal_grant(uuid,text) from public,anon;
grant execute on function public.manage_reveal_grant(uuid,text) to authenticated;

-- Additive owner read contract; existing commands, legacy reads, RLS and grants
-- are intentionally unchanged. Filter/page IDs before building private payloads.
create or replace function public.get_owner_relationship_page(
  p_queue text default 'overview', p_offset integer default 0,
  p_query text default '', p_filter text default 'all'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  owner_id uuid;
  result jsonb;
begin
  perform app_private.require_current_session();
  if p_queue is null or p_queue not in ('overview','awaiting','set-aside','access','history')
    or p_offset is null or p_offset not between 0 and 100000
    or p_query is null or length(p_query) > 80
    or p_filter is null or p_filter not in ('all','direct','broker','verified','pending','active','ended') then
    raise exception 'invalid relationship page' using errcode = '22023';
  end if;
  select id into owner_id from public.portfolios where user_id = auth.uid();

  with candidates as (
    select 'interest'::text kind, r.id, r.created_at, case when d.interest_request_id is not null and r.status in ('new','pending_review') then 'set_aside' else r.status::text end status,
      r.viewer_name name, r.viewer_email email, r.referring_organization_id is not null broker,
      r.email_verified_at is not null and r.verification_channel = 'email' verified
    from public.interest_requests r left join app_private.interest_deferrals d on d.interest_request_id=r.id where r.portfolio_id = owner_id
    union all
    select 'grant', g.id, g.created_at,
      case when g.revoked_at is not null then 'revoked' when g.expires_at <= now() then 'expired' else 'active' end,
      r.viewer_name, r.viewer_email, r.referring_organization_id is not null, true
    from public.reveal_grants g join public.interest_requests r on r.id = g.interest_request_id
    where g.portfolio_id = owner_id
    union all
    select 'member-share', s.id, s.created_at,
      case when s.revoked_at is not null or r.status in ('rejected','closed') then 'revoked' when s.expires_at<=now() then 'expired' else 'active' end,
      a.data#>>'{personal,name}', s.recipient_email, false, true
    from app_private.member_interest_shares s join public.interest_requests r on r.id=s.source_interest_request_id
      left join public.approved_portfolio_snapshots a on a.portfolio_id=r.portfolio_id
    where s.portfolio_id=owner_id
  ), matched as (
    select * from candidates c where
      (p_queue = 'overview'
        or p_queue = 'awaiting' and c.kind = 'interest' and c.status in ('new','pending_review')
        or p_queue = 'set-aside' and c.kind = 'interest' and c.status = 'set_aside'
        or p_queue = 'access' and c.kind in ('grant','member-share') and c.status = 'active'
        or p_queue = 'history' and (c.kind in ('grant','member-share') and c.status <> 'active'
          or c.kind = 'interest' and c.status not in ('new','pending_review','set_aside')))
      and (btrim(p_query) = '' or strpos(lower(coalesce(c.name,'') || ' ' || coalesce(c.email,'')), lower(btrim(p_query))) > 0)
      and (p_filter = 'all' or p_filter = 'direct' and not c.broker or p_filter = 'broker' and c.broker
        or p_filter = 'verified' and c.kind = 'interest' and c.verified
        or p_filter = 'pending' and c.kind = 'interest' and c.status in ('new','pending_review')
        or p_filter = 'active' and c.kind in ('grant','member-share') and c.status = 'active'
        or p_filter = 'ended' and c.kind in ('grant','member-share') and c.status <> 'active')
  ), ranked as (
    select *, row_number() over (partition by case
      when kind='interest' and status in ('new','pending_review') then 'awaiting'
      when kind='interest' and status='set_aside' then 'set-aside'
      when kind in ('grant','member-share') and status='active' then 'access' else 'history' end
      order by created_at desc,id desc,kind) queue_rank from matched
  ), page as (
    select * from ranked where p_queue <> 'overview' or queue_rank <= 3 order by
      created_at desc, id desc, kind
    limit case when p_queue = 'overview' then 50 else 8 end offset p_offset
  ), projected as (
    select p.kind, p.created_at, p.id, jsonb_build_object('kind',case when p.kind='member-share' then 'grant' else p.kind end,'item',
      case when p.kind = 'interest' then jsonb_build_object(
        'id',r.id,'viewer_name',r.viewer_name,'viewer_phone',r.viewer_phone,'viewer_email',r.viewer_email,
        'viewer_family_context',r.viewer_family_context,'message',r.message,'status',p.status,
        'requester_user_id',r.requester_user_id,'metadata',r.metadata - 'portfolio_url','created_at',r.created_at,
        'email_verified',p.verified,'source_type',case when p.broker then 'broker' else 'direct' end,
        'broker_name',o.name,'broker_representative_name',m.display_name,
        'requester_full_profile_shared',app_private.member_request_disclosure_current(r.id),
        'requester_portfolio_token', (select v.share_token from public.portfolios v
          join public.public_portfolio_snapshots s on s.portfolio_id=v.id and s.share_token=v.share_token
          where v.user_id=r.requester_user_id and v.is_published and s.is_active
            and (v.expires_at is null or v.expires_at > now()) and (s.expires_at is null or s.expires_at > now()) limit 1))
      when p.kind='member-share' then jsonb_build_object(
        'id',ms.id,'interestRequestId',ms.source_interest_request_id,'viewerName',p.name,'viewerEmail',ms.recipient_email,
        'direction','outbound_interest','recipientPortfolioToken',recipient.share_token,'requestStatus',r.status,
        'sourceType','direct','status',p.status,'expiresAt',ms.expires_at,'revokedAt',ms.revoked_at,'lastAccessedAt',ms.last_accessed_at)
      else jsonb_build_object(
        'id',g.id,'interestRequestId',g.interest_request_id,'viewerName',r.viewer_name,'viewerEmail',r.viewer_email,
        'sourceType',case when p.broker then 'broker' else 'direct' end,'brokerName',o.name,'status',p.status,
        'expiresAt',g.expires_at,'renewedAt',g.renewed_at,'revokedAt',g.revoked_at,'lastAccessedAt',g.last_accessed_at)
      end) payload
    from page p left join public.reveal_grants g on p.kind in ('grant','member-share') and g.id=p.id
    left join app_private.member_interest_shares ms on p.kind='member-share' and ms.id=p.id
    join public.interest_requests r on r.id=case when p.kind='interest' then p.id when p.kind='member-share' then ms.source_interest_request_id else g.interest_request_id end
    left join public.portfolios recipient on p.kind='member-share' and recipient.id=r.portfolio_id
    left join public.organizations o on o.id=r.referring_organization_id
    left join public.matchmaker_profiles m on m.id=r.referring_matchmaker_profile_id
  ) select jsonb_build_object(
    'records',coalesce((select jsonb_agg(payload order by created_at desc,id desc,kind) from projected),'[]'::jsonb),
    'total',(select count(*) from matched),
    'counts',jsonb_build_object(
      'interests',(select count(*) from candidates where kind='interest'),
      'awaiting',(select count(*) from candidates where kind='interest' and status in ('new','pending_review')),
      'setAside',(select count(*) from candidates where kind='interest' and status='set_aside'),
      'active',(select count(*) from candidates where kind in ('grant','member-share') and status='active')),
    'disclosure',(select jsonb_build_object('data',a.data,
      'revision',md5(a.data::text || coalesce((select string_agg(to_jsonb(m)::text, ',' order by id)
        from public.portfolio_media m where portfolio_id=owner_id and media_type in ('hero','gallery')
        and visibility in ('public','blurred','interest_required','approved_only')),'')
        || coalesce((select to_jsonb(h)::text from public.portfolio_horoscopes h where portfolio_id=owner_id
          and published_at is not null and file_extension='webp'),'')),
      'photoCount',(select count(*) from public.portfolio_media where portfolio_id=owner_id
        and media_type in ('hero','gallery') and visibility in ('public','blurred','interest_required','approved_only')),
      'privatePhotoCount',(select count(*) from public.portfolio_media where portfolio_id=owner_id
        and media_type in ('hero','gallery') and visibility in ('blurred','interest_required','approved_only')),
      'hasHoroscope',exists(select 1 from public.portfolio_horoscopes where portfolio_id=owner_id
        and published_at is not null and file_extension='webp'))
      from public.approved_portfolio_snapshots a join public.portfolios v on v.id=a.portfolio_id
      where a.portfolio_id=owner_id and v.is_published)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_owner_relationship_page(text,integer,text,text) from public, anon, authenticated;
grant execute on function public.get_owner_relationship_page(text,integer,text,text) to authenticated;
comment on function public.get_owner_relationship_page(text,integer,text,text) is
  'Bounded owner/session-only relationship queues, counts and current published disclosure. No grant mutations.';


-- Keep the exact-ID activity read consistent with the private deferral state.
alter function public.get_interest_details(uuid) rename to get_interest_details_before_deferral;
alter function public.get_interest_details_before_deferral(uuid) set schema app_private;
revoke all on function app_private.get_interest_details_before_deferral(uuid) from public,anon,authenticated,service_role;
create function public.get_interest_details(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  result:=app_private.get_interest_details_before_deferral(p_request_id);
  if result is not null and result->>'requestStatus' in ('new','pending_review')
    and exists(select 1 from app_private.interest_deferrals where interest_request_id=p_request_id) then
    result:=jsonb_set(result,'{requestStatus}','"set_aside"'::jsonb);
  end if;
  return result;
end $$;
revoke all on function public.get_interest_details(uuid) from public,anon;
grant execute on function public.get_interest_details(uuid) to authenticated;

-- The pre-existing readable-link contract permits 3-160 characters. Retain the
-- deployed guest verifier's quotas and validation, changing only its path guard.
do $migration$
declare definition text; target regprocedure;
begin
  target:='public.begin_guest_interest_verification(jsonb,text,text,text)'::regprocedure;
  definition:=pg_get_functiondef(target);
  if strpos(definition,'between 8 and 160')=0 then raise exception 'unexpected guest start path guard'; end if;
  execute replace(definition,'between 8 and 160','between 3 and 160');
  target:='app_private.submit_verified_guest_interest(jsonb,text,text)'::regprocedure;
  definition:=pg_get_functiondef(target);
  if strpos(definition,'{8,160}')=0 then raise exception 'unexpected guest submit path guard'; end if;
  execute replace(definition,'{8,160}','{3,160}');
end;
$migration$;
